import { getBrowserChromeDimensions } from "./frame-layout";
import FRAME_METAS from "../../public/assets/frames/frame-meta.json";

/**
 * HTML5 Canvas Mockup Compositor Engine (Web Native)
 * Pure client-side rendering with strict aspect ratio preservation (no distortion or compression)
 */

export interface FrameMeta {
  name: string;
  canvasWidth: number;
  canvasHeight: number;
  screenX: number;
  screenY: number;
  screenWidth: number;
  screenHeight: number;
  borderRadius: number;
  frameAsset: string;
}

export type FitMode = "smart" | "cover" | "contain";

export interface MockupOptions {
  rawScreenshotBase64: string;
  frameId: string;
  backgroundStyle?: string;
  pageUrl?: string;
  autoNotch?: boolean;
  notchColor?: string;
  fitMode?: FitMode;
  zoomLevel?: number;
}

export interface MockupResult {
  /** Image URL for display, download and copy. A blob: URL when `isObjectUrl` is true. */
  url: string;
  width: number;
  height: number;
  /** The caller must call URL.revokeObjectURL(url) once the image is no longer shown. */
  isObjectUrl: boolean;
}

const FRAMES = FRAME_METAS as Record<string, FrameMeta>;

/** Frame metadata is bundled with the app, so no network request is needed. */
export async function getFrameMetas(): Promise<Record<string, FrameMeta>> {
  return FRAMES;
}

// Frame PNGs are large (up to 9000 px wide). Decode each once per session.
const imageCache = new Map<string, Promise<HTMLImageElement>>();

function loadCachedImage(src: string): Promise<HTMLImageElement> {
  let pending = imageCache.get(src);
  if (!pending) {
    pending = loadImage(src).catch((err) => {
      imageCache.delete(src);
      throw err;
    });
    imageCache.set(src, pending);
  }
  return pending;
}

function resolveAssetPath(asset: string): string {
  return asset.startsWith("/") ? asset : `/${asset}`;
}

function frameKind(meta: FrameMeta) {
  const name = meta.name.toLowerCase();
  return {
    isDesktop: /macbook|desktop|display|xdr/.test(name),
    isMacbook: name.includes("macbook"),
    isIphone: name.includes("iphone"),
  };
}

/** Average luminance of the top strip of an image, sampled on a tiny canvas. */
function isTopEdgeDark(img: HTMLImageElement): boolean {
  const sampleW = 64;
  const sampleH = 4;
  const canvas = document.createElement("canvas");
  canvas.width = sampleW;
  canvas.height = sampleH;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return false;
  const stripH = Math.max(1, Math.min(50, img.height));
  ctx.drawImage(img, 0, 0, img.width, stripH, 0, 0, sampleW, sampleH);
  const data = ctx.getImageData(0, 0, sampleW, sampleH).data;
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    sum += data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114;
  }
  return sum / (data.length / 4) / 1000 < 128;
}

function isHexDark(color: string): boolean {
  const hex = color.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16) || 0;
  const g = parseInt(hex.substring(2, 4), 16) || 0;
  const b = parseInt(hex.substring(4, 6), 16) || 0;
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}

/**
 * Composite screenshot into device frame with styling
 * Strictly preserves aspect ratio with zero vertical/horizontal stretching or squashing
 */
export async function renderMockup({
  rawScreenshotBase64,
  frameId,
  backgroundStyle = "studio-dark",
  pageUrl = "",
  autoNotch = true,
  notchColor = "#000000",
  fitMode = "smart",
  zoomLevel = 100,
}: MockupOptions): Promise<MockupResult> {
  if (!frameId || frameId === "none") {
    const raw = await loadImage(rawScreenshotBase64);
    return { url: rawScreenshotBase64, width: raw.naturalWidth, height: raw.naturalHeight, isObjectUrl: false };
  }

  const meta = FRAMES[frameId];
  if (!meta) {
    throw new Error(`Frame definition not found: ${frameId}`);
  }

  const { isDesktop, isMacbook, isIphone } = frameKind(meta);
  const drawChrome = isDesktop && Boolean(pageUrl);

  // Load the screenshot, the bezel and (for desktops) the Apple logo in parallel.
  const screenPromise = loadImage(rawScreenshotBase64);
  const logoPromise = drawChrome
    ? loadCachedImage("/assets/icons/apple-logo.png").catch(() => null)
    : Promise.resolve(null);
  const genericFramePromise = isIphone ? null : loadCachedImage(resolveAssetPath(meta.frameAsset));

  const screenImg = await screenPromise;

  let isDark = false;
  if (isIphone) {
    isDark = autoNotch ? isTopEdgeDark(screenImg) : isHexDark(notchColor);
  }

  const [frameImg, appleLogoImg] = await Promise.all([
    genericFramePromise ??
      loadCachedImage(isDark ? "/assets/frames/Iphone15_dark.png" : "/assets/frames/Iphone15_light.png"),
    logoPromise,
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = meta.canvasWidth;
  canvas.height = meta.canvasHeight;
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) throw new Error("Could not acquire canvas 2D context");
  ctx.imageSmoothingQuality = "high";

  // 1. Background
  applyCanvasBackground(ctx, canvas.width, canvas.height, backgroundStyle);

  // 2. Screenshot inside the clipped screen area
  ctx.save();
  drawRoundedRect(ctx, meta.screenX, meta.screenY, meta.screenWidth, meta.screenHeight, meta.borderRadius);
  ctx.clip();

  ctx.fillStyle = isDark ? "#000000" : "#FFFFFF";
  ctx.fillRect(meta.screenX, meta.screenY, meta.screenWidth, meta.screenHeight);

  let topOffset = 0;
  if (drawChrome) {
    const { menuBarHeight, safariHeight } = getBrowserChromeDimensions(meta.screenWidth, isMacbook);
    topOffset = menuBarHeight + safariHeight;
    drawMacBrowserChrome(ctx, meta.screenX, meta.screenY, meta.screenWidth, menuBarHeight, safariHeight, pageUrl, appleLogoImg);
  } else if (isIphone) {
    topOffset = meta.screenWidth * 0.13;
    ctx.fillStyle = autoNotch ? (isDark ? "#000000" : "#FFFFFF") : notchColor;
    ctx.fillRect(meta.screenX, meta.screenY, meta.screenWidth, topOffset);
  }

  // Keep the page content beneath the browser bar / status bar.
  ctx.beginPath();
  ctx.rect(meta.screenX, meta.screenY + topOffset, meta.screenWidth, meta.screenHeight - topOffset);
  ctx.clip();

  const availableHeight = meta.screenHeight - topOffset;
  const contentZoom = zoomLevel > 0 ? zoomLevel / 100 : 1.0;

  if (fitMode === "contain") {
    const scale = Math.min(meta.screenWidth / screenImg.width, availableHeight / screenImg.height) * contentZoom;
    const drawW = screenImg.width * scale;
    const drawH = screenImg.height * scale;
    ctx.drawImage(
      screenImg,
      meta.screenX + (meta.screenWidth - drawW) / 2,
      meta.screenY + topOffset + (availableHeight - drawH) / 2,
      drawW,
      drawH
    );
  } else if (fitMode === "cover") {
    const scale = Math.max(meta.screenWidth / screenImg.width, availableHeight / screenImg.height) * contentZoom;
    const drawW = screenImg.width * scale;
    const drawH = screenImg.height * scale;
    ctx.drawImage(screenImg, meta.screenX + (meta.screenWidth - drawW) / 2, meta.screenY + topOffset, drawW, drawH);
  } else {
    // Fit by width, anchored beneath the browser chrome, without stretching the screenshot.
    const drawW = meta.screenWidth * contentZoom;
    const drawH = screenImg.height * (meta.screenWidth / screenImg.width) * contentZoom;
    ctx.drawImage(screenImg, meta.screenX + (meta.screenWidth - drawW) / 2, meta.screenY + topOffset, drawW, drawH);
  }

  ctx.restore();

  // 3. Hardware bezel & shadows
  ctx.drawImage(frameImg, 0, 0, meta.canvasWidth, meta.canvasHeight);

  // Encode asynchronously: toDataURL on a 50+ megapixel canvas blocks the main thread.
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  canvas.width = canvas.height = 0; // release the backing store early
  if (!blob) throw new Error("Could not encode the mockup image");
  return { url: URL.createObjectURL(blob), width: meta.canvasWidth, height: meta.canvasHeight, isObjectUrl: true };
}

/**
 * Modern macOS menu bar + Safari compact toolbar, monochrome, icons only.
 * Every size is derived from the bar heights so it scales with any frame.
 */
const CHROME_FONT = `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
const INK = "#1d1d1f"; // primary glyphs
const INK_SOFT = "#6e6e73"; // toolbar icons
const INK_FAINT = "#b8b8bd"; // disabled icon (forward)
const TOOLBAR_BG = "#f5f5f7";

export function displayHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "") || url;
  } catch {
    return url;
  }
}

function drawMacBrowserChrome(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  menuBarHeight: number,
  safariHeight: number,
  url: string,
  appleLogoImg: HTMLImageElement | null
) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Menu bar
  ctx.fillStyle = "#e8e8eb";
  ctx.fillRect(x, y, width, menuBarHeight);

  const m = menuBarHeight;
  const menuCy = y + m / 2;
  const edgePad = Math.max(width * 0.012, m * 0.5);

  const logo = m * 0.44;
  if (appleLogoImg) {
    ctx.drawImage(appleLogoImg, x + edgePad, menuCy - logo / 2 - m * 0.02, logo, logo);
  }

  // Safari toolbar
  const s = safariHeight;
  const ty = y + m;
  const cy = ty + s / 2;

  ctx.fillStyle = TOOLBAR_BG;
  ctx.fillRect(x, ty, width, s);
  const hairline = Math.max(1, s * 0.012);
  ctx.fillStyle = "#e1e1e5";
  ctx.fillRect(x, ty + s - hairline, width, hairline);

  const stroke = Math.max(1.5, s * 0.02);

  // Window controls: neutral grey instead of red / yellow / green
  const r = s * 0.105;
  const lightGap = r * 2.75;
  let cx = x + s * 0.38 + r;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(cx + i * lightGap, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = "#d2d2d7";
    ctx.fill();
    ctx.lineWidth = Math.max(1, s * 0.008);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.06)";
    ctx.stroke();
  }
  cx += lightGap * 2 + r;

  // Sidebar toggle, back, forward
  const icon = s * 0.28;
  cx += s * 0.42;
  drawSidebarIcon(ctx, cx, cy, icon, INK_SOFT, stroke);
  cx += icon * 1.25 + s * 0.34;
  drawChevron(ctx, cx, cy, icon * 0.42, INK_SOFT, stroke, -1);
  cx += s * 0.36;
  drawChevron(ctx, cx, cy, icon * 0.42, INK_FAINT, stroke, 1);

  // Right side: tab overview, new tab, share
  let ix = x + width - s * 0.42;
  drawTabsIcon(ctx, ix - icon, cy, icon, INK_SOFT, stroke, TOOLBAR_BG);
  ix -= icon + s * 0.36;
  drawPlusIcon(ctx, ix - icon * 0.8, cy, icon * 0.8, INK_SOFT, stroke);
  ix -= icon * 0.8 + s * 0.36;
  drawShareIcon(ctx, ix - icon * 0.8, cy, icon, INK_SOFT, stroke);

  // Address field: centered, domain only (as Safari shows it)
  const fieldW = Math.min(width * 0.34, width - s * 8);
  const fieldH = s * 0.58;
  const fieldX = x + (width - fieldW) / 2;
  const fieldY = cy - fieldH / 2;
  drawRoundedRect(ctx, fieldX, fieldY, fieldW, fieldH, fieldH * 0.32);
  ctx.fillStyle = "#e6e6ea";
  ctx.fill();

  const host = displayHost(url);
  const fontSize = fieldH * 0.42;
  ctx.font = `500 ${fontSize}px ${CHROME_FONT}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";

  const lockH = fontSize * 0.86;
  const lockW = lockH * 0.74;
  const lockGap = fontSize * 0.45;
  const maxText = fieldW - fieldH - lockW - lockGap;
  const textW = Math.min(ctx.measureText(host).width, maxText);
  const groupX = fieldX + (fieldW - (lockW + lockGap + textW)) / 2;

  drawLockIcon(ctx, groupX, cy, lockW, lockH, INK_SOFT, stroke * 0.85);
  ctx.fillStyle = INK;
  ctx.fillText(host, groupX + lockW + lockGap, cy + fontSize * 0.04, maxText);

  ctx.restore();
}

/* Glyphs: each takes its left x and vertical center y. */

function drawSidebarIcon(ctx: CanvasRenderingContext2D, x: number, cy: number, size: number, color: string, lw: number) {
  const w = size * 1.25;
  const h = size;
  ctx.lineWidth = lw;
  ctx.strokeStyle = color;
  drawRoundedRect(ctx, x, cy - h / 2, w, h, h * 0.2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + w * 0.36, cy - h / 2);
  ctx.lineTo(x + w * 0.36, cy + h / 2);
  ctx.stroke();
}

function drawChevron(
  ctx: CanvasRenderingContext2D,
  x: number,
  cy: number,
  half: number,
  color: string,
  lw: number,
  dir: -1 | 1
) {
  const arm = half * 0.62;
  ctx.lineWidth = lw * 1.1;
  ctx.strokeStyle = color;
  ctx.beginPath();
  if (dir < 0) {
    ctx.moveTo(x + arm, cy - half);
    ctx.lineTo(x, cy);
    ctx.lineTo(x + arm, cy + half);
  } else {
    ctx.moveTo(x, cy - half);
    ctx.lineTo(x + arm, cy);
    ctx.lineTo(x, cy + half);
  }
  ctx.stroke();
}

function drawShareIcon(ctx: CanvasRenderingContext2D, x: number, cy: number, size: number, color: string, lw: number) {
  const w = size * 0.8;
  const h = size;
  const top = cy - h / 2 - h * 0.08;
  const boxTop = cy - h * 0.12;
  const mid = x + w / 2;
  ctx.lineWidth = lw;
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.3, boxTop);
  ctx.lineTo(x, boxTop);
  ctx.lineTo(x, cy + h / 2);
  ctx.lineTo(x + w, cy + h / 2);
  ctx.lineTo(x + w, boxTop);
  ctx.lineTo(x + w * 0.7, boxTop);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(mid, cy + h * 0.18);
  ctx.lineTo(mid, top);
  ctx.moveTo(mid - w * 0.26, top + w * 0.26);
  ctx.lineTo(mid, top);
  ctx.lineTo(mid + w * 0.26, top + w * 0.26);
  ctx.stroke();
}

function drawPlusIcon(ctx: CanvasRenderingContext2D, x: number, cy: number, size: number, color: string, lw: number) {
  ctx.lineWidth = lw;
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, cy);
  ctx.lineTo(x + size, cy);
  ctx.moveTo(x + size / 2, cy - size / 2);
  ctx.lineTo(x + size / 2, cy + size / 2);
  ctx.stroke();
}

function drawTabsIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  cy: number,
  size: number,
  color: string,
  lw: number,
  bg: string
) {
  const sq = size * 0.78;
  const off = size * 0.22;
  const top = cy - size / 2;
  ctx.lineWidth = lw;
  ctx.strokeStyle = color;
  drawRoundedRect(ctx, x + off, top, sq, sq, sq * 0.22);
  ctx.stroke();
  drawRoundedRect(ctx, x, top + off, sq, sq, sq * 0.22);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.stroke();
}

function drawLockIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  cy: number,
  w: number,
  h: number,
  color: string,
  lw: number
) {
  const bodyH = h * 0.58;
  const bodyY = cy + h / 2 - bodyH;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  drawRoundedRect(ctx, x, bodyY, w, bodyH, w * 0.18);
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.beginPath();
  const shR = w * 0.3;
  ctx.moveTo(x + w / 2 - shR, bodyY);
  ctx.lineTo(x + w / 2 - shR, bodyY - h * 0.12);
  ctx.arc(x + w / 2, bodyY - h * 0.12, shR, Math.PI, 0);
  ctx.lineTo(x + w / 2 + shR, bodyY);
  ctx.stroke();
}

/**
 * Apply canvas background styles
 */
function applyCanvasBackground(ctx: CanvasRenderingContext2D, w: number, h: number, style: string) {
  if (style === "transparent") {
    ctx.clearRect(0, 0, w, h);
    return;
  }

  const stops: Record<string, [string, string]> = {
    "gradient-purple": ["#4f46e5", "#9333ea"],
    "gradient-sunset": ["#f43f5e", "#fb923c"],
    "gradient-ocean": ["#06b6d4", "#3b82f6"],
    "studio-light": ["#f8fafc", "#cbd5e1"],
    "studio-dark": ["#090d16", "#1e293b"],
  };
  const [from, to] = stops[style] || ["#0f172a", "#1e293b"];
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, from);
  grad.addColorStop(1, to);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

/**
 * Helper to draw a rounded rectangle path
 */
function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Load an image source into a decoded HTMLImageElement
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src.startsWith("data:") ? "screenshot" : src}`));
    img.src = src;
  });
}
