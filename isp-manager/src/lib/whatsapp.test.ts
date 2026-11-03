import { test } from "node:test";
import assert from "node:assert/strict";
import { isMobileDevice, toWhatsAppNumber, whatsAppChatUrl } from "./whatsapp";
import { whatsappReminder } from "./arabic";

test("Iraqi numbers become 9647XXXXXXXXX", () => {
  for (const input of [
    "07701234567",
    "9647701234567",
    "+9647701234567",
    "009647701234567",
    "7701234567",
    "0770 123 4567",
    "0770-123-4567",
    "+964 770 123 4567",
    "(0770) 123-4567",
    "٠٧٧٠١٢٣٤٥٦٧",
    "۰۷۷۰۱۲۳۴۵۶۷",
    "+96407701234567",
    " 07701234567 ",
  ]) {
    assert.equal(toWhatsAppNumber(input), "9647701234567", input);
  }
  assert.equal(toWhatsAppNumber("07801234567"), "9647801234567");
  assert.equal(toWhatsAppNumber("07501234567"), "9647501234567");
});

test("invalid numbers return null (no wrong link)", () => {
  for (const input of [
    null,
    undefined,
    "",
    "   ",
    "abc",
    "0770123456", // too short
    "077012345678", // too long
    "0123456789", // not mobile
    "06701234567",
    "964770123456", // 964 but too short
    "96477012345678", // 964 but too long
    "9641234567890", // 964 but not mobile
    "+964123",
    "123",
    "07701234567x",
    "+",
    "+0123456789",
  ]) {
    assert.equal(toWhatsAppNumber(input), null, String(input));
    assert.equal(whatsAppChatUrl(input), null, String(input));
    assert.equal(whatsAppChatUrl(input, "desktop"), null, String(input));
  }
});

test("foreign numbers with + or 00 are kept", () => {
  assert.equal(toWhatsAppNumber("+989121234567"), "989121234567");
  assert.equal(toWhatsAppNumber("00905321234567"), "905321234567");
});

test("chat links open the chat without any message", () => {
  assert.equal(whatsAppChatUrl("07701234567"), "https://wa.me/9647701234567");
  assert.equal(whatsAppChatUrl("07701234567", "mobile"), "https://wa.me/9647701234567");
  assert.equal(whatsAppChatUrl("+9647701234567", "desktop"), "https://web.whatsapp.com/send?phone=9647701234567");
  for (const url of [whatsAppChatUrl("07701234567")!, whatsAppChatUrl("07701234567", "desktop")!]) {
    assert.ok(!url.includes("text="), "no pre-filled message");
  }
});

test("device detection: phones use the app, computers use WhatsApp Web", () => {
  const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
  const android = "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";
  const ipadOS = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
  const windows = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
  assert.equal(isMobileDevice(iphone), true);
  assert.equal(isMobileDevice(android), true);
  assert.equal(isMobileDevice(ipadOS, 5), true, "iPadOS reports Macintosh but has touch");
  assert.equal(isMobileDevice(ipadOS, 0), false, "real Mac");
  assert.equal(isMobileDevice(windows), false);
});

test("reminder button: uses the normalised number and refuses invalid ones", () => {
  const base = { name: "علي", endDate: "2026-12-01", expired: false, formattedDate: "2026/12/01" };
  assert.ok(whatsappReminder({ ...base, phone: "07701234567" })!.startsWith("https://wa.me/9647701234567?text="));
  assert.equal(whatsappReminder({ ...base, phone: "12345" }), null);
});

test("reminder message: office template", () => {
  const text = (u: string) => decodeURIComponent(u.split("text=")[1]);
  const msg = text(
    whatsappReminder({
      name: "امنه عصام عامود 47",
      phone: "07701234567",
      endDate: "2026-11-16",
      expired: false,
      formattedDate: "16/11/2026",
      formattedStart: "2026/11/15",
    })!,
  );
  assert.equal(
    msg,
    [
      "مرحباً امنه عصام عامود 47",
      "نود تذكيركم بأن اشتراك الإنترنت الخاص بكم ينتهي بتاريخ 16/11/2026.",
      "علماً ان تاريخ التفعيل هو 2026/11/15",
      "مكتب الرؤيا",
      "",
      "يتوفر الدفع الالكتروني عن طريق",
      " الماستر : 7119171481 ",
      "او الزين كاش : 07704593597",
      "",
      "مع الشكر والتقدير",
    ].join("\n"),
  );
  const expired = text(whatsappReminder({ name: "علي", phone: "07701234567", endDate: "2026-01-01", expired: true, formattedDate: "01/01/2026" })!);
  assert.match(expired, /انتهى بتاريخ 01\/01\/2026/);
  assert.doesNotMatch(expired, /تاريخ التفعيل/, "no activation line without a start date");
  assert.match(expired, /الزين كاش : 07704593597/);
});
