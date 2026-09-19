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

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function checkProStatus(): Promise<boolean> {
  const data = getStoredLicense();
  if (!data.isPro || !data.licenseKey) return false;

  const isDemo =
    data.licenseKey === "POLAR_PRO_DEMO" || data.licenseKey.startsWith("POLAR_TEST_");

  // If this client was previously granted Pro via the old fallback without a real Polar UUID,
  // automatically upgrade and register the activation with Polar now.
  if (!isDemo && (!data.activationId || !UUID_V4_REGEX.test(data.activationId))) {
    try {
      await activateLicense(data.licenseKey);
      return true;
    } catch (err) {
      console.warn("Legacy license activation upgrade failed:", err);
      saveStoredLicense({ isPro: false, lastVerified: Date.now() });
      return false;
    }
  }

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
    const result = await res.json().catch(() => ({}));
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Network error";
    throw new Error(`Connection to license server failed: ${message}`);
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
  const data = getStoredLicense();
  if (data.licenseKey && data.activationId) {
    try {
      await fetch("/api/license", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "deactivate",
          key: data.licenseKey,
          activationId: data.activationId
        })
      });
    } catch (err) {
      console.warn("Failed to deactivate on server:", err);
    }
  }
  window.localStorage.removeItem(STORAGE_KEY);
  return true;
}

