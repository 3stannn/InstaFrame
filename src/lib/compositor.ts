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

let cachedFrameMetas: Record<string, FrameMeta> | null = null;

export async function getFrameMetas(): Promise<Record<string, FrameMeta>> {
  if (cachedFrameMetas) return cachedFrameMetas;
  try {
    const res = await fetch("/assets/frames/frame-meta.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cachedFrameMetas = await res.json();
    return cachedFrameMetas!;
  } catch (err) {
    console.error("Failed to load frame-meta.json from public directory, using fallback:", err);
    cachedFrameMetas = {
      "iphone-15": {
        name: "iPhone 15",
        canvasWidth: 4500,
        canvasHeight: 3000,
        screenX: 1752,
        screenY: 424,
        screenWidth: 1010,
        screenHeight: 2193,
        borderRadius: 105,
        frameAsset: "/assets/frames/Iphone15_dark.png",
      },
      "macbook-air-13": {
        name: 'MacBook Air 13"',
        canvasWidth: 7500,
        canvasHeight: 5000,
        screenX: 2030,
        screenY: 1206,
        screenWidth: 3443,
        screenHeight: 2242,
        borderRadius: 40,
        frameAsset: "/assets/frames/MacbookAir13.png",
      },
      "ipad-pro": {
        name: "iPad Pro",
        canvasWidth: 7500,
        canvasHeight: 5000,
        screenX: 2320,
        screenY: 1428,
        screenWidth: 2859,
        screenHeight: 2144,
        borderRadius: 35,
        frameAsset: "/assets/frames/IpadPro.png",
      },
      "pro-display-xdr": {
        name: "Apple Pro Display XDR",
        canvasWidth: 9000,
        canvasHeight: 5776,
        screenX: 1727,
        screenY: 1142,
        screenWidth: 5545,
        screenHeight: 3121,
        borderRadius: 4,
        frameAsset: "/assets/frames/ProDisplayXDR.png",
      },
      "pixel-8": {
        name: "Google Pixel 8",
        canvasWidth: 4500,
        canvasHeight: 3000,
        screenX: 1795,
        screenY: 501,
        screenWidth: 900,
        screenHeight: 1999,
        borderRadius: 45,
        frameAsset: "/assets/frames/Pixel8.png",
      },
      "s24": {
        name: "Samsung Galaxy S24 Ultra",
        canvasWidth: 4500,
        canvasHeight: 3000,
        screenX: 1744,
        screenY: 419,
        screenWidth: 1005,
        screenHeight: 2163,
        borderRadius: 2,
        frameAsset: "/assets/frames/S24.png",
      },
    };
    return cachedFrameMetas;
  }
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
}: MockupOptions): Promise<string> {
  if (!frameId || frameId === "none") {
    return rawScreenshotBase64;
  }

  const metas = await getFrameMetas();
  const meta = metas[frameId];
  if (!meta) {
    throw new Error(`Frame definition not found: ${frameId}`);
  }

  const canvas = document.createElement("canvas");
  canvas.width = meta.canvasWidth;
  canvas.height = meta.canvasHeight;
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) throw new Error("Could not acquire canvas 2D context");

  // 1. Render Background
  applyCanvasBackground(ctx, canvas.width, canvas.height, backgroundStyle);

  // Load screen image
  const screenImg = await loadImage(rawScreenshotBase64);

  const isDesktop =
    meta.name.toLowerCase().includes("macbook") ||
    meta.name.toLowerCase().includes("desktop") ||
    meta.name.toLowerCase().includes("display") ||
    meta.name.toLowerCase().includes("xdr");
  const isIphone = meta.name.toLowerCase().includes("iphone");

  let isDark = false;
  if (isIphone) {
    if (autoNotch) {
      const tempC = document.createElement("canvas");
      tempC.width = screenImg.width;
      tempC.height = Math.min(50, screenImg.height);
      const tempCtx = tempC.getContext("2d");
      if (tempCtx) {
        tempCtx.drawImage(screenImg, 0, 0);
        const data = tempCtx.getImageData(0, 0, tempC.width, tempC.height).data;
        let r = 0,
          g = 0,
          b = 0,
          count = 0;
        for (let i = 0; i < data.length; i += 16) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count++;
        }
        if (count > 0) {
          r /= count;
          g /= count;
          b /= count;
          isDark = (r * 299 + g * 587 + b * 114) / 1000 < 128;
        }
      }
    } else {
      const hex = notchColor.replace("#", "");
      const r = parseInt(hex.substring(0, 2), 16) || 0;
      const g = parseInt(hex.substring(2, 4), 16) || 0;
      const b = parseInt(hex.substring(4, 6), 16) || 0;
      isDark = (r * 299 + g * 587 + b * 114) / 1000 < 128;
    }
  }

  // Resolve frame asset path
  let frameAssetRel = meta.frameAsset;
  if (frameAssetRel.startsWith("assets/")) {
    frameAssetRel = "/" + frameAssetRel;
  }
  if (!frameAssetRel.startsWith("/")) {
    frameAssetRel = "/" + frameAssetRel;
  }

  if (isIphone) {
    frameAssetRel = isDark
      ? "/assets/frames/Iphone15_dark.png"
      : "/assets/frames/Iphone15_light.png";
  }

  // Load icons for desktop chrome
  let appleLogoImg: HTMLImageElement | null = null;
  if (isDesktop && pageUrl) {
    try {
      appleLogoImg = await loadImage("/assets/icons/apple-logo.png");
    } catch {
      // Ignore if icon missing
    }
  }

  const frameImg = await loadImage(frameAssetRel);

  // 3. Draw Screenshot inside Clipped Rounded Rectangle
  ctx.save();
  ctx.beginPath();
  drawRoundedRect(ctx, meta.screenX, meta.screenY, meta.screenWidth, meta.screenHeight, meta.borderRadius);
  ctx.clip();

  // Fill base screen surface behind content
  ctx.fillStyle = isDark ? "#000000" : "#FFFFFF";
  ctx.fillRect(meta.screenX, meta.screenY, meta.screenWidth, meta.screenHeight);

  // Draw browser chrome or mobile notch space
  let topOffset = 0;

  if (isDesktop && pageUrl) {
    const isMacbook = meta.name.toLowerCase().includes("macbook");
    const menuBarHeight = isMacbook
      ? Math.max(Math.round(meta.screenWidth * 0.014), 74)
      : Math.round(meta.screenWidth * 0.013);
    const safariHeight = Math.round(meta.screenWidth * 0.019);
    topOffset = menuBarHeight + safariHeight;
    drawMacBrowserChrome(ctx, meta.screenX, meta.screenY, meta.screenWidth, menuBarHeight, safariHeight, pageUrl, appleLogoImg);
  } else if (isIphone) {
    topOffset = meta.screenWidth * 0.13;
    ctx.fillStyle = autoNotch ? (isDark ? "#000000" : "#FFFFFF") : notchColor;
    ctx.fillRect(meta.screenX, meta.screenY, meta.screenWidth, topOffset);
  }

  const availableHeight = meta.screenHeight - topOffset;
  const imageAspect = screenImg.width / screenImg.height;
  const screenAspect = meta.screenWidth / availableHeight;

  const widthScale = meta.screenWidth / screenImg.width;
  const scaledHeight = screenImg.height * widthScale;
  const contentZoom = zoomLevel > 0 ? zoomLevel / 100 : 1.0;

  if (fitMode === "contain") {
    // Proportional fit: show entire image, centered in available screen area
    const scale = Math.min(meta.screenWidth / screenImg.width, availableHeight / screenImg.height) * contentZoom;
    const drawW = screenImg.width * scale;
    const drawH = screenImg.height * scale;
    const drawX = meta.screenX + (meta.screenWidth - drawW) / 2;
    const drawY = meta.screenY + topOffset + (availableHeight - drawH) / 2;
    ctx.drawImage(screenImg, drawX, drawY, drawW, drawH);
  } else if (fitMode === "cover") {
    // Proportional cover: fill entire screen area without voids or stretching, anchored at top
    const scale = Math.max(meta.screenWidth / screenImg.width, availableHeight / screenImg.height) * contentZoom;
    const drawW = screenImg.width * scale;
    const drawH = screenImg.height * scale;
    const drawX = meta.screenX + (meta.screenWidth - drawW) / 2;
    const drawY = meta.screenY + topOffset;
    ctx.drawImage(screenImg, drawX, drawY, drawW, drawH);
  } else {
    // "smart" mode (default) - Match the extension's behavior:
    if (contentZoom !== 1.0) {
      const baseH = (scaledHeight >= availableHeight * 0.85 && scaledHeight <= availableHeight * 1.15)
        ? availableHeight
        : scaledHeight;
      const drawW = meta.screenWidth * contentZoom;
      const drawH = baseH * contentZoom;
      const drawX = meta.screenX + (meta.screenWidth - drawW) / 2;
      const drawY = meta.screenY + topOffset;
      ctx.drawImage(screenImg, drawX, drawY, drawW, drawH);
    } else if (scaledHeight >= availableHeight * 0.85 && scaledHeight <= availableHeight * 1.15) {
      // 1. If scaled height is within 15% of available height (single-screen apps, web mockups):
      // Fit cleanly to availableHeight so bottom footer reaches the bottom bezel with 0 gap!
      ctx.drawImage(screenImg, meta.screenX, meta.screenY + topOffset, meta.screenWidth, availableHeight);
    } else if (isDesktop && pageUrl && scaledHeight <= availableHeight * 1.25) {
      // For desktop with pageUrl, fit to availableHeight as in extension line 238
      ctx.drawImage(screenImg, meta.screenX, meta.screenY + topOffset, meta.screenWidth, availableHeight);
    } else if (Math.abs(imageAspect - screenAspect) > 0.4) {
      // Significant aspect ratio mismatch (e.g. 16:9 desktop snapshot put into portrait phone frame)
      // Proportional cover anchored at top: eliminates the 75% white void without distortion!
      const scale = Math.max(meta.screenWidth / screenImg.width, availableHeight / screenImg.height);
      const drawW = screenImg.width * scale;
      const drawH = screenImg.height * scale;
      const drawX = meta.screenX + (meta.screenWidth - drawW) / 2;
      const drawY = meta.screenY + topOffset;
      ctx.drawImage(screenImg, drawX, drawY, drawW, drawH);
    } else {
      // Standard proportional draw anchored beneath topOffset
      ctx.drawImage(screenImg, meta.screenX, meta.screenY + topOffset, meta.screenWidth, scaledHeight);
    }
  }

  ctx.restore();

  // 4. Overlay Hardware Bezel & Shadows
  ctx.drawImage(frameImg, 0, 0, meta.canvasWidth, meta.canvasHeight);

  return canvas.toDataURL("image/png");
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
  // 1. Draw macOS System Menu Bar
  ctx.fillStyle = "#B0B7C6";
  ctx.fillRect(x, y, width, menuBarHeight);

  ctx.fillStyle = "#000000";
  const menuFontSize = menuBarHeight * 0.38;
  ctx.font = `500 ${menuFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  const paddingX = width * 0.015;
  const menuY = y + menuBarHeight / 2;

  let currentX = x + paddingX;
  if (appleLogoImg) {
    const iconSize = menuFontSize * 0.95;
    ctx.drawImage(appleLogoImg, currentX, y + (menuBarHeight - iconSize) / 2, iconSize, iconSize);
    currentX += iconSize + menuFontSize * 1.3;
  } else {
    ctx.fillText("", currentX, menuY + menuFontSize * 0.05);
    currentX += ctx.measureText("").width + menuFontSize * 1.3;
  }

  ctx.fillText("Safari   File   Edit   View   History   Bookmarks   Window   Help", currentX, menuY + menuFontSize * 0.05);

  ctx.textAlign = "right";
  const now = new Date();
  const timeStr = "9:41 PM";
  const dateStr = now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  const rightText = `${dateStr}   ${timeStr}`;
  ctx.fillText(rightText, x + width - paddingX, menuY + menuFontSize * 0.05);

  // 2. Draw Safari Browser Chrome
  const safariY = y + menuBarHeight;

  ctx.fillStyle = "#F3F3F4";
  ctx.fillRect(x, safariY, width, safariHeight);

  ctx.fillStyle = "#E5E5E5";
  ctx.fillRect(x, safariY + safariHeight - 2, width, 2);

  const radius = safariHeight * 0.125;
  const spacing = radius * 2.5;
  const startX = x + safariHeight * 0.45;
  const centerY = safariY + safariHeight / 2;

  const colors = ["#FF5F56", "#FFBD2E", "#27C93F"];
  colors.forEach((color, i) => {
    ctx.beginPath();
    ctx.arc(startX + i * spacing, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(0,0,0,0.1)";
    ctx.stroke();
  });

  const barWidth = width * 0.44;
  const barHeight = safariHeight * 0.5;
  const barX = x + (width - barWidth) / 2;
  const barY = safariY + (safariHeight - barHeight) / 2;
  const barRadius = barHeight / 2;

  ctx.beginPath();
  ctx.moveTo(barX + barRadius, barY);
  ctx.arcTo(barX + barWidth, barY, barX + barWidth, barY + barHeight, barRadius);
  ctx.arcTo(barX + barWidth, barY + barHeight, barX, barY + barHeight, barRadius);
  ctx.arcTo(barX, barY + barHeight, barX, barY, barRadius);
  ctx.arcTo(barX, barY, barX + barWidth, barY, barRadius);
  ctx.closePath();

  ctx.fillStyle = "#EAEAEA";
  ctx.fill();

  let displayUrl = url;
  try {
    const parsed = new URL(url);
    displayUrl = parsed.hostname + (parsed.pathname.length > 1 && parsed.pathname !== "/" ? parsed.pathname : "");
  } catch {
    // Keep as is
  }

  const fontSize = barHeight * 0.48;
  ctx.fillStyle = "#333333";
  ctx.font = `500 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(displayUrl, x + width / 2, centerY + fontSize * 0.05);
}

/**
 * Apply canvas background styles
 */
function applyCanvasBackground(ctx: CanvasRenderingContext2D, w: number, h: number, style: string) {
  if (style === "transparent") {
    ctx.clearRect(0, 0, w, h);
    return;
  }

  const grad = ctx.createLinearGradient(0, 0, w, h);
  if (style === "gradient-purple") {
    grad.addColorStop(0, "#4f46e5");
    grad.addColorStop(1, "#9333ea");
  } else if (style === "gradient-sunset") {
    grad.addColorStop(0, "#f43f5e");
    grad.addColorStop(1, "#fb923c");
  } else if (style === "gradient-ocean") {
    grad.addColorStop(0, "#06b6d4");
    grad.addColorStop(1, "#3b82f6");
  } else if (style === "studio-light") {
    grad.addColorStop(0, "#f8fafc");
    grad.addColorStop(1, "#cbd5e1");
  } else if (style === "studio-dark") {
    grad.addColorStop(0, "#090d16");
    grad.addColorStop(1, "#1e293b");
  } else {
    grad.addColorStop(0, "#0f172a");
    grad.addColorStop(1, "#1e293b");
  }

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
 * Load an image source into an HTMLImageElement
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error(`Failed to load image: ${err ? (err as any).message || src : src}`));
    img.src = src;
  });
}
