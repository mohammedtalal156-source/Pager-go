import { appIcon } from "@/lib/app-icon";

export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const n = size === "512" ? 512 : 192;
  return appIcon(n);
}
