export interface FrameScreenGeometry {
  name: string;
  screenWidth: number;
  screenHeight: number;
}

export function getBrowserChromeDimensions(screenWidth: number, isMacbook: boolean) {
  return {
    menuBarHeight: isMacbook ? Math.max(Math.round(screenWidth * 0.014), 74) : Math.round(screenWidth * 0.013),
    safariHeight: Math.round(screenWidth * 0.032),
  };
}

export function getFrameContentHeight(meta: FrameScreenGeometry, viewportWidth: number): number {
  const name = meta.name.toLowerCase();
  let offset = 0;
  if (/macbook|desktop|display|xdr/.test(name)) {
    const chrome = getBrowserChromeDimensions(meta.screenWidth, name.includes("macbook"));
    offset = chrome.menuBarHeight + chrome.safariHeight;
  } else if (name.includes("iphone")) {
    offset = meta.screenWidth * 0.13;
  }
  return Math.max(100, Math.round(viewportWidth * (meta.screenHeight - offset) / meta.screenWidth));
}
