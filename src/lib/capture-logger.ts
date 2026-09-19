/**
 * Structured Logger for Capture Pipeline
 *
 * Provides request-scoped stage timings, sanitized diagnostic logging,
 * and failure classification without leaking sensitive URL query parameters,
 * credentials, endpoint tokens, or screenshot payload data.
 */

export type CaptureStage =
  | "validation"
  | "backend_resolution"
  | "launch_connect"
  | "context_page_setup"
  | "navigation"
  | "readiness"
  | "scrolling"
  | "screenshot_encode"
  | "response_prep"
  | "cleanup";

export type FailureClassification =
  | "VALIDATION_ERROR"
  | "SSRF_BLOCKED"
  | "ENDPOINT_INVALID"
  | "BROWSER_UNAVAILABLE"
  | "CONNECT_TIMEOUT"
  | "NAVIGATION_TIMEOUT"
  | "NAVIGATION_FAILED"
  | "OVERSIZED_CAPTURE"
  | "EXECUTION_TIMEOUT"
  | "INTERNAL_ERROR";

export type BrowserBackend =
  | "remote-ws"
  | "local-chrome"
  | "sparticuz-chromium"
  | "unresolved";

export interface CaptureLoggerOptions {
  url: string;
  presetKey: string;
  quality: "preview" | "export";
  captureFullPage: boolean;
}

export interface StageTiming {
  stage: CaptureStage;
  startTime: number;
  endTime?: number;
  durationMs?: number;
}

/**
 * Sanitizes a URL for safe diagnostic logging:
 * - Redacts username/password
 * - Redacts query parameters
 */
export function sanitizeUrlForLogging(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    parsed.username = "";
    parsed.password = "";
    if (parsed.search) {
      parsed.search = "?[redacted]";
    }
    return parsed.toString();
  } catch {
    // If not a valid URL, return only the domain or a generic placeholder
    return "[invalid-url-redacted]";
  }
}

export class CaptureLogger {
  readonly requestId: string;
  readonly sanitizedUrl: string;
  readonly presetKey: string;
  readonly quality: "preview" | "export";
  readonly captureFullPage: boolean;

  private backend: BrowserBackend = "unresolved";
  private stages: Map<CaptureStage, StageTiming> = new Map();
  private activeStage: CaptureStage | null = null;
  private readonly startTime: number;

  constructor(options: CaptureLoggerOptions) {
    this.startTime = Date.now();
    this.requestId = `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    this.sanitizedUrl = sanitizeUrlForLogging(options.url);
    this.presetKey = options.presetKey;
    this.quality = options.quality;
    this.captureFullPage = options.captureFullPage;

    this.log("CAPTURE_INIT", {
      requestId: this.requestId,
      url: this.sanitizedUrl,
      preset: this.presetKey,
      quality: this.quality,
      fullPage: this.captureFullPage,
    });
  }

  setBackend(backend: BrowserBackend) {
    this.backend = backend;
    this.log("BACKEND_RESOLVED", { backend });
  }

  getBackend(): BrowserBackend {
    return this.backend;
  }

  getActiveStage(): CaptureStage | null {
    return this.activeStage;
  }

  startStage(stage: CaptureStage) {
    const now = Date.now();
    this.activeStage = stage;
    this.stages.set(stage, {
      stage,
      startTime: now,
    });
    this.log(`STAGE_START:${stage}`, {
      elapsedSinceInitMs: now - this.startTime,
    });
  }

  endStage(stage: CaptureStage) {
    const timing = this.stages.get(stage);
    const now = Date.now();
    if (timing) {
      timing.endTime = now;
      timing.durationMs = now - timing.startTime;
      this.log(`STAGE_END:${stage}`, {
        durationMs: timing.durationMs,
        elapsedSinceInitMs: now - this.startTime,
      });
    }
    if (this.activeStage === stage) {
      this.activeStage = null;
    }
  }

  fail(
    classification: FailureClassification,
    error: unknown,
    statusCode: number
  ) {
    const now = Date.now();
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    this.log("CAPTURE_FAILED", {
      classification,
      statusCode,
      lastActiveStage: this.activeStage,
      totalElapsedMs: now - this.startTime,
      errorSummary: errorMessage.slice(0, 300),
    });
  }

  complete(metrics: {
    width: number;
    height: number;
    fullHeight: number;
    deviceScaleFactor: number;
    payloadSizeBytes: number;
  }) {
    const now = Date.now();
    const stageSummary: Record<string, number> = {};
    for (const [stage, timing] of this.stages.entries()) {
      if (timing.durationMs !== undefined) {
        stageSummary[stage] = timing.durationMs;
      }
    }

    this.log("CAPTURE_SUCCESS", {
      backend: this.backend,
      quality: this.quality,
      totalElapsedMs: now - this.startTime,
      metrics,
      stageDurationsMs: stageSummary,
    });
  }

  private log(event: string, details: Record<string, unknown>) {
    // Structured JSON log line for observability
    const entry = {
      timestamp: new Date().toISOString(),
      service: "instaframe-capture",
      requestId: this.requestId,
      event,
      ...details,
    };
    console.log(`[Capture] ${JSON.stringify(entry)}`);
  }
}
