import dns from "dns/promises";
import net from "net";

/**
 * Checks whether an IP address belongs to a private, loopback, link-local,
 * or cloud metadata CIDR block (SSRF protection).
 */
/**
 * Checks whether an IP address belongs to a private, loopback, link-local,
 * CGNAT, benchmarking, documentation, or cloud metadata CIDR block (SSRF protection).
 */
export function isPrivateOrBlockedIP(ip: string): boolean {
  // Strip brackets if IPv6 is enclosed in brackets, e.g. "[::1]"
  const cleanIp = ip.startsWith("[") && ip.endsWith("]") ? ip.slice(1, -1) : ip;

  if (net.isIPv4(cleanIp)) {
    const parts = cleanIp.split(".").map(Number);
    if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
      return true; // Invalid format treated as blocked
    }
    // 0.0.0.0/8 (Current network)
    if (parts[0] === 0) return true;
    // 10.0.0.0/8 (Private network)
    if (parts[0] === 10) return true;
    // 100.64.0.0/10 (Shared Address Space / CGNAT: 100.64.0.0 - 100.127.255.255)
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
    // 127.0.0.0/8 (Loopback)
    if (parts[0] === 127) return true;
    // 169.254.0.0/16 (Link-local, cloud metadata: 169.254.169.254)
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 172.16.0.0/12 (Private network: 172.16.0.0 - 172.31.255.255)
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.0.0.0/24 (IETF Protocol Assignments)
    if (parts[0] === 192 && parts[1] === 0 && parts[2] === 0) return true;
    // 192.0.2.0/24 (TEST-NET-1 documentation)
    if (parts[0] === 192 && parts[1] === 0 && parts[2] === 2) return true;
    // 192.168.0.0/16 (Private network)
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 198.18.0.0/15 (Network benchmark tests: 198.18.0.0 - 198.19.255.255)
    if (parts[0] === 198 && (parts[1] === 18 || parts[1] === 19)) return true;
    // 198.51.100.0/24 (TEST-NET-2 documentation)
    if (parts[0] === 198 && parts[1] === 51 && parts[2] === 100) return true;
    // 203.0.113.0/24 (TEST-NET-3 documentation)
    if (parts[0] === 203 && parts[1] === 0 && parts[2] === 113) return true;
    // 224.0.0.0/4 (Multicast: 224.0.0.0 - 239.255.255.255)
    if (parts[0] >= 224 && parts[0] <= 239) return true;
    // 240.0.0.0/4 (Reserved: 240.0.0.0 - 255.255.255.254)
    if (parts[0] >= 240) return true;
    // 255.255.255.255 (Broadcast)
    if (cleanIp === "255.255.255.255") return true;

    // Alibaba Cloud Metadata IP
    if (cleanIp === "100.100.100.200") return true;

    return false;
  }

  if (net.isIPv6(cleanIp)) {
    const lower = cleanIp.toLowerCase();
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
    // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1 or ::ffff:7f00:1)
    if (lower.startsWith("::ffff:")) {
      const ipv4Part = lower.substring(7);
      if (net.isIPv4(ipv4Part)) {
        return isPrivateOrBlockedIP(ipv4Part);
      }
      // Hex-formatted IPv4 mapped into IPv6
      return true;
    }
    // IPv4/IPv6 translation (64:ff9b::/96)
    if (lower.startsWith("64:ff9b::")) return true;
    // Documentation prefix (2001:db8::/32)
    if (lower.startsWith("2001:db8:") || lower.startsWith("2001:0db8:")) return true;

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
 * hostname blocklists, bracketed IPs, and resolving DNS records to confirm public IP routing.
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
  const cleanHost = hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;

  // Block private and cloud metadata domain names
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname === "metadata.google.internal" ||
    hostname === "instance-data" ||
    hostname === "metadata" ||
    hostname === "169.254.169.254" ||
    hostname === "100.100.100.200"
  ) {
    return {
      safe: false,
      error: "Targeting internal or private hostnames is prohibited",
    };
  }

  // If hostname is directly an IP address (IPv4 or IPv6)
  if (net.isIP(cleanHost)) {
    if (isPrivateOrBlockedIP(cleanHost)) {
      return {
        safe: false,
        error: `Targeting private or loopback IP (${cleanHost}) is prohibited`,
      };
    }
    return { safe: true, resolvedIp: cleanHost, parsedUrl };
  }

  // Resolve hostname via DNS
  try {
    const records = await dns.lookup(cleanHost, { all: true });
    if (!records || records.length === 0) {
      return { safe: false, error: `DNS resolution failed: no records found for ${cleanHost}` };
    }

    for (const record of records) {
      if (isPrivateOrBlockedIP(record.address)) {
        return {
          safe: false,
          error: `Domain ${cleanHost} resolved to private IP (${record.address}). Access prohibited.`,
        };
      }
    }

    return { safe: true, resolvedIp: records[0].address, parsedUrl };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "DNS resolution error";
    return { safe: false, error: `DNS lookup failed for ${cleanHost}: ${msg}` };
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
