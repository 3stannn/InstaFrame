import { NextRequest, NextResponse } from "next/server";
import { validateUrlSafe, safeFetch } from "@/lib/ssrf";

export const dynamic = "force-dynamic";

/**
 * Resolves srcset candidates to absolute URLs
 * e.g. "/img.jpg 1x, /img@2x.jpg 2x" -> "https://yourwebsite.com/img.jpg 1x, https://yourwebsite.com/img@2x.jpg 2x"
 */
function resolveSrcset(srcset: string, baseUrl: URL): string {
  return srcset
    .split(",")
    .map((candidate) => {
      const trimmed = candidate.trim();
      if (!trimmed) return "";
      const parts = trimmed.split(/\s+/);
      const urlPart = parts[0];
      const descriptor = parts.slice(1).join(" ");
      try {
        const resolved = new URL(urlPart, baseUrl).toString();
        return descriptor ? `${resolved} ${descriptor}` : resolved;
      } catch {
        return trimmed;
      }
    })
    .filter(Boolean)
    .join(", ");
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get("url");

  if (!targetUrl) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  // 1. Rigorous SSRF validation against private/loopback/cloud-metadata CIDRs
  const validation = await validateUrlSafe(targetUrl);
  if (!validation.safe || !validation.parsedUrl) {
    return new NextResponse(
      `SSRF validation rejected target: ${validation.error || "Access denied"}`,
      { status: 403 }
    );
  }

  const parsedUrl = validation.parsedUrl;

  try {
    const userAgent =
      request.headers.get("user-agent") ||
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

    // 2. Fetch using safeFetch (enforces manual redirect validation & timeout)
    const upstreamResponse = await safeFetch(parsedUrl.toString(), {
      headers: {
        "User-Agent": userAgent,
        Accept:
          request.headers.get("accept") ||
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": request.headers.get("accept-language") || "en-US,en;q=0.9",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "cross-site",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
      },
    });

    const contentType = upstreamResponse.headers.get("content-type") || "";
    const isHtml = contentType.toLowerCase().includes("text/html");

    if (isHtml) {
      let html = await upstreamResponse.text();

      // Strip restrictive security headers injected as meta tags
      html = html.replace(/<meta[^>]*http-equiv=["']?Content-Security-Policy["']?[^>]*>/gi, "");
      html = html.replace(/\s+crossorigin(=["'][^"']*["'])?/gi, "");
      html = html.replace(/\s+integrity(=["'][^"']*["'])?/gi, "");

      // Strip Apple/enterprise placeholder source tags that hold 1x1 transparent GIFs
      html = html.replace(
        /<source[^>]*data-empty[^>]*srcset=["']data:image\/gif;base64[^"']*["'][^>]*\/?>/gi,
        ""
      );

      // Resolve root-relative srcset attributes to absolute URLs
      html = html.replace(
        /(srcset=["'])([^"']+)(["'])/gi,
        (match, prefix, srcsetVal, suffix) => {
          if (srcsetVal.startsWith("data:")) return match;
          const resolved = resolveSrcset(srcsetVal, parsedUrl);
          return `${prefix}${resolved}${suffix}`;
        }
      );

      // Resolve root-relative CSS url(...) references in inline styles
      html = html.replace(
        /(url\(\s*["']?)(\/[^"')]+)(["']?\s*\))/gi,
        (match, prefix, path, suffix) => {
          if (path.startsWith("//")) return match;
          return `${prefix}${parsedUrl.origin}${path}${suffix}`;
        }
      );

      // Set base tag for relative assets
      const basePath = parsedUrl.pathname.endsWith("/") || parsedUrl.pathname.includes(".")
        ? parsedUrl.pathname
        : `${parsedUrl.pathname}/`;
      const baseTag = `<base href="${parsedUrl.origin}${basePath}" />`;
      const proxyEndpoint = `${request.nextUrl.origin}/api/proxy`;

      // Injected runtime script for:
      // 1. Mobile scrollbar suppression
      // 2. Comprehensive lazy-image hydration (swapping data-src, data-lazy-src, data-original)
      // 3. Scroll & resize listener to trigger IntersectionObservers
      // 4. Safe fetch and XHR proxy interception
      // 5. Intra-frame navigation interception
      // 6. Scroll sync and frame readiness announcement
      const injectedScript = `
        <script>
          (function() {
            var targetOrigin = "${parsedUrl.origin}";
            var targetBase = "${parsedUrl.origin}${parsedUrl.pathname}";
            var proxyEndpoint = "${proxyEndpoint}";

            // 1. Scrollbar suppression
            try {
              var s = document.createElement('style');
              s.id = 'instaframe-web-scrollbar-suppression';
              s.textContent = '::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; } html, body, * { scrollbar-width: none !important; -ms-overflow-style: none !important; }';
              (document.head || document.documentElement).appendChild(s);
            } catch(e) {}

            // 2. Automated Lazy-Image Hydration
            function hydrateLazyImages() {
              try {
                // Remove any lingering empty 1x1 placeholder sources
                var emptySources = document.querySelectorAll('source[data-empty], source[srcset*="data:image/gif"]');
                for (var i = 0; i < emptySources.length; i++) {
                  emptySources[i].remove();
                }

                var imgs = document.querySelectorAll('img');
                for (var j = 0; j < imgs.length; j++) {
                  var img = imgs[j];
                  var realSrc = img.getAttribute('data-src') ||
                                img.getAttribute('data-lazy-src') ||
                                img.getAttribute('data-original') ||
                                img.getAttribute('data-high-res-src');
                  var realSrcset = img.getAttribute('data-srcset') || img.getAttribute('data-lazy-srcset');

                  if (realSrc && (!img.src || img.src.indexOf('data:image/gif') !== -1 || img.naturalWidth === 0)) {
                    img.src = realSrc;
                  }
                  if (realSrcset) {
                    img.srcset = realSrcset;
                  }
                  // Ensure visible opacity for fade-in animations that never finished
                  if (img.style.opacity === '0') {
                    img.style.opacity = '1';
                  }
                }
              } catch(e) {}
            }

            // Hydrate immediately, on DOM ready, and on scroll
            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', hydrateLazyImages);
            } else {
              hydrateLazyImages();
            }
            window.addEventListener('load', hydrateLazyImages);
            window.addEventListener('scroll', hydrateLazyImages, { passive: true });
            setTimeout(hydrateLazyImages, 500);
            setTimeout(hydrateLazyImages, 1500);

            // 3. Intercept fetch to route background requests
            var _origFetch = window.fetch;
            if (_origFetch) {
              window.fetch = function(resource, init) {
                try {
                  var urlStr = null;
                  if (typeof resource === 'string') {
                    urlStr = resource;
                  } else if (resource && typeof resource.url === 'string') {
                    urlStr = resource.url;
                  }
                  if (urlStr && !urlStr.startsWith('data:') && !urlStr.startsWith('blob:')) {
                    var resolved = new URL(urlStr, targetBase).toString();
                    if (resolved.startsWith('http://') || resolved.startsWith('https://')) {
                      if (!resolved.includes('/api/proxy?url=')) {
                        var proxied = proxyEndpoint + '?url=' + encodeURIComponent(resolved);
                        return _origFetch.call(this, proxied, init);
                      }
                    }
                  }
                } catch(err) {}
                return _origFetch.apply(this, arguments);
              };
            }

            // 4. Intercept XMLHttpRequest
            var _origOpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
              try {
                if (typeof url === 'string' && !url.startsWith('data:') && !url.startsWith('blob:')) {
                  var resolved = new URL(url, targetBase).toString();
                  if (resolved.startsWith('http://') || resolved.startsWith('https://')) {
                    if (!resolved.includes('/api/proxy?url=')) {
                      arguments[1] = proxyEndpoint + '?url=' + encodeURIComponent(resolved);
                    }
                  }
                }
              } catch(e) {}
              return _origOpen.apply(this, arguments);
            };

            // 5. Intercept anchor clicks
            document.addEventListener('click', function(e) {
              var el = e.target;
              while (el && el.tagName !== 'A') {
                el = el.parentElement;
              }
              if (el && el.href) {
                try {
                  var resolvedHref = new URL(el.href, targetBase).toString();
                  if (resolvedHref.startsWith('http://') || resolvedHref.startsWith('https://')) {
                    e.preventDefault();
                    window.location.href = proxyEndpoint + '?url=' + encodeURIComponent(resolvedHref);
                  }
                } catch(err) {}
              }
            }, true);

            // 6. Scroll sync & frame ready message
            window.addEventListener('message', function(e) {
              if (e.data && e.data.type === 'INSTAFRAME_SCROLL_BY' && typeof e.data.deltaY === 'number') {
                window.scrollBy({ top: e.data.deltaY, behavior: 'auto' });
              }
            });

            try {
              if (window.parent && window.parent !== window) {
                window.parent.postMessage({ type: 'INSTAFRAME_FRAME_READY', url: "${parsedUrl.toString()}" }, '*');
              }
            } catch(e) {}
          })();
        </script>
      `;

      if (html.includes("<head>")) {
        html = html.replace("<head>", `<head>${baseTag}${injectedScript}`);
      } else if (html.includes("<html>")) {
        html = html.replace("<html>", `<html><head>${baseTag}${injectedScript}</head>`);
      } else {
        html = `<head>${baseTag}${injectedScript}</head>${html}`;
      }

      const response = new NextResponse(html, {
        status: upstreamResponse.status,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS, HEAD",
          "Access-Control-Allow-Headers": "*",
          "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
        },
      });

      response.headers.delete("x-frame-options");
      response.headers.delete("content-security-policy");
      response.headers.delete("content-security-policy-report-only");

      return response;
    }

    // Binary / Asset streaming with appropriate Content-Type and open CORS
    const buffer = await upstreamResponse.arrayBuffer();
    const response = new NextResponse(buffer, {
      status: upstreamResponse.status,
      headers: {
        "Content-Type": contentType || "application/octet-stream",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600",
      },
    });

    response.headers.delete("x-frame-options");
    response.headers.delete("content-security-policy");

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch website";
    const isTimeout =
      message.toLowerCase().includes("abort") || message.toLowerCase().includes("timeout");

    // Fallback card
    const fallbackHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            background-color: #09090b;
            color: #f4f4f5;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 24px;
            text-align: center;
          }
          .card {
            background-color: #18181b;
            border: 1px solid #27272a;
            border-radius: 16px;
            padding: 28px 24px;
            max-width: 440px;
            width: 100%;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
          }
          .icon {
            width: 44px;
            height: 44px;
            margin: 0 auto 16px;
            border-radius: 50%;
            background-color: #27272a;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
          }
          h2 { font-size: 16px; font-weight: 600; margin-bottom: 8px; color: #fff; }
          p { font-size: 13px; color: #a1a1aa; line-height: 1.5; margin-bottom: 20px; word-break: break-all; }
          .btn-group { display: flex; gap: 10px; justify-content: center; }
          button, a {
            font-size: 12px;
            font-weight: 600;
            padding: 8px 16px;
            border-radius: 8px;
            text-decoration: none;
            cursor: pointer;
            transition: all 0.15s;
          }
          .btn-primary {
            background-color: #fff;
            color: #09090b;
            border: none;
          }
          .btn-primary:hover { background-color: #e4e4e7; }
          .btn-secondary {
            background-color: transparent;
            color: #a1a1aa;
            border: 1px solid #3f3f46;
          }
          .btn-secondary:hover { color: #fff; border-color: #71717a; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">⚠️</div>
          <h2>${isTimeout ? "Connection Timed Out" : "Unable to Connect"}</h2>
          <p>${targetUrl}</p>
          <div class="btn-group">
            <button class="btn-primary" onclick="window.location.reload()">Retry Viewport</button>
            <a class="btn-secondary" href="${targetUrl}" target="_blank" rel="noreferrer">Open in New Tab</a>
          </div>
        </div>
        <script>
          if (window.parent && window.parent !== window) {
            window.parent.postMessage({ type: 'INSTAFRAME_FRAME_READY', error: true }, '*');
          }
        </script>
      </body>
      </html>
    `;

    return new NextResponse(fallbackHtml, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
}
