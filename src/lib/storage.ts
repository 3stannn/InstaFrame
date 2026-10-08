/**
 * Type-safe settings storage wrapper for Web LocalStorage
 */

import { sanitizeAndValidateUrl } from "./url-validation.ts";

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

export function normalizeSettings(value: unknown): AppSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...DEFAULT_SETTINGS };
  const parsed = value as Record<string, unknown>;
  const settings = { ...DEFAULT_SETTINGS };
  const dimension = (value: unknown, fallback: number) => typeof value === "number" && Number.isFinite(value) ? Math.max(100, Math.min(7680, Math.round(value))) : fallback;
  for (const key of ["preset", "frame", "background", "zoom"] as const) {
    if (typeof parsed[key] === "string" && parsed[key]) settings[key] = parsed[key];
  }
  settings.customW = dimension(parsed.customW, settings.customW);
  settings.customH = dimension(parsed.customH, settings.customH);
  for (const key of ["fullPage", "autoNotch"] as const) {
    if (typeof parsed[key] === "boolean") settings[key] = parsed[key];
  }
  if (typeof parsed.notchColor === "string" && /^#[0-9a-f]{6}$/i.test(parsed.notchColor)) settings.notchColor = parsed.notchColor;
  if (["smart", "cover", "contain"].includes(String(parsed.fitMode))) settings.fitMode = parsed.fitMode as AppSettings["fitMode"];
  if (typeof parsed.targetUrl === "string" && parsed.targetUrl && !["https://schedy-sepia.vercel.app/", "https://yourwebsite.com"].includes(parsed.targetUrl)) {
    const validated = sanitizeAndValidateUrl(parsed.targetUrl);
    settings.targetUrl = validated.isValid ? validated.sanitizedForStorage || "" : "";
  }
  if (parsed.responsive && typeof parsed.responsive === "object" && !Array.isArray(parsed.responsive)) {
    const saved = parsed.responsive as Record<string, unknown>;
    const responsive = { ...DEFAULT_SETTINGS.responsive };
    if (saved.layoutMode === "row" || saved.layoutMode === "wrap") responsive.layoutMode = saved.layoutMode;
    if (saved.scrollMode === "ratio" || saved.scrollMode === "pixels") responsive.scrollMode = saved.scrollMode;
    if (saved.scale === "auto" || (typeof saved.scale === "number" && Number.isFinite(saved.scale) && saved.scale > 0 && saved.scale <= 3)) responsive.scale = saved.scale;
    if (typeof saved.syncScroll === "boolean") responsive.syncScroll = saved.syncScroll;
    if (typeof saved.syncInteractions === "boolean") responsive.syncInteractions = saved.syncInteractions;
    if (Array.isArray(saved.activeDevices)) {
      const ids = new Set<string>();
      const devices = saved.activeDevices.filter((device): device is ActiveDeviceConfig => {
        if (!device || typeof device !== "object" || typeof device.id !== "string" || !device.id || ids.has(device.id) || typeof device.name !== "string" || typeof device.presetKey !== "string" || !Number.isFinite(device.width) || !Number.isFinite(device.height) || device.width < 100 || device.width > 7680 || device.height < 100 || device.height > 7680) return false;
        ids.add(device.id);
        return true;
      }).map((device) => ({ ...device, width: Math.round(device.width), height: Math.round(device.height), rotated: Boolean(device.rotated) }));
      if (devices.length) responsive.activeDevices = devices;
    }
    settings.responsive = responsive;
  }
  return settings;
}

export function loadSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return normalizeSettings(JSON.parse(raw));
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
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeSettings(updated)));
  } catch (err) {
    console.warn("Failed to persist settings:", err);
  }
}

