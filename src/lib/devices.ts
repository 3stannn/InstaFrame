/**
 * InstaFrame Standardized Viewport Definitions
 */

export interface DevicePreset {
  id: string;
  name: string;
  category: "Desktop & Laptops" | "Tablets" | "Mobile Devices" | "Custom";
  width: number;
  height: number;
  deviceScaleFactor: number;
  mobile: boolean;
  userAgent: string | null;
  defaultFrame: string;
  isViewportPreset?: boolean;
}

const rawPresets: Record<string, DevicePreset> = {
  // Illustrative Viewport Presets & Desktop
  "desktop-1440": {
    id: "desktop-1440",
    name: "Desktop Viewport (1440 × 900)",
    category: "Desktop & Laptops",
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
    userAgent: null,
    defaultFrame: "none",
    isViewportPreset: true,
  },
  "desktop-1280": {
    id: "desktop-1280",
    name: "Laptop Viewport (1280 × 800)",
    category: "Desktop & Laptops",
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false,
    userAgent: null,
    defaultFrame: "none",
    isViewportPreset: true,
  },
  "tablet-768": {
    id: "tablet-768",
    name: "Tablet Viewport (768 × 1024)",
    category: "Tablets",
    width: 768,
    height: 1024,
    deviceScaleFactor: 2,
    mobile: true,
    userAgent:
      "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    defaultFrame: "none",
    isViewportPreset: true,
  },
  "mobile-390": {
    id: "mobile-390",
    name: "Mobile Viewport (390 × 844)",
    category: "Mobile Devices",
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    mobile: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    defaultFrame: "none",
    isViewportPreset: true,
  },
  "pro-display-xdr": {
    id: "pro-display-xdr",
    name: 'Pro Display XDR 32"',
    category: "Desktop & Laptops",
    width: 2048,
    height: 1152,
    deviceScaleFactor: 2,
    mobile: false,
    userAgent: null,
    defaultFrame: "pro-display-xdr"
  },
  "desktop-4k": {
    id: "desktop-4k",
    name: "Desktop 4K UHD",
    category: "Desktop & Laptops",
    width: 3840,
    height: 2160,
    deviceScaleFactor: 1,
    mobile: false,
    userAgent: null,
    defaultFrame: "pro-display-xdr"
  },
  "desktop-1440p": {
    id: "desktop-1440p",
    name: "Desktop 1440p (QHD)",
    category: "Desktop & Laptops",
    width: 2560,
    height: 1440,
    deviceScaleFactor: 1,
    mobile: false,
    userAgent: null,
    defaultFrame: "pro-display-xdr"
  },
  "desktop-1080p": {
    id: "desktop-1080p",
    name: "Desktop 1080p",
    category: "Desktop & Laptops",
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false,
    userAgent: null,
    defaultFrame: "pro-display-xdr"
  },
  "macbook-pro-16": {
    id: "macbook-pro-16",
    name: 'MacBook Pro 16"',
    category: "Desktop & Laptops",
    width: 1728,
    height: 1117,
    deviceScaleFactor: 2,
    mobile: false,
    userAgent: null,
    defaultFrame: "macbook-air-13"
  },
  "macbook-pro-14": {
    id: "macbook-pro-14",
    name: 'MacBook Pro 14"',
    category: "Desktop & Laptops",
    width: 1512,
    height: 982,
    deviceScaleFactor: 2,
    mobile: false,
    userAgent: null,
    defaultFrame: "macbook-air-13"
  },
  "macbook-air-13": {
    id: "macbook-air-13",
    name: 'MacBook Air 13"',
    category: "Desktop & Laptops",
    width: 1280,
    height: 832,
    deviceScaleFactor: 2,
    mobile: false,
    userAgent: null,
    defaultFrame: "macbook-air-13"
  },
  "laptop-1366": {
    id: "laptop-1366",
    name: "Standard Laptop",
    category: "Desktop & Laptops",
    width: 1366,
    height: 768,
    deviceScaleFactor: 1,
    mobile: false,
    userAgent: null,
    defaultFrame: "none"
  },

  // Tablets
  "ipad-pro-13": {
    id: "ipad-pro-13",
    name: 'iPad Pro 13"',
    category: "Tablets",
    width: 1376,
    height: 1032,
    deviceScaleFactor: 2,
    mobile: true,
    userAgent: "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    defaultFrame: "ipad-pro"
  },
  "ipad-pro-11": {
    id: "ipad-pro-11",
    name: 'iPad Pro 11"',
    category: "Tablets",
    width: 1194,
    height: 834,
    deviceScaleFactor: 2,
    mobile: true,
    userAgent: "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    defaultFrame: "ipad-pro"
  },
  "ipad-pro-12": {
    id: "ipad-pro-12",
    name: 'iPad Pro 12.9"',
    category: "Tablets",
    width: 1024,
    height: 1366,
    deviceScaleFactor: 2,
    mobile: true,
    userAgent: "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    defaultFrame: "ipad-pro"
  },
  "ipad-air": {
    id: "ipad-air",
    name: 'iPad Air 11"',
    category: "Tablets",
    width: 820,
    height: 1180,
    deviceScaleFactor: 2,
    mobile: true,
    userAgent: "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    defaultFrame: "ipad-pro"
  },
  "ipad-mini": {
    id: "ipad-mini",
    name: "iPad Mini",
    category: "Tablets",
    width: 744,
    height: 1133,
    deviceScaleFactor: 2,
    mobile: true,
    userAgent: "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    defaultFrame: "none"
  },

  // Mobile Devices
  "iphone-16-pro-max": {
    id: "iphone-16-pro-max",
    name: "iPhone 16 Pro Max",
    category: "Mobile Devices",
    width: 430,
    height: 932,
    deviceScaleFactor: 3,
    mobile: true,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    defaultFrame: "iphone-15"
  },
  "iphone-15": {
    id: "iphone-15",
    name: "iPhone 15 / 14 Pro",
    category: "Mobile Devices",
    width: 393,
    height: 852,
    deviceScaleFactor: 3,
    mobile: true,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    defaultFrame: "iphone-15"
  },
  "iphone-se": {
    id: "iphone-se",
    name: "iPhone SE",
    category: "Mobile Devices",
    width: 375,
    height: 667,
    deviceScaleFactor: 2,
    mobile: true,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    defaultFrame: "iphone-15"
  },
  "samsung-s24-ultra": {
    id: "samsung-s24-ultra",
    name: "Galaxy S24 Ultra",
    category: "Mobile Devices",
    width: 412,
    height: 915,
    deviceScaleFactor: 2.625,
    mobile: true,
    userAgent: "Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
    defaultFrame: "s24"
  },
  "pixel-8": {
    id: "pixel-8",
    name: "Pixel 8 / 9",
    category: "Mobile Devices",
    width: 412,
    height: 915,
    deviceScaleFactor: 2.625,
    mobile: true,
    userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
    defaultFrame: "pixel-8"
  }
};

export const DEVICE_ALIASES: Record<string, string> = {
  "macbook-air": "macbook-air-13",
  "macbook-pro": "macbook-pro-16",
  "macbook-pro-clay": "macbook-air-13",
  "iphone-16": "iphone-16-pro-max",
  "iphone-14-pro": "iphone-15",
  "iphone-clay-dark": "iphone-15",
  "iphone-clay-light": "iphone-15",
  "ipad-pro": "ipad-pro-13",
  "ipad-pro-clay": "ipad-pro-13",
  "apple-pro-display-xdr": "pro-display-xdr",
  "xdr": "pro-display-xdr",
  "s24": "samsung-s24-ultra",
  "s24-ultra": "samsung-s24-ultra",
  "pixel": "pixel-8",
  "pixel-9": "pixel-8",
};

// Clean non-duplicated Proxy that transparently resolves aliases on lookup
export const DEVICE_PRESETS: Record<string, DevicePreset> = new Proxy(rawPresets, {
  get(target, prop: string) {
    if (prop in target) return target[prop];
    const alias = DEVICE_ALIASES[prop];
    if (alias && alias in target) return target[alias];
    return undefined;
  },
  ownKeys(target) {
    return Object.keys(target);
  },
  getOwnPropertyDescriptor(target, prop) {
    return Object.getOwnPropertyDescriptor(target, prop);
  },
});

export const DEVICE_CATEGORIES = ["Desktop & Laptops", "Tablets", "Mobile Devices"] as const;

export const FRAME_OPTIONS = [
  { id: "none", name: "Raw", meta: "Default", isPro: false, section: "Default", icon: "raw" as const },
  { id: "pro-display-xdr", name: "Pro Display XDR", meta: "Pro", isPro: true, section: "Displays", icon: "monitor" as const },
  { id: "macbook-air-13", name: 'MacBook Air 13"', meta: "Pro", isPro: true, section: "Laptops", icon: "laptop" as const },
  { id: "ipad-pro", name: "iPad Pro", meta: "Pro", isPro: true, section: "Tablets", icon: "tablet" as const },
  { id: "iphone-15", name: "iPhone 15", meta: "Pro", isPro: true, section: "Phones", icon: "phone" as const },
  { id: "s24", name: "Galaxy S24 Ultra", meta: "Pro", isPro: true, section: "Phones", icon: "phone" as const },
  { id: "pixel-8", name: "Pixel 8", meta: "Pro", isPro: true, section: "Phones", icon: "phone" as const }
] as const;

export const BACKDROP_OPTIONS = [
  {
    id: "studio-dark",
    name: "Studio Dark",
    section: "Studio Backdrops",
    swatchClass: "ring-zinc-600",
    swatchStyle: { background: "linear-gradient(135deg, #3f3f46, #18181b)" },
  },
  {
    id: "studio-light",
    name: "Studio Light",
    section: "Studio Backdrops",
    swatchClass: "ring-zinc-400",
    swatchStyle: { background: "linear-gradient(135deg, #ffffff, #d4d4d8)" },
  },
  {
    id: "transparent",
    name: "Transparent",
    section: "Minimal",
    swatchClass: "ring-zinc-600",
    swatchStyle: { background: "repeating-conic-gradient(#71717a 0% 25%, #27272a 0% 50%) 50% / 6px 6px" },
  },
  {
    id: "gradient-purple",
    name: "Purple",
    section: "Gradients",
    swatchClass: "",
    swatchStyle: { background: "linear-gradient(135deg, #6366f1, #a855f7)" },
  },
  {
    id: "gradient-sunset",
    name: "Sunset",
    section: "Gradients",
    swatchClass: "",
    swatchStyle: { background: "linear-gradient(135deg, #f43f5e, #fb923c)" },
  },
  {
    id: "gradient-ocean",
    name: "Ocean",
    section: "Gradients",
    swatchClass: "",
    swatchStyle: { background: "linear-gradient(135deg, #06b6d4, #3b82f6)" },
  },
] as const;

export const ZOOM_OPTIONS = [
  { value: "100", label: "100%", meta: "Default", section: "Zoom Levels" },
  { value: "110", label: "110%", meta: "Subtle", section: "Zoom Levels" },
  { value: "125", label: "125%", meta: "Comfortable", section: "Zoom Levels" },
  { value: "140", label: "140%", meta: "Large", section: "Zoom Levels" },
  { value: "150", label: "150%", meta: "Focus", section: "Zoom Levels" }
] as const;
