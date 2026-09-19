/**
 * Licensing & State Machine for Polar.sh (Web Native)
 */

export interface LicenseState {
  isPro: boolean;
  licenseKey: string | null;
  activationId: string | null;
  lastVerified: number | null;
}

const STORAGE_KEY = "instaframe_license_state";
const DAY_MS = 24 * 60 * 60 * 1000;

export function getStoredLicense(): LicenseState {
  if (typeof window === "undefined") {
    return { isPro: false, licenseKey: null, activationId: null, lastVerified: null };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { isPro: false, licenseKey: null, activationId: null, lastVerified: null };
    return JSON.parse(raw);
  } catch {
    return { isPro: false, licenseKey: null, activationId: null, lastVerified: null };
  }
}

export function saveStoredLicense(state: Partial<LicenseState>): void {
  if (typeof window === "undefined") return;
  try {
    const current = getStoredLicense();
    const updated = { ...current, ...state };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("Failed to persist license:", err);
  }
}

export async function getOrSetInstanceId(): Promise<string> {
  if (typeof window === "undefined") return "inst_ssr";
  let instanceId = window.localStorage.getItem("instaframe_instance_id");
  if (!instanceId) {
    instanceId = `inst_${crypto.randomUUID()}`;
    window.localStorage.setItem("instaframe_instance_id", instanceId);
  }
  return instanceId;
}

export async function checkProStatus(): Promise<boolean> {
  const data = getStoredLicense();
  if (!data.isPro || !data.licenseKey) return false;

  // Cached verification window (fast startup)
  if (data.lastVerified && Date.now() - data.lastVerified < DAY_MS) {
    return true;
  }

  // Periodic network verification
  try {
    const res = await fetch("/api/license", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "validate",
        key: data.licenseKey,
        activationId: data.activationId
      })
    });
    const result = await res.json();
    const active = res.ok && result.valid === true;

    saveStoredLicense({ isPro: active, lastVerified: Date.now() });
    return active;
  } catch {
    // Offline grace period
    return !!data.isPro;
  }
}

export async function activateLicense(licenseKey: string): Promise<boolean> {
  const cleanKey = licenseKey.trim();
  if (!cleanKey) {
    throw new Error("Please enter a valid license key.");
  }

  const instanceId = await getOrSetInstanceId();

  let res: Response;
  try {
    res = await fetch("/api/license", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "activate",
        key: cleanKey,
        instanceId
      })
    });
  } catch (err: any) {
    throw new Error(`Connection to license server failed: ${err.message}`);
  }

  const body = await res.json().catch(() => ({}));

  if (res.status === 429) {
    throw new Error("Too many attempts. Please wait 1 minute before trying again.");
  }
  if (!res.ok || !body.success) {
    throw new Error(body.error || "License activation failed. Please check your key.");
  }

  saveStoredLicense({
    isPro: true,
    licenseKey: cleanKey,
    activationId: body.activationId,
    lastVerified: Date.now()
  });

  return true;
}

export async function deactivateLicense(): Promise<boolean> {
  if (typeof window === "undefined") return true;
  window.localStorage.removeItem(STORAGE_KEY);
  return true;
}
