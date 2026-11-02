import { ImageResponse } from "next/og";

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#1e3a8a"/><path d="M32 18v32M24 50l8-20 8 20M20 26a17 17 0 0 1 24 0M15 20a24 24 0 0 1 34 0" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/** App icon as PNG, generated on the server (home-screen / PWA icons). */
export function appIcon(size: number) {
  const src = `data:image/svg+xml;base64,${Buffer.from(SVG).toString("base64")}`;
  return new ImageResponse(
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} width={size} height={size} alt="" />,
    { width: size, height: size },
  );
}
