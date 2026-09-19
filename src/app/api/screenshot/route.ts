import { NextRequest, NextResponse } from "next/server";
import puppeteer, { Browser, BrowserContext, Page } from "puppeteer-core";
import fs from "fs";
import os from "os";
import path from "path";
import net from "net";
import { DEVICE_PRESETS } from "@/lib/devices";
import { validateUrlSafe, isPrivateOrBlockedIP } from "@/lib/ssrf";
import {
  CaptureLogger,
  FailureClassification,
  BrowserBackend,
} from "@/lib/capture-logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Reserve 10 seconds for safe cleanup and structured error response within 60s maxDuration
const TOTAL_OPERATION_BUDGET_MS = 50000;
const MAX_TOTAL_PIXELS = 35_000_000; // ~35 megapixels budget before OOM/payload overflow
const MAX_FULL_PAGE_HEIGHT = 16384; // 16K px max full-page height

function getLocalChromePath(): string | null {
  const localAppData = process.env.LOCALAPPDATA || "";
  const programFiles = process.env.ProgramFiles || "C:\\Program Files";
  const programFilesX86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";

  const possiblePaths = [
    process.env.CHROME_PATH,
    path.join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
    path.join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
    localAppData ? path.join(localAppData, "Google", "Chrome", "Application", "chrome.exe") : null,
    path.join(programFiles, "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(programFilesX86, "Microsoft", "Edge", "Application", "msedge.exe"),
    localAppData ? path.join(localAppData, "Microsoft", "Edge", "Application", "msedge.exe") : null,
    path.join(programFiles, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
    localAppData ? path.join(localAppData, "BraveSoftware", "Brave-Browser", "Application", "brave.exe") : null,
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  ].filter(Boolean) as string[];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Calculates remaining budget in milliseconds from startTime
 */
function getRemainingBudget(startTime: number): number {
  const elapsed = Date.now() - startTime;
  return Math.max(0, TOTAL_OPERATION_BUDGET_MS - elapsed);
}

/**
 * Helper to run an async action with an abortable deadline
 */
async function withTimeout<T>(
  action: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  timeoutErrorMsg: string
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const result = await Promise.race([
      action(controller.signal),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener("abort", () => {
          const err = new Error(timeoutErrorMsg);
          err.name = "TimeoutError";
          reject(err);
        });
      }),
    ]);
    return result;
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: NextRequest) {
  const operationStart = Date.now();
  let logger: CaptureLogger | null = null;

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  let isRemote = false;
  let tempUserDataDir: string | null = null;
  let inFlightLaunch: Promise<Browser> | null = null;

  try {
    // 1. Validation Stage
    const body = await request.json().catch(() => ({}));
    const {
      url,
      presetKey = "macbook-air-13",
      customW = 1440,
      customH = 900,
      frameId = "none",
      zoomLevel = 100,
      captureFullPage = false,
      captureQuality = "preview",
      settleDelay = 1000,
    } = body;

    const validatedQuality: "preview" | "export" =
      captureQuality === "export" ? "export" : "preview";

    const validatedSettleDelay = Math.max(
      0,
      Math.min(5000, parseInt(String(settleDelay ?? 1000), 10) || 1000)
    );

    logger = new CaptureLogger({
      url: String(url || ""),
      presetKey: String(presetKey),
      quality: validatedQuality,
      captureFullPage: Boolean(captureFullPage),
    });

    logger.startStage("validation");

    if (!url) {
      logger.endStage("validation");
      logger.fail("VALIDATION_ERROR", "Missing url parameter", 400);
      return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
    }

    let targetUrl = String(url).trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = "https://" + targetUrl;
    }

    // SSRF pre-flight validation
    const validation = await validateUrlSafe(targetUrl);
    if (!validation.safe) {
      logger.endStage("validation");
      logger.fail("SSRF_BLOCKED", validation.error || "Security check rejected URL", 403);
      return NextResponse.json(
        { error: `Security check rejected URL: ${validation.error}` },
        { status: 403 }
      );
    }

    // Resolve device specifications
    let deviceWidth = 1280;
    let deviceHeight = 832;
    let baseScaleFactor = 2;
    let isMobile = false;
    let userAgent: string | null = null;

    if (presetKey === "custom") {
      deviceWidth = Math.max(100, Math.min(7680, parseInt(String(customW), 10) || 1440));
      deviceHeight = Math.max(100, Math.min(7680, parseInt(String(customH), 10) || 900));
      baseScaleFactor = 1;
      isMobile = deviceWidth <= 500;
    } else {
      const preset = DEVICE_PRESETS[presetKey] || DEVICE_PRESETS["macbook-air-13"];
      deviceWidth = preset.width;
      deviceHeight = preset.height;
      baseScaleFactor = preset.deviceScaleFactor || (preset.mobile ? 3 : 2);
      isMobile = preset.mobile || false;
      userAgent = preset.userAgent || null;
    }

    // Preview mode uses 1x density; export mode uses bounded higher density (up to 2x)
    const deviceScaleFactor =
      validatedQuality === "preview" ? 1 : Math.min(baseScaleFactor, 2);

    if (isMobile && !userAgent) {
      userAgent =
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
    }

    // Calculate emulated height matching exact frame content window
    let emulatedHeight = deviceHeight;
    if (!captureFullPage) {
      if (frameId === "pro-display-xdr" || frameId === "apple-pro-display-xdr" || frameId === "xdr") {
        emulatedHeight = Math.round(deviceWidth * (2944 / 5545)); // ~1087px for 2048w
      } else if (frameId === "macbook-air-13" || frameId === "macbook-air" || frameId === "macbook-pro-clay") {
        emulatedHeight = Math.round(deviceWidth * (2103 / 3443)); // ~782px for 1280w
      } else if (frameId === "ipad-pro" || frameId === "ipad-pro-13" || frameId === "ipad-pro-11" || frameId === "ipad-pro-12") {
        emulatedHeight = Math.round(deviceWidth * (2144 / 2859)); // ~1032px for 1376w
      } else if (frameId === "iphone-15" || frameId === "iphone-16" || frameId === "iphone-clay-dark" || frameId === "iphone-clay-light") {
        emulatedHeight = Math.round(deviceWidth * (2062 / 1010)); // ~802px for 393w
      } else if (frameId === "pixel-8" || frameId === "pixel") {
        emulatedHeight = Math.round(deviceWidth * (1999 / 900)); // ~915px for 412w
      } else if (frameId === "s24" || frameId === "samsung-s24-ultra" || frameId === "s24-ultra") {
        emulatedHeight = Math.round(deviceWidth * (2163 / 1005)); // ~887px for 412w
      }
    }

    logger.endStage("validation");

    // 2. Backend Resolution Stage
    logger.startStage("backend_resolution");

    const wsEndpoint = (
      process.env.PUPPETEER_WS_ENDPOINT ||
      process.env.BROWSERLESS_URL ||
      ""
    ).trim();

    let backendType: BrowserBackend = "unresolved";

    if (wsEndpoint) {
      if (!/^wss?:\/\//i.test(wsEndpoint)) {
        logger.endStage("backend_resolution");
        logger.fail("ENDPOINT_INVALID", "Remote browser endpoint must use ws:// or wss:// scheme", 500);
        return NextResponse.json(
          { error: "Remote browser endpoint must use ws:// or wss:// scheme." },
          { status: 500 }
        );
      }
      backendType = "remote-ws";
    } else {
      const localPath = getLocalChromePath();
      if (localPath) {
        backendType = "local-chrome";
      } else {
        backendType = "sparticuz-chromium";
      }
    }

    logger.setBackend(backendType);
    logger.endStage("backend_resolution");

    // 3. Launch / Connect Stage
    logger.startStage("launch_connect");
    const launchBudget = Math.min(15000, getRemainingBudget(operationStart) - 15000);

    if (backendType === "remote-ws") {
      isRemote = true;
      try {
        inFlightLaunch = puppeteer.connect({
          browserWSEndpoint: wsEndpoint,
          protocolTimeout: 30000,
        });
        browser = await withTimeout(
          () => inFlightLaunch!,
          launchBudget,
          "Connection to remote browser endpoint timed out"
        );
        inFlightLaunch = null;
      } catch (connectErr: unknown) {
        inFlightLaunch = null;
        const errMsg = connectErr instanceof Error ? connectErr.message : String(connectErr);
        const isTimeout = connectErr instanceof Error && connectErr.name === "TimeoutError";
        const classification: FailureClassification = isTimeout
          ? "CONNECT_TIMEOUT"
          : "BROWSER_UNAVAILABLE";
        logger.endStage("launch_connect");
        logger.fail(classification, errMsg, 502);
        return NextResponse.json(
          {
            error: isTimeout
              ? "Remote browser connection timed out. Please verify provider status."
              : "Failed to connect to remote browser endpoint. Please verify configuration.",
          },
          { status: 502 }
        );
      }
    } else if (backendType === "local-chrome") {
      const localPath = getLocalChromePath()!;
      const uniqueProfileId = `instaframe_prof_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      tempUserDataDir = path.join(os.tmpdir(), uniqueProfileId);

      try {
        inFlightLaunch = puppeteer.launch({
          executablePath: localPath,
          headless: true,
          userDataDir: tempUserDataDir,
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-gpu",
            "--disable-dev-shm-usage",
            "--disable-background-networking",
            "--disable-background-timer-throttling",
            "--disable-backgrounding-occluded-windows",
            "--disable-breakpad",
            "--disable-client-side-phishing-detection",
            "--disable-default-apps",
            "--disable-extensions",
            "--disable-hang-monitor",
            "--disable-popup-blocking",
            "--disable-prompt-on-repost",
            "--disable-sync",
            "--metrics-recording-only",
            "--no-first-run",
            "--safebrowsing-disable-auto-update",
            `--window-size=${deviceWidth},${emulatedHeight}`,
          ],
        });
        browser = await withTimeout(
          () => inFlightLaunch!,
          launchBudget,
          "Local browser launch timed out"
        );
        inFlightLaunch = null;
      } catch (launchErr: unknown) {
        inFlightLaunch = null;
        logger.endStage("launch_connect");
        logger.fail("BROWSER_UNAVAILABLE", launchErr, 500);
        return NextResponse.json(
          { error: "Failed to launch local browser instance." },
          { status: 500 }
        );
      }
    } else {
      // Serverless environment (@sparticuz/chromium) without on-demand download fallback
      try {
        const chromium = (await import("@sparticuz/chromium")).default;
        const executablePath = await chromium.executablePath();

        if (!executablePath) {
          throw new Error("Chromium executable path is empty");
        }

        inFlightLaunch = puppeteer.launch({
          executablePath,
          headless: "shell",
          defaultViewport: {
            width: deviceWidth,
            height: emulatedHeight,
            deviceScaleFactor,
          },
          args: chromium.args,
        });
        browser = await withTimeout(
          () => inFlightLaunch!,
          launchBudget,
          "Serverless Chromium launch timed out"
        );
        inFlightLaunch = null;
      } catch (serverlessErr: unknown) {
        inFlightLaunch = null;
        const errMsg =
          serverlessErr instanceof Error ? serverlessErr.message : String(serverlessErr);
        logger.endStage("launch_connect");
        logger.fail("BROWSER_UNAVAILABLE", errMsg, 503);
        return NextResponse.json(
          {
            error:
              "Chromium browser is unavailable in this deployment. Please configure PUPPETEER_WS_ENDPOINT or BROWSERLESS_URL in your environment variables.",
          },
          { status: 503 }
        );
      }
    }

    logger.endStage("launch_connect");

    // 4. Context and Page Setup Stage
    logger.startStage("context_page_setup");

    if (isRemote) {
      // Isolated context for shared remote browser sessions
      context = await browser.createBrowserContext();
      page = await context.newPage();
    } else {
      page = await browser.newPage();
    }

    await page.setViewport({
      width: deviceWidth,
      height: emulatedHeight,
      deviceScaleFactor,
      isMobile,
      hasTouch: isMobile,
    });

    if (userAgent) {
      await page.setUserAgent(userAgent);
    }

    // SSRF defense-in-depth: intercept subresources & redirects
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      try {
        const reqUrl = req.url();
        const parsed = new URL(reqUrl);
        const proto = parsed.protocol.toLowerCase();
        if (proto !== "http:" && proto !== "https:" && proto !== "data:" && proto !== "blob:") {
          req.abort("blockedbyclient").catch(() => {});
          return;
        }
        const host = parsed.hostname.toLowerCase();
        const cleanHost = host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;

        if (
          cleanHost === "localhost" ||
          cleanHost.endsWith(".localhost") ||
          cleanHost.endsWith(".local") ||
          cleanHost.endsWith(".internal") ||
          cleanHost === "metadata.google.internal" ||
          cleanHost === "instance-data" ||
          cleanHost === "metadata" ||
          cleanHost === "169.254.169.254" ||
          cleanHost === "100.100.100.200" ||
          (net.isIP(cleanHost) && isPrivateOrBlockedIP(cleanHost))
        ) {
          req.abort("blockedbyclient").catch(() => {});
          return;
        }
        req.continue().catch(() => {});
      } catch {
        req.abort("blockedbyclient").catch(() => {});
      }
    });

    logger.endStage("context_page_setup");

    // 5. Navigation Stage
    logger.startStage("navigation");
    const navBudget = Math.min(16000, getRemainingBudget(operationStart) - 10000);

    try {
      await page.goto(targetUrl, {
        waitUntil: "domcontentloaded",
        timeout: Math.max(3000, navBudget),
      });
    } catch (navErr: unknown) {
      const errStr = navErr instanceof Error ? navErr.message : String(navErr);
      const isTimeout =
        (navErr instanceof Error && navErr.name === "TimeoutError") ||
        errStr.toLowerCase().includes("timeout");

      if (isTimeout) {
        // Check if usable content rendered before failing
        const hasContent = await page
          .evaluate(() => {
            const body = document.body;
            if (!body) return false;
            const text = body.innerText ? body.innerText.trim() : "";
            const elements = body.querySelectorAll(
              "img, canvas, svg, video, iframe, p, div, h1, h2, h3, article, section, main, header"
            );
            return text.length > 20 || elements.length > 2;
          })
          .catch(() => false);

        if (!hasContent) {
          logger.endStage("navigation");
          logger.fail("NAVIGATION_TIMEOUT", "Page load timed out before usable content rendered", 504);
          return NextResponse.json(
            { error: "Page load timed out before any usable content could render." },
            { status: 504 }
          );
        }
        console.warn("[Capture] Navigation deadline reached, proceeding with partial DOM state");
      } else {
        // Fatal navigation failure (DNS, TLS, connection refused)
        logger.endStage("navigation");
        logger.fail("NAVIGATION_FAILED", errStr, 502);
        return NextResponse.json(
          { error: "Failed to navigate to target URL. Check that the site is online and reachable." },
          { status: 502 }
        );
      }
    }
    logger.endStage("navigation");

    // 6. Readiness Stage (Fonts, Visible Images, Animations & Settle Delay)
    logger.startStage("readiness");
    const readinessBudget = Math.min(4500, getRemainingBudget(operationStart) - 6000);

    try {
      await page.evaluate(async (maxWaitMs: number) => {
        const deadline = Date.now() + maxWaitMs;

        // 1. Wait for document.readyState === "complete" if still loading
        if (document.readyState !== "complete") {
          const readyTimeout = Math.min(1500, Math.max(100, deadline - Date.now()));
          await Promise.race([
            new Promise<void>((resolve) => {
              if (document.readyState === "complete") {
                resolve();
              } else {
                window.addEventListener("load", () => resolve(), { once: true });
              }
            }),
            new Promise((r) => setTimeout(r, readyTimeout)),
          ]).catch(() => {});
        }

        // 2. Wait for document fonts if supported
        if ("fonts" in document && document.fonts.ready) {
          const fontTimeout = Math.min(800, Math.max(100, deadline - Date.now()));
          await Promise.race([
            document.fonts.ready,
            new Promise((r) => setTimeout(r, fontTimeout)),
          ]).catch(() => {});
        }

        // 3. Wait for visible images in the initial viewport
        const visibleImages = Array.from(document.querySelectorAll("img")).filter((img) => {
          const rect = img.getBoundingClientRect();
          return rect.top < window.innerHeight && rect.bottom > 0 && img.src;
        });

        if (visibleImages.length > 0) {
          const imgPromises = visibleImages.map((img) => {
            if (img.complete) return Promise.resolve();
            return new Promise((resolve) => {
              img.addEventListener("load", resolve, { once: true });
              img.addEventListener("error", resolve, { once: true });
            });
          });
          const imgTimeout = Math.min(1000, Math.max(100, deadline - Date.now()));
          await Promise.race([
            Promise.all(imgPromises),
            new Promise((r) => setTimeout(r, imgTimeout)),
          ]).catch(() => {});
        }

        // 4. Wait for running finite CSS / Web Animations to complete
        if (typeof document.getAnimations === "function") {
          try {
            const runningAnimations = document.getAnimations().filter((anim) => {
              if (anim.playState !== "running") return false;
              const timing = anim.effect?.getTiming();
              if (
                timing &&
                (timing.iterations === Infinity ||
                  timing.duration === Infinity ||
                  timing.iterations === null ||
                  timing.duration === null)
              ) {
                return false;
              }
              return true;
            });

            if (runningAnimations.length > 0) {
              const animPromises = runningAnimations.map((anim) => anim.finished.catch(() => {}));
              const animTimeout = Math.min(1500, Math.max(100, deadline - Date.now()));
              await Promise.race([
                Promise.all(animPromises),
                new Promise((r) => setTimeout(r, animTimeout)),
              ]);
            }
          } catch {
            // Best effort for getAnimations
          }
        }
      }, readinessBudget);
    } catch {
      // Best-effort readiness check
    }

    // 5. Dedicated settle pause for JS-driven animations (Framer Motion, React hydration, Tailwind transitions)
    if (validatedSettleDelay > 0) {
      const remainingForPause = getRemainingBudget(operationStart) - 6000;
      const actualPauseMs = Math.min(validatedSettleDelay, Math.max(0, remainingForPause));
      if (actualPauseMs > 0) {
        await new Promise((r) => setTimeout(r, actualPauseMs));
      }
    }

    // Suppress scrollbars to preserve mockup aesthetics
    await page.addStyleTag({
      content: `
        *::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
        html, body, * { scrollbar-width: none !important; -ms-overflow-style: none !important; }
      `,
    }).catch(() => {});

    // Apply zoom if specified
    if (zoomLevel && zoomLevel !== 100) {
      await page.evaluate((z) => {
        (document.documentElement.style as unknown as { zoom: string }).zoom = String(z / 100);
      }, zoomLevel).catch(() => {});
    }

    logger.endStage("readiness");

    // 7. Scrolling Stage (Only for full-page captures)
    if (captureFullPage) {
      logger.startStage("scrolling");
      const scrollBudget = Math.min(2000, getRemainingBudget(operationStart) - 6000);

      try {
        await page.evaluate(async (maxDurationMs: number) => {
          const startTime = Date.now();
          const distance = 400;
          const maxScroll = Math.min(document.body.scrollHeight || 2400, 2400);
          let current = 0;

          await new Promise<void>((resolve) => {
            const timer = setInterval(() => {
              window.scrollBy(0, distance);
              current += distance;
              if (current >= maxScroll || Date.now() - startTime >= maxDurationMs) {
                clearInterval(timer);
                window.scrollTo(0, 0);
                resolve();
              }
            }, 60);
          });
        }, scrollBudget);
      } catch {
        // Fallback if scroll evaluation is interrupted
      }
      logger.endStage("scrolling");
    }

    // 8. Screenshot Encoding Stage
    logger.startStage("screenshot_encode");

    // Measure full-page height and check oversized bounds
    const fullPageHeight = await page
      .evaluate(() => Math.max(document.body.scrollHeight, document.documentElement.scrollHeight))
      .catch(() => emulatedHeight);

    const effectiveHeight = captureFullPage ? fullPageHeight : emulatedHeight;
    const totalPixels = deviceWidth * effectiveHeight * (deviceScaleFactor * deviceScaleFactor);

    if (totalPixels > MAX_TOTAL_PIXELS || (captureFullPage && fullPageHeight > MAX_FULL_PAGE_HEIGHT)) {
      logger.endStage("screenshot_encode");
      logger.fail(
        "OVERSIZED_CAPTURE",
        `Requested capture exceeds maximum allowable size (${deviceWidth} × ${effectiveHeight} px, ${Math.round(totalPixels / 1_000_000)}M px)`,
        400
      );
      return NextResponse.json(
        {
          error: `Capture exceeds maximum allowable dimensions (${deviceWidth} × ${effectiveHeight} px). Please reduce dimensions or capture visible viewport only.`,
        },
        { status: 400 }
      );
    }

    const base64Buffer = await page.screenshot({
      type: "png",
      fullPage: captureFullPage,
      encoding: "base64",
    });

    logger.endStage("screenshot_encode");

    // 9. Response Preparation Stage
    logger.startStage("response_prep");
    const payloadSizeBytes = base64Buffer.length;

    logger.complete({
      width: deviceWidth,
      height: emulatedHeight,
      fullHeight: fullPageHeight,
      deviceScaleFactor,
      payloadSizeBytes,
    });
    logger.endStage("response_prep");

    const response = NextResponse.json({
      success: true,
      screenshotBase64: `data:image/png;base64,${base64Buffer}`,
      width: deviceWidth,
      height: emulatedHeight,
      fullHeight: fullPageHeight,
      deviceScaleFactor,
    });

    response.headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
    return response;
  } catch (err: unknown) {
    const errStr = err instanceof Error ? err.message : String(err);
    const isTimeout =
      (err instanceof Error && err.name === "TimeoutError") ||
      errStr.toLowerCase().includes("timeout") ||
      Date.now() - operationStart >= TOTAL_OPERATION_BUDGET_MS;

    const classification: FailureClassification = isTimeout
      ? "EXECUTION_TIMEOUT"
      : "INTERNAL_ERROR";
    const statusCode = isTimeout ? 504 : 500;

    if (logger) {
      logger.fail(classification, err, statusCode);
    } else {
      console.error("[Capture] Unhandled error before logger initialization:", err);
    }

    return NextResponse.json(
      {
        error: isTimeout
          ? "Screenshot operation timed out. The website took too long to load or capture."
          : "Screenshot generation failed. Please check the URL or try again later.",
      },
      { status: statusCode }
    );
  } finally {
    // 10. Cleanup Stage
    try {
      if (page) {
        await page.close().catch(() => {});
      }
      if (context) {
        await context.close().catch(() => {});
      }
      if (browser) {
        if (isRemote) {
          await browser.disconnect().catch(() => {});
        } else {
          await browser.close().catch(() => {});
        }
      } else {
        const pendingLaunch = inFlightLaunch as Promise<Browser> | null;
        if (pendingLaunch) {
          // Late-resolving launch safety
          pendingLaunch.then((b: Browser) => {
            if (isRemote) b.disconnect().catch(() => {});
            else b.close().catch(() => {});
          }).catch(() => {});
        }
      }

      if (tempUserDataDir) {
        fs.promises.rm(tempUserDataDir, { recursive: true, force: true }).catch(() => {});
      }
    } catch {
      // Suppress cleanup errors
    }
  }
}
