/**
 * Client-Side Viewport Image Crop Engine
 * Accurately slices high-resolution source snapshots based on viewport scroll position
 * and custom selection coordinates, completely independent of CSS zoom levels.
 */

export interface CropOptions {
  sourceDataUrl: string;
  deviceWidth: number;
  deviceHeight: number;
  scrollTop?: number;
  scrollLeft?: number;
  customRect?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Loads a base64 image data URL into an HTMLImageElement
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error("Failed to load source image for cropping: " + String(err)));
    img.src = src;
  });
}

/**
 * Crops a viewport region from the source image.
 * Maps CSS layout coordinates (visible viewport + scroll offset OR custom marquee)
 * directly into source-image pixel coordinates.
 */
export async function cropViewportImage(options: CropOptions): Promise<string> {
  const {
    sourceDataUrl,
    deviceWidth,
    deviceHeight,
    scrollTop = 0,
    scrollLeft = 0,
    customRect,
  } = options;

  const img = await loadImage(sourceDataUrl);

  // Intrinsic scale: ratio of natural image pixels to CSS device width
  const scale = img.naturalWidth / deviceWidth;

  let cropX = 0;
  let cropY = 0;
  let cropW = deviceWidth;
  let cropH = deviceHeight;

  if (customRect) {
    // Custom area selection inside visible viewport window
    cropX = Math.max(0, customRect.x) + scrollLeft;
    cropY = Math.max(0, customRect.y) + scrollTop;
    cropW = Math.max(10, customRect.width);
    cropH = Math.max(10, customRect.height);
  } else {
    // Exact visible region currently displayed
    cropX = scrollLeft;
    cropY = scrollTop;
    cropW = deviceWidth;
    cropH = deviceHeight;
  }

  // Map into source image pixel space
  const srcX = Math.max(0, Math.round(cropX * scale));
  const srcY = Math.max(0, Math.round(cropY * scale));
  const srcW = Math.min(img.naturalWidth - srcX, Math.round(cropW * scale));
  const srcH = Math.min(img.naturalHeight - srcY, Math.round(cropH * scale));

  if (srcW <= 0 || srcH <= 0) {
    throw new Error("Invalid crop coordinates: calculated zero width or height");
  }

  const canvas = document.createElement("canvas");
  canvas.width = srcW;
  canvas.height = srcH;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Could not obtain 2D rendering context for image crop");
  }

  // Draw exactly the calculated sub-rectangle
  ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);

  return canvas.toDataURL("image/png");
}

/**
 * Triggers a browser download of a base64 PNG without navigating away
 */
export function downloadPng(dataUrl: string, filename: string): void {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename.endsWith(".png") ? filename : `${filename}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
