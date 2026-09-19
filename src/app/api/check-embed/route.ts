import { NextRequest, NextResponse } from "next/server";
import { validateUrlSafe, safeFetch } from "@/lib/ssrf";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get("url");

  if (!targetUrl) {
    return NextResponse.json({ canEmbed: false, error: "Missing url parameter" }, { status: 400 });
  }

  const validation = await validateUrlSafe(targetUrl);
  if (!validation.safe) {
    return NextResponse.json(
      { canEmbed: false, error: validation.error || "Security validation rejected target URL" },
      { status: 403 }
    );
  }

  try {
    const userAgent =
      request.headers.get("user-agent") ||
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

    // Request headers to probe framing restrictions
    const response = await safeFetch(targetUrl, {
      method: "GET",
      headers: {
        "User-Agent": userAgent,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    const xFrameOptions = (response.headers.get("x-frame-options") || "").toLowerCase().trim();
    const csp = (response.headers.get("content-security-policy") || "").toLowerCase();

    // Check X-Frame-Options
    if (xFrameOptions.includes("deny")) {
      return NextResponse.json({
        canEmbed: false,
        isRestricted: true,
        reason: "Prohibited by X-Frame-Options: DENY",
        targetUrl,
      });
    }

    if (xFrameOptions.includes("sameorigin")) {
      return NextResponse.json({
        canEmbed: false,
        isRestricted: true,
        reason: "Prohibited by X-Frame-Options: SAMEORIGIN",
        targetUrl,
      });
    }

    // Check CSP frame-ancestors
    if (csp.includes("frame-ancestors")) {
      const match = csp.match(/frame-ancestors\s+([^;]+)/);
      if (match) {
        const policy = match[1].trim();
        // If policy is 'none', 'self', or specifies specific origins that don't allow wildcard
        if (policy === "'none'" || policy === "'self'" || !policy.includes("*")) {
          return NextResponse.json({
            canEmbed: false,
            isRestricted: true,
            reason: `Prohibited by CSP frame-ancestors (${policy})`,
            targetUrl,
          });
        }
      }
    }

    return NextResponse.json({
      canEmbed: true,
      isRestricted: false,
      targetUrl,
      status: response.status,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Probe request failed";
    return NextResponse.json({
      canEmbed: true,
      isRestricted: false,
      reason: `Could not verify framing support: ${msg}`,
      targetUrl,
    });
  }
}
