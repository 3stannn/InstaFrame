import dns from "dns/promises";
import net from "net";

/**
 * Checks whether an IP address belongs to a private, loopback, link-local,
 * or cloud metadata CIDR block (SSRF protection).
 */
export function isPrivateOrBlockedIP(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
      return true; // Invalid format treated as blocked
    }
    // 0.0.0.0/8 (Current network)
    if (parts[0] === 0) return true;
    // 10.0.0.0/8 (Private network)
    if (parts[0] === 10) return true;
    // 127.0.0.0/8 (Loopback)
    if (parts[0] === 127) return true;
    // 169.254.0.0/16 (Link-local, cloud metadata: 169.254.169.254)
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 172.16.0.0/12 (Private network: 172.16.0.0 - 172.31.255.255)
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16 (Private network)
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 255.255.255.255 (Broadcast)
    if (ip === "255.255.255.255") return true;
    return false;
  }

  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    // ::1 / Loopback
    if (lower === "::1" || lower === "0:0:0:0:0:0:0:1") return true;
    // :: / Unspecified
    if (lower === "::" || lower === "0:0:0:0:0:0:0:0") return true;
    // Unique local addresses (fc00::/7 -> fc00... to fdff...)
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
    // Link-local addresses (fe80::/10 -> fe80... to febf...)
    if (
      lower.startsWith("fe8") ||
      lower.startsWith("fe9") ||
      lower.startsWith("fea") ||
      lower.startsWith("feb")
    ) {
      return true;
    }
    // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1)
    if (lower.startsWith("::ffff:")) {
      const ipv4Part = lower.substring(7);
      if (net.isIPv4(ipv4Part)) {
        return isPrivateOrBlockedIP(ipv4Part);
      }
    }
    return false;
  }

  return true; // Unknown/invalid protocol
}

export interface UrlValidationResult {
  safe: boolean;
  error?: string;
  resolvedIp?: string;
  parsedUrl?: URL;
}

/**
 * Validates a target URL against SSRF threats, checking protocol,
 * hostname blocklists, and resolving DNS records to confirm public IP routing.
 */
export async function validateUrlSafe(urlStr: string): Promise<UrlValidationResult> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlStr);
  } catch {
    return { safe: false, error: "Invalid URL syntax" };
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return {
      safe: false,
      error: `Disallowed protocol: ${parsedUrl.protocol}. Only http: and https: are supported.`,
    };
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  // Block private and cloud metadata domain names
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname === "metadata.google.internal" ||
    hostname === "instance-data"
  ) {
    return {
      safe: false,
      error: "Targeting internal or private hostnames is prohibited",
    };
  }

  // If hostname is directly an IP address
  if (net.isIP(hostname)) {
    if (isPrivateOrBlockedIP(hostname)) {
      return {
        safe: false,
        error: `Targeting private or loopback IP (${hostname}) is prohibited`,
      };
    }
    return { safe: true, resolvedIp: hostname, parsedUrl };
  }

  // Resolve hostname via DNS
  try {
    const records = await dns.lookup(hostname, { all: true });
    if (!records || records.length === 0) {
      return { safe: false, error: `DNS resolution failed: no records found for ${hostname}` };
    }

    for (const record of records) {
      if (isPrivateOrBlockedIP(record.address)) {
        return {
          safe: false,
          error: `Domain ${hostname} resolved to private IP (${record.address}). Access prohibited.`,
        };
      }
    }

    return { safe: true, resolvedIp: records[0].address, parsedUrl };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "DNS resolution error";
    return { safe: false, error: `DNS lookup failed for ${hostname}: ${msg}` };
  }
}

/**
 * Executes a network fetch with rigorous SSRF protection:
 * - Validates initial destination
 * - Disables automatic redirects (redirect: "manual")
 * - Validates each redirect hop before following
 * - Enforces timeout and maximum hop limit
 */
export async function safeFetch(
  urlStr: string,
  init?: RequestInit,
  maxHops = 5
): Promise<Response> {
  let currentUrl = urlStr;
  let hops = 0;

  while (hops < maxHops) {
    const validation = await validateUrlSafe(currentUrl);
    if (!validation.safe) {
      throw new Error(`SSRF validation failed: ${validation.error}`);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    let response: Response;
    try {
      response = await fetch(currentUrl, {
        ...init,
        redirect: "manual",
        signal: init?.signal || controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    // Check for 3xx redirect
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) {
        return response; // No location header, return as is
      }

      // Resolve relative redirect URL against current URL
      const nextUrl = new URL(location, currentUrl).toString();
      currentUrl = nextUrl;
      hops++;
      continue;
    }

    return response;
  }

  throw new Error(`Too many redirects (exceeded ${maxHops} hops)`);
}
