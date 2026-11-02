import "server-only";
import ExcelJS from "exceljs";

/** Columns of the import file (Arabic headers; several spellings accepted). */
export const IMPORT_COLUMNS = [
  { key: "full_name", label: "الاسم", aliases: ["الاسم", "الاسم الكامل", "اسم المشترك", "name"] },
  { key: "phone", label: "الهاتف", aliases: ["الهاتف", "رقم الهاتف", "الموبايل", "الجوال", "phone"] },
  { key: "tower", label: "البرج", aliases: ["البرج", "اسم البرج", "tower"] },
  { key: "area", label: "المنطقة", aliases: ["المنطقة", "المنطقه", "area"] },
  { key: "package", label: "الباقة", aliases: ["الباقة", "الباقه", "package"] },
  { key: "price", label: "السعر", aliases: ["السعر", "سعر الاشتراك", "price"] },
  { key: "start_date", label: "تاريخ البداية", aliases: ["تاريخ البداية", "تاريخ البدايه", "البداية", "start"] },
  { key: "end_date", label: "تاريخ الانتهاء", aliases: ["تاريخ الانتهاء", "الانتهاء", "تاريخ الانتهاء الاشتراك", "end"] },
  { key: "remaining", label: "المبلغ المتبقي", aliases: ["المبلغ المتبقي", "المتبقي", "الدين", "remaining"] },
] as const;

export type ImportRow = {
  line: number;
  full_name: string;
  phone: string;
  tower: string;
  area: string;
  package: string;
  price: number;
  start_date: string;
  end_date: string;
  remaining: number;
  errors: string[];
  exists?: boolean;
  duplicateInFile?: boolean;
};

const norm = (s: string) =>
  s
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const latin = (s: string) =>
  s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("result" in v && v.result != null) return cellText(v.result as ExcelJS.CellValue);
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("text" in v) return String(v.text);
    return "";
  }
  return String(v).trim();
}

function parseDate(raw: string): string | null {
  const s = latin(raw).trim();
  if (!s) return "";
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  let y: number, mo: number, d: number;
  if (m) [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  else if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/))) [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])]; // day first (Iraq)
  else if (/^\d{5}$/.test(s)) {
    const dt = new Date(Date.UTC(1899, 11, 30) + Number(s) * 86400000); // Excel serial
    return dt.toISOString().slice(0, 10);
  } else return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

function parseMoney(raw: string): number | null {
  const s = latin(raw).replace(/[,\s،]/g, "").replace(/د\.?ع|دينار|iqd/gi, "");
  if (!s) return 0;
  if (!/^\d+(\.0+)?$/.test(s)) return null;
  return Math.round(Number(s));
}

function parsePhone(raw: string): string | null {
  let s = latin(raw).replace(/[\s\-()]/g, "");
  if (/^7\d{9}$/.test(s)) s = "0" + s; // Excel drops the leading zero
  return /^\+?\d{7,15}$/.test(s) ? s : null;
}

export async function parseImportFile(buffer: ArrayBuffer): Promise<{ rows: ImportRow[]; missingColumns: string[] }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) return { rows: [], missingColumns: IMPORT_COLUMNS.map((c) => c.label) };

  // Find the header row within the first 10 rows.
  let headerRow = 0;
  const colIndex: Record<string, number> = {};
  for (let r = 1; r <= Math.min(10, ws.rowCount); r++) {
    const found: Record<string, number> = {};
    ws.getRow(r).eachCell((cell, col) => {
      const t = norm(cellText(cell.value));
      for (const c of IMPORT_COLUMNS) if (c.aliases.some((a) => norm(a) === t)) found[c.key] = col;
    });
    if (found.full_name && found.phone) {
      headerRow = r;
      Object.assign(colIndex, found);
      break;
    }
  }
  const required = ["full_name", "phone", "tower"];
  const missingColumns = IMPORT_COLUMNS.filter((c) => required.includes(c.key) && !colIndex[c.key]).map((c) => c.label);
  if (!headerRow || missingColumns.length) return { rows: [], missingColumns: missingColumns.length ? missingColumns : ["الاسم", "الهاتف"] };

  const rows: ImportRow[] = [];
  const seen = new Map<string, number>();
  for (let r = headerRow + 1; r <= ws.rowCount && rows.length < 5001; r++) {
    const row = ws.getRow(r);
    const get = (k: string) => (colIndex[k] ? cellText(row.getCell(colIndex[k]).value) : "");
    const name = get("full_name");
    const phoneRaw = get("phone");
    if (!name && !phoneRaw) continue; // empty line
    const errors: string[] = [];
    const phone = parsePhone(phoneRaw);
    if (name.length < 2) errors.push("الاسم مفقود");
    if (!phone) errors.push("رقم الهاتف غير صحيح");
    const tower = get("tower");
    if (!tower) errors.push("البرج مفقود");
    const price = parseMoney(get("price"));
    if (price == null) errors.push("السعر غير صحيح");
    const remaining = parseMoney(get("remaining"));
    if (remaining == null) errors.push("المبلغ المتبقي غير صحيح");
    const start = parseDate(get("start_date"));
    if (start == null) errors.push("تاريخ البداية غير صحيح");
    const end = parseDate(get("end_date"));
    if (end == null) errors.push("تاريخ الانتهاء غير صحيح");
    if (start && end && end < start) errors.push("الانتهاء قبل البداية");
    const item: ImportRow = {
      line: r,
      full_name: name,
      phone: phone ?? phoneRaw,
      tower,
      area: get("area"),
      package: get("package"),
      price: price ?? 0,
      start_date: start ?? "",
      end_date: end ?? "",
      remaining: remaining ?? 0,
      errors,
    };
    if (phone) {
      if (seen.has(phone)) {
        item.duplicateInFile = true;
        item.errors.push(`مكرر في الملف (السطر ${seen.get(phone)})`);
      } else seen.set(phone, r);
    }
    rows.push(item);
  }
  return { rows, missingColumns: [] };
}

export async function buildTemplate() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("المشتركين", { views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }] });
  ws.addRow(IMPORT_COLUMNS.map((c) => c.label)).font = { bold: true };
  ws.addRow(["أحمد محمد", "07701234567", "برج الكرادة", "الكرادة", "باقة 25 ألف", 25000, "2026-11-01", "2026-12-01", 10000]);
  IMPORT_COLUMNS.forEach((c, i) => {
    ws.getColumn(i + 1).width = c.key === "full_name" || c.key === "tower" ? 24 : 16;
  });
  ws.getColumn(2).numFmt = "@";
  return wb.xlsx.writeBuffer();
}
