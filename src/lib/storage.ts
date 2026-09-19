/**
 * Type-safe settings storage wrapper for Web LocalStorage
 */

import { sanitizeAndValidateUrl, isSafeToPersist } from "./url-validation";

export interface ActiveDeviceConfig {
  id: string;
  presetKey: string;
  name: string;
  width: number;
  height: number;
  rotated: boolean;
}

export interface ResponsivePreviewSettings {
  activeDevices?: ActiveDeviceConfig[];
  scale?: "auto" | number;
  layoutMode?: "wrap" | "row";
  syncScroll?: boolean;
  syncInteractions?: boolean;
  scrollMode?: "ratio" | "pixels";
}

export interface AppSettings {
  preset: string;
  customW: number;
  customH: number;
  fullPage: boolean;
  frame: string;
  background: string;
  zoom: string;
  notchColor: string;
  autoNotch: boolean;
  targetUrl: string;
  fitMode?: "smart" | "cover" | "contain";
  responsive?: ResponsivePreviewSettings;
}

export const DEFAULT_SETTINGS: AppSettings = {
  preset: "desktop-1080p",
  customW: 1440,
  customH: 900,
  fullPage: false,
  frame: "none",
  background: "studio-dark",
  zoom: "100",
  notchColor: "#000000",
  autoNotch: true,
  targetUrl: "",
  fitMode: "smart",
  responsive: {
    activeDevices: [
      {
        id: "dev-iphone",
        presetKey: "iphone-15",
        name: "iPhone 15",
        width: 393,
        height: 852,
        rotated: false,
      },
      {
        id: "dev-macbook",
        presetKey: "macbook-air-13",
        name: "MacBook Air",
        width: 1280,
        height: 832,
        rotated: false,
      },
    ],
    scale: "auto",
    layoutMode: "row",
    syncScroll: true,
    syncInteractions: false,
    scrollMode: "ratio",
  },
};

const STORAGE_KEY = "instaframe_web_settings";

export function loadSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    if (parsed.targetUrl === "https://schedy-sepia.vercel.app/" || parsed.targetUrl === "https://yourwebsite.com") {
      parsed.targetUrl = "";
    }
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Partial<AppSettings>): void {
  if (typeof window === "undefined") return;
  try {
    const current = loadSettings();
    const toSave: Partial<AppSettings> = { ...settings };

    // Sanitize targetUrl: do not persist URLs containing credentials or sensitive tokens
    if (toSave.targetUrl) {
      const validated = sanitizeAndValidateUrl(toSave.targetUrl);
      if (validated.isValid && validated.sanitizedForStorage) {
        toSave.targetUrl = validated.sanitizedForStorage;
      } else if (!validated.isValid) {
        delete toSave.targetUrl; // Don't persist invalid URLs
      }
    }

    const updated = {
      ...current,
      ...toSave,
      responsive: {
        ...current.responsive,
        ...toSave.responsive,
      },
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("Failed to persist settings:", err);
  }
}

