/**
 * URL Validation and Sanitization for Responsive Preview Engine
 *
 * Enforces browser security boundaries:
 * - Only HTTP and HTTPS schemes are supported.
 * - Disallows executable and unsupported schemes (javascript:, data:, file:, blob:).
 * - Detects mixed-content restrictions when embedding HTTP targets inside HTTPS viewers.
 * - Detects and redacts credentials/sensitive tokens before localStorage persistence.
 */

export interface UrlValidationResult {
  isValid: boolean;
  normalizedUrl: string;
  error?: string;
  isMixedContent?: boolean;
  hasCredentials?: boolean;
  hasSensitiveParams?: boolean;
  sanitizedForStorage?: string;
}

const SENSITIVE_PARAM_NAMES = new Set([
  "token",
  "access_token",
  "id_token",
  "refresh_token",
  "auth",
  "auth_token",
  "key",
  "apikey",
  "api_key",
  "password",
  "pass",
  "secret",
  "sig",
  "signature",
  "jwt",
  "bearer",
]);

/**
 * Normalizes user input and validates against allowable schemes.
 */
export function sanitizeAndValidateUrl(
  input: string,
  viewerOrigin?: string
): UrlValidationResult {
  const trimmed = (input || "").trim();

  if (!trimmed) {
    return {
      isValid: false,
      normalizedUrl: "",
      error: "Please enter a target URL",
    };
  }

  // Reject explicitly dangerous schemes early
  const lowerTrimmed = trimmed.toLowerCase();
  if (
    lowerTrimmed.startsWith("javascript:") ||
    lowerTrimmed.startsWith("data:") ||
    lowerTrimmed.startsWith("file:") ||
    lowerTrimmed.startsWith("blob:") ||
    lowerTrimmed.startsWith("vbscript:")
  ) {
    return {
      isValid: false,
      normalizedUrl: trimmed,
      error: `Unsupported scheme: "${trimmed.split(":")[0]}:". Only HTTP and HTTPS websites can be previewed.`,
    };
  }

  // Prepend scheme if missing
  let candidate = trimmed;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(candidate)) {
    // If hostname starts with localhost or 127.0.0.1, default to http://, otherwise https://
    if (
      candidate.startsWith("localhost") ||
      candidate.startsWith("127.0.0.1") ||
      candidate.startsWith("0.0.0.0")
    ) {
      candidate = `http://${candidate}`;
    } else {
      candidate = `https://${candidate}`;
    }
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return {
      isValid: false,
      normalizedUrl: trimmed,
      error: "Invalid URL format. Please check the hostname and try again.",
    };
  }

  // Enforce HTTP / HTTPS protocol only
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      isValid: false,
      normalizedUrl: candidate,
      error: `Disallowed protocol "${parsed.protocol}". Only HTTP and HTTPS websites are supported.`,
    };
  }

  // Detect credentials in URL
  const hasCredentials = Boolean(parsed.username || parsed.password);

  // Check for sensitive query parameters
  let hasSensitiveParams = false;
  parsed.searchParams.forEach((_, key) => {
    if (SENSITIVE_PARAM_NAMES.has(key.toLowerCase())) {
      hasSensitiveParams = true;
    }
  });

  // Check mixed content
  let isMixedContent = false;
  if (typeof window !== "undefined") {
    const currentProtocol = window.location.protocol;
    if (currentProtocol === "https:" && parsed.protocol === "http:") {
      isMixedContent = true;
    }
  } else if (viewerOrigin) {
    try {
      const viewerUrl = new URL(viewerOrigin);
      if (viewerUrl.protocol === "https:" && parsed.protocol === "http:") {
        isMixedContent = true;
      }
    } catch {}
  }

  // Build sanitized URL for persistence (strip credentials and sensitive query params)
  const storageUrl = new URL(parsed.toString());
  if (hasCredentials) {
    storageUrl.username = "";
    storageUrl.password = "";
  }
  if (hasSensitiveParams) {
    const keysToDelete: string[] = [];
    storageUrl.searchParams.forEach((_, key) => {
      if (SENSITIVE_PARAM_NAMES.has(key.toLowerCase())) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach((key) => storageUrl.searchParams.delete(key));
  }

  return {
    isValid: true,
    normalizedUrl: parsed.toString(),
    isMixedContent,
    hasCredentials,
    hasSensitiveParams,
    sanitizedForStorage: storageUrl.toString(),
  };
}

/**
 * Returns true if a URL is safe to persist in localStorage without leaking credentials.
 */
export function isSafeToPersist(url: string): boolean {
  const result = sanitizeAndValidateUrl(url);
  return result.isValid && !result.hasCredentials && !result.hasSensitiveParams;
}
