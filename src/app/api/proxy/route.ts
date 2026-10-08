import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { escapeHtml, scriptString } from "@/lib/proxy-utils";
import { validateUrlSafe, safeFetch } from "@/lib/ssrf";
import { previewAssetUrl, rewritePreviewCss, rewritePreviewModule } from "@/lib/preview-assets";

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

async function handlePreview(request: NextRequest) {
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

  let parsedUrl = validation.parsedUrl;
  const previewOrigin = new URL(`${request.nextUrl.protocol}//${request.headers.get("host") || request.nextUrl.host}`).origin;
  const proxyEndpoint = `${previewOrigin}/api/proxy`;

  try {
    const requestBody = request.method === "POST" ? await request.text() : undefined;
    if (requestBody && Buffer.byteLength(requestBody) > 1024 * 1024) {
      return new NextResponse("Preview request is too large", { status: 413 });
    }
    const userAgent =
      request.headers.get("user-agent") ||
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

    // 2. Fetch using safeFetch (enforces manual redirect validation & timeout)
    const upstreamResponse = await safeFetch(parsedUrl.toString(), {
      method: request.method,
      ...(requestBody !== undefined ? { body: requestBody } : {}),
      headers: {
        ...(request.headers.get("content-type") ? { "Content-Type": request.headers.get("content-type")! } : {}),
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

    const requestedHash = parsedUrl.hash;
    if (upstreamResponse.url) parsedUrl = new URL(upstreamResponse.url);
    if (!parsedUrl.hash) parsedUrl.hash = requestedHash;
    const contentType = upstreamResponse.headers.get("content-type") || "";
    const isHtml = /text\/html|application\/xhtml\+xml/i.test(contentType);

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

      // Strip common local development hot-reload and live-reload scripts to prevent WebSocket errors
      html = html.replace(
        /<script[^>]*src=["'][^"']*(?:@vite\/client|livereload\.js|webpack-dev-server)[^"']*["'][^>]*><\/script>/gi,
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
      const baseTag = `<base href="${escapeHtml(parsedUrl.toString())}" />`;
      // Existing base tags must not override the upstream page location.
      html = html.replace(/<base\b[^>]*>/gi, "");
      // Next may normalize the hostname to localhost; use the browser's host.
      html = html.replace(/<(script|link)\b[^>]*>/gi, tag => tag.replace(/\b(src|href)=(["'])([^"']+)\2/gi,
        (_, attribute, quote, value) => `${attribute}=${quote}${escapeHtml(previewAssetUrl(value.replace(/&amp;/g, "&"), parsedUrl.href, proxyEndpoint))}${quote}`));
      html = html.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (_, attrs, css) => `<style${attrs}>${rewritePreviewCss(css, parsedUrl.href, proxyEndpoint)}</style>`);
      html = html.replace(/<script\b([^>]*type=["']module["'][^>]*)>([\s\S]*?)<\/script>/gi, (_, attrs, source) => `<script${attrs}>${rewritePreviewModule(source, parsedUrl.href, proxyEndpoint)}</script>`);
      const bridgeSource = await readFile(path.join(process.cwd(), "public", "preview-bridge.js"), "utf8");
      // Inline the bridge so opaque-origin previews also work on localhost.
      const bridgeTag = `<script data-allowed-origins="${escapeHtml(previewOrigin)}">${bridgeSource.replace(/<\/script/gi, "<\\/script")}</script>`;

      // Injected runtime script for:
      // 1. Mobile scrollbar suppression
      // 2. Comprehensive lazy-image hydration (swapping data-src, data-lazy-src, data-original)
      // 3. Scroll & resize listener to trigger IntersectionObservers
      // 4. Fetch and XHR proxy interception for public page data
      // 5. Intra-frame navigation interception
      // 6. Scroll sync and frame readiness announcement
      const injectedScript = `
        <script>
          (function() {
            var targetOrigin = ${scriptString(parsedUrl.origin)};
            var targetBase = ${scriptString(parsedUrl.toString())};
            var proxyEndpoint = ${scriptString(proxyEndpoint)};
            window.__INSTAFRAME_TARGET_URL__ = targetBase;
            var previewLocation = {};
            function navigatePreview(value) {
              window.location.href = proxyEndpoint + '?url=' + encodeURIComponent(new URL(value, window.__INSTAFRAME_TARGET_URL__).href);
            }
            ['href', 'pathname', 'search', 'hash', 'origin', 'host', 'hostname', 'protocol', 'port'].forEach(function(key) {
              Object.defineProperty(previewLocation, key, { get: function() { return new URL(window.__INSTAFRAME_TARGET_URL__)[key]; },
                set: function(value) { var next = new URL(window.__INSTAFRAME_TARGET_URL__); next[key] = value; navigatePreview(next.href); } });
            });
            previewLocation.assign = navigatePreview;
            previewLocation.replace = navigatePreview;
            previewLocation.reload = function() { window.location.reload(); };
            previewLocation.toString = function() { return previewLocation.href; };
            window.__INSTAFRAME_LOCATION__ = previewLocation;
            window.__INSTAFRAME_READ_LOCATION__ = function(value) {
              return value === window || value === document ? previewLocation : value.location;
            };
            function assetAddress(value) {
              value = String(value).replace(new RegExp('^/(https?://)'), '$1');
              var proxyIndex = value.indexOf(proxyEndpoint + '?');
              if (proxyIndex >= 0) return value.slice(proxyIndex);
              if (value.indexOf(proxyEndpoint + '?') === 0 || /^(data:|blob:)/.test(value)) return value;
              return proxyEndpoint + '?asset=1&url=' + encodeURIComponent(new URL(value, targetBase).href);
            }
            [[HTMLScriptElement.prototype, 'src'], [HTMLLinkElement.prototype, 'href']].forEach(function(entry) {
              var descriptor = Object.getOwnPropertyDescriptor(entry[0], entry[1]);
              if (descriptor && descriptor.set) Object.defineProperty(entry[0], entry[1], Object.assign({}, descriptor, {
                set: function(value) { descriptor.set.call(this, assetAddress(value)); }
              }));
            });
            var originalAttribute = Element.prototype.setAttribute;
            Element.prototype.setAttribute = function(name, value) {
              if ((this.tagName === 'SCRIPT' && name.toLowerCase() === 'src') || (this.tagName === 'LINK' && name.toLowerCase() === 'href')) value = assetAddress(value);
              return originalAttribute.call(this, name, value);
            };
            ['pushState', 'replaceState'].forEach(function(method) {
              var original = history[method];
              history[method] = function(state, title, url) {
                if (url != null) window.__INSTAFRAME_TARGET_URL__ = new URL(url, window.__INSTAFRAME_TARGET_URL__).href;
                return original.call(history, Object.assign({}, state, { __instaframe_url: window.__INSTAFRAME_TARGET_URL__ }), title);
              };
            });
            window.addEventListener('popstate', function(event) {
              if (event.state && event.state.__instaframe_url) window.__INSTAFRAME_TARGET_URL__ = event.state.__instaframe_url;
            });

            // Keep website storage isolated while supporting scripts that expect it.
            // Opaque sandbox origins cannot access the browser's cookie/storage APIs.
            var previewCookies = '';
            try { document.cookie; } catch(e) {
              Object.defineProperty(document, 'cookie', { configurable: true,
                get: function() { return previewCookies; },
                set: function(value) {
                  var pair = String(value).split(';')[0];
                  var name = pair.split('=')[0];
                  previewCookies = previewCookies.split('; ').filter(function(item) { return item && item.split('=')[0] !== name; }).concat(pair).join('; ');
                }
              });
            }
            ['localStorage', 'sessionStorage'].forEach(function(key) {
              try { window[key].getItem('instaframe-storage-check'); } catch(e) {
                var values = Object.create(null);
                var storage = { getItem: function(k) { return Object.prototype.hasOwnProperty.call(values, k) ? values[k] : null; },
                  setItem: function(k, v) { values[String(k)] = String(v); },
                  removeItem: function(k) { delete values[k]; }, clear: function() { values = Object.create(null); },
                  key: function(i) { return Object.keys(values)[i] || null; } };
                Object.defineProperty(storage, 'length', { get: function() { return Object.keys(values).length; } });
                Object.defineProperty(window, key, { configurable: true, value: storage });
              }
            });

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

            // 3. Load background page data without forwarding studio credentials.
            var _origFetch = window.fetch;
            if (_origFetch) {
              window.fetch = function(resource, init) {
                try {
                  var method = (init && init.method ? init.method : resource && resource.method || 'GET').toUpperCase();
                  if (method !== 'GET' && method !== 'HEAD' && method !== 'POST') {
                    return _origFetch.apply(this, arguments);
                  }
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
                        var options = Object.assign({}, init, { credentials: 'omit', mode: 'cors' });
                        return _origFetch.call(this, resource instanceof Request ? new Request(proxied, resource) : proxied, options);
                      }
                    }
                  }
                } catch(err) {}
                return _origFetch.apply(this, arguments);
              };
            }

            // 4. Intercept XMLHttpRequest for supported page-data methods.
            var _origOpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
              try {
                var m = (method || 'GET').toUpperCase();
                if (m === 'GET' || m === 'HEAD' || m === 'POST') {
                  if (typeof url === 'string' && !url.startsWith('data:') && !url.startsWith('blob:')) {
                    var resolved = new URL(url, targetBase).toString();
                    if (resolved.startsWith('http://') || resolved.startsWith('https://')) {
                      if (!resolved.includes('/api/proxy?url=')) {
                        arguments[1] = proxyEndpoint + '?url=' + encodeURIComponent(resolved);
                      }
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
              if (el && el.href && !e.defaultPrevented && e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !el.hasAttribute('download')) {
                try {
                  var resolvedHref = new URL(el.href, targetBase).toString();
                  var destination = new URL(resolvedHref);
                  var current = new URL(window.__INSTAFRAME_TARGET_URL__ || targetBase);
                  if (destination.origin === current.origin && destination.pathname === current.pathname && destination.search === current.search && destination.hash) {
                    e.preventDefault();
                    window.__INSTAFRAME_TARGET_URL__ = resolvedHref;
                    window.location.hash = destination.hash;
                    return;
                  }
                  if (resolvedHref.startsWith('http://') || resolvedHref.startsWith('https://')) {
                    e.preventDefault();
                    window.location.href = proxyEndpoint + '?url=' + encodeURIComponent(resolvedHref);
                  }
                } catch(err) {}
              }
            }, true);

            // Honor anchors when the original URL includes a fragment.
            document.addEventListener('DOMContentLoaded', function() {
              try {
                var fragment = new URL(targetBase).hash;
                if (fragment) document.getElementById(decodeURIComponent(fragment.slice(1)))?.scrollIntoView();
              } catch(e) {}
            });

            // 6. Scroll sync & frame ready message
            window.addEventListener('message', function(e) {
              if (e.data && e.data.type === 'INSTAFRAME_SCROLL_BY' && typeof e.data.deltaY === 'number') {
                window.scrollBy({ top: e.data.deltaY, behavior: 'auto' });
              }
            });

            try {
              if (window.parent && window.parent !== window) {
                window.parent.postMessage({ type: 'INSTAFRAME_FRAME_READY', url: ${scriptString(parsedUrl.toString())} }, '*');
              }
            } catch(e) {}
          })();
        </script>
      `;

      if (/<head\b[^>]*>/i.test(html)) {
        html = html.replace(/<head\b[^>]*>/i, (head) => `${head}${baseTag}${injectedScript}${bridgeTag}`);
      } else if (/<html\b[^>]*>/i.test(html)) {
        html = html.replace(/<html\b[^>]*>/i, (tag) => `${tag}<head>${baseTag}${injectedScript}${bridgeTag}</head>`);
      } else {
        html = `<head>${baseTag}${injectedScript}${bridgeTag}</head>${html}`;
      }

      const response = new NextResponse(html, {
        status: upstreamResponse.status,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Security-Policy": "sandbox allow-scripts allow-forms allow-popups",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS, HEAD",
          "Access-Control-Allow-Headers": "*",
          "Cache-Control": "no-store",
        },
      });

      response.headers.delete("x-frame-options");
      response.headers.delete("content-security-policy-report-only");

      return response;
    }

    // Binary / Asset streaming with appropriate Content-Type and open CORS
    const buffer = /text\/css/i.test(contentType)
      ? rewritePreviewCss(await upstreamResponse.text(), parsedUrl.href, proxyEndpoint)
      : /(?:javascript|ecmascript)/i.test(contentType)
        ? rewritePreviewModule(await upstreamResponse.text(), parsedUrl.href, proxyEndpoint)
        : await upstreamResponse.arrayBuffer();
    const response = new NextResponse([204, 205, 304].includes(upstreamResponse.status) ? null : buffer, {
      status: upstreamResponse.status,
      headers: {
        "Content-Type": contentType || "application/octet-stream",
        "Content-Security-Policy": "sandbox allow-scripts allow-forms allow-popups",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Private-Network": "true",
        "Cache-Control": "no-store",
      },
    });

    response.headers.delete("x-frame-options");


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
          <p>${escapeHtml(targetUrl)}</p>
          <div class="btn-group">
            <button class="btn-primary" onclick="window.location.reload()">Retry Viewport</button>
            <a class="btn-secondary" href="${escapeHtml(targetUrl)}" target="_blank" rel="noreferrer">Open in New Tab</a>
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
          "Content-Security-Policy": "sandbox allow-scripts allow-forms allow-popups",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
}

export const GET = handlePreview;
export const POST = handlePreview;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Private-Network": "true",
  } });
}
