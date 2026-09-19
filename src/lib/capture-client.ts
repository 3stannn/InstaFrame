/**
 * Client-Side Capture Utility & Session Cache
 *
 * Provides safe response parsing (preventing SyntaxError on 504/HTML gateway responses),
 * user-friendly error classification, transfer timing metrics, and in-memory session caching
 * to eliminate duplicate capture requests on cosmetic adjustments.
 */

export interface CaptureRequestParams {
  url: string;
  presetKey?: string;
  customW?: number;
  customH?: number;
  frameId?: string;
  zoomLevel?: number;
  captureFullPage?: boolean;
  captureQuality?: "preview" | "export";
  settleDelay?: number;
  signal?: AbortSignal;
}

export interface CaptureResponseData {
  success: boolean;
  screenshotBase64: string;
  width: number;
  height: number;
  fullHeight: number;
  deviceScaleFactor: number;
}

export interface CaptureResult {
  success: boolean;
  data?: CaptureResponseData;
  error?: string;
  statusCode?: number;
  transferTimeMs: number;
  payloadSizeBytes: number;
  fromCache?: boolean;
}

const sessionCaptureCache = new Map<string, CaptureResponseData>();
const MAX_CACHE_ENTRIES = 20;

/**
 * Builds a deterministic cache key based on capture-affecting parameters.
 */
export function getCaptureCacheKey(params: CaptureRequestParams): string {
  let normalizedUrl = params.url.trim().toLowerCase();
  try {
    const parsed = new URL(normalizedUrl);
    normalizedUrl = parsed.toString();
  } catch {
    // Keep trimmed string if not parseable
  }

  return [
    normalizedUrl,
    params.presetKey || "macbook-air-13",
    params.customW || 1440,
    params.customH || 900,
    params.frameId || "none",
    params.zoomLevel || 100,
    Boolean(params.captureFullPage),
    params.captureQuality || "preview",
    params.settleDelay ?? 1000,
  ].join("::");
}

export function getCachedCapture(cacheKey: string): CaptureResponseData | undefined {
  return sessionCaptureCache.get(cacheKey);
}

export function setCachedCapture(cacheKey: string, data: CaptureResponseData): void {
  if (sessionCaptureCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = sessionCaptureCache.keys().next().value;
    if (oldestKey) sessionCaptureCache.delete(oldestKey);
  }
  sessionCaptureCache.set(cacheKey, data);
}

/**
 * Executes a screenshot capture with safe response handling and metrics.
 */
export async function executeScreenshotCapture(
  params: CaptureRequestParams,
  options?: { skipCache?: boolean }
): Promise<CaptureResult> {
  const cacheKey = getCaptureCacheKey(params);

  if (!options?.skipCache) {
    const cached = getCachedCapture(cacheKey);
    if (cached) {
      return {
        success: true,
        data: cached,
        transferTimeMs: 0,
        payloadSizeBytes: cached.screenshotBase64.length,
        fromCache: true,
      };
    }
  }

  const startTime = typeof performance !== "undefined" ? performance.now() : Date.now();

  try {
    const res = await fetch("/api/screenshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: params.url,
        presetKey: params.presetKey,
        customW: params.customW,
        customH: params.customH,
        frameId: params.frameId,
        zoomLevel: params.zoomLevel,
        captureFullPage: params.captureFullPage,
        captureQuality: params.captureQuality || "preview",
        settleDelay: params.settleDelay ?? 1000,
      }),
      signal: params.signal,
    });

    const elapsedMs = Math.round(
      (typeof performance !== "undefined" ? performance.now() : Date.now()) - startTime
    );

    const contentType = res.headers.get("content-type") || "";
    const isJson = contentType.toLowerCase().includes("application/json");

    if (res.ok && isJson) {
      const data: CaptureResponseData = await res.json();
      if (data && data.screenshotBase64) {
        setCachedCapture(cacheKey, data);
        return {
          success: true,
          data,
          transferTimeMs: elapsedMs,
          payloadSizeBytes: data.screenshotBase64.length,
          fromCache: false,
        };
      }
    }

    // Handle non-OK or non-JSON responses safely
    let errorMessage = "";
    let payloadSize = 0;

    if (isJson) {
      try {
        const errorJson = await res.json();
        errorMessage = errorJson.error || `Capture failed with status ${res.status}`;
      } catch {
        errorMessage = `Capture failed with status ${res.status}`;
      }
    } else {
      const rawText = await res.text().catch(() => "");
      payloadSize = rawText.length;

      if (res.status === 504) {
        errorMessage =
          "The website capture timed out. The destination page took too long to load or respond.";
      } else if (res.status === 502) {
        errorMessage =
          "The screenshot service could not connect to the remote browser or destination website.";
      } else if (res.status === 503) {
        errorMessage =
          "The screenshot service is currently unavailable in this environment.";
      } else if (res.status === 403) {
        errorMessage =
          "Security check rejected URL: Internal or restricted network addresses cannot be captured.";
      } else if (res.status === 400) {
        errorMessage =
          rawText.length > 0 && rawText.length < 200
            ? rawText
            : "Invalid capture request parameters or oversized capture.";
      } else {
        errorMessage = `The server returned an unexpected response (HTTP ${res.status}).`;
      }
    }

    return {
      success: false,
      error: errorMessage,
      statusCode: res.status,
      transferTimeMs: elapsedMs,
      payloadSizeBytes: payloadSize,
      fromCache: false,
    };
  } catch (err: unknown) {
    const elapsedMs = Math.round(
      (typeof performance !== "undefined" ? performance.now() : Date.now()) - startTime
    );

    if (err instanceof Error && err.name === "AbortError") {
      return {
        success: false,
        error: "Capture request was cancelled.",
        transferTimeMs: elapsedMs,
        payloadSizeBytes: 0,
      };
    }

    const msg = err instanceof Error ? err.message : "Network communication error";
    return {
      success: false,
      error: `Network error: ${msg}. Please verify your connection.`,
      transferTimeMs: elapsedMs,
      payloadSizeBytes: 0,
    };
  }
}
