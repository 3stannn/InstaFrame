import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer-core";
import fs from "fs";
import os from "os";
import path from "path";
import net from "net";
import { DEVICE_PRESETS } from "@/lib/devices";
import { validateUrlSafe, isPrivateOrBlockedIP } from "@/lib/ssrf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function getLocalChromePath(): string | null {
  const localAppData = process.env.LOCALAPPDATA || "";
  const programFiles = process.env.ProgramFiles || "C:\\Program Files";
  const programFilesX86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";

  const possiblePaths = [
    process.env.CHROME_PATH,
    path.join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
    path.join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
    localAppData ? path.join(localAppData, "Google", "Chrome", "Application", "chrome.exe") : null,
    path.join(programFilesX86, "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(programFiles, "Microsoft", "Edge", "Application", "msedge.exe"),
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      url,
      presetKey = "macbook-air-13",
      customW = 1440,
      customH = 900,
      frameId = "none",
      zoomLevel = 100,
      captureFullPage = false,
    } = body;

    if (!url) {
      return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
    }

    let targetUrl = String(url).trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = "https://" + targetUrl;
    }

    // 1. SSRF pre-flight check
    const validation = await validateUrlSafe(targetUrl);
    if (!validation.safe) {
      return NextResponse.json(
        { error: `Security check rejected URL: ${validation.error}` },
        { status: 403 }
      );
    }

    // 2. Resolve device specifications
    let deviceWidth = 1280;
    let deviceHeight = 832;
    let deviceScaleFactor = 2;
    let isMobile = false;
    let userAgent: string | null = null;

    if (presetKey === "custom") {
      deviceWidth = Math.max(100, Math.min(7680, parseInt(customW, 10) || 1440));
      deviceHeight = Math.max(100, Math.min(7680, parseInt(customH, 10) || 900));
      deviceScaleFactor = 1;
      isMobile = deviceWidth <= 500;
    } else {
      const preset = DEVICE_PRESETS[presetKey] || DEVICE_PRESETS["macbook-air-13"];
      deviceWidth = preset.width;
      deviceHeight = preset.height;
      deviceScaleFactor = preset.deviceScaleFactor || (preset.mobile ? 3 : 2);
      isMobile = preset.mobile || false;
      userAgent = preset.userAgent || null;
    }

    // Use authentic mobile user-agent if mobile and not specified
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

    // Prioritize PUPPETEER_WS_ENDPOINT if set, falling back to BROWSERLESS_URL
    const wsEndpoint = (
      process.env.PUPPETEER_WS_ENDPOINT ||
      process.env.BROWSERLESS_URL ||
      ""
    ).trim();
    let browser: Awaited<ReturnType<typeof puppeteer.launch>>;
    let tempUserDataDir: string | null = null;

    if (wsEndpoint) {
      if (!/^wss?:\/\//i.test(wsEndpoint)) {
        console.error("Invalid remote browser WebSocket URL scheme");
        return NextResponse.json(
          { error: "Remote browser endpoint must use ws:// or wss:// scheme" },
          { status: 500 }
        );
      }

      try {
        browser = await puppeteer.connect({
          browserWSEndpoint: wsEndpoint,
          protocolTimeout: 30000,
        });
      } catch (connectErr: unknown) {
        console.error("Failed to connect to remote browser endpoint:", connectErr);
        return NextResponse.json(
          { error: "Failed to connect to remote browser endpoint. Please verify configuration and provider status." },
          { status: 502 }
        );
      }
    } else {
      const localPath = getLocalChromePath();

      if (localPath) {
        // Local desktop browser (Chrome, Edge, Brave)
        const uniqueProfileId = `instaframe_prof_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        tempUserDataDir = path.join(os.tmpdir(), uniqueProfileId);

        browser = await puppeteer.launch({
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
      } else {
        // Serverless environment (e.g. Vercel / AWS Lambda) via @sparticuz/chromium
        try {
          const chromium = (await import("@sparticuz/chromium")).default;
          let executablePath: string;
          try {
            executablePath = await chromium.executablePath();
          } catch (binErr) {
            console.warn("Local chromium bin missing, downloading pack fallback:", binErr);
            executablePath = await chromium.executablePath(
              "https://github.com/Sparticuz/chromium/releases/download/v153.0.0/chromium-v153.0.0-pack.tar"
            );
          }

          browser = await puppeteer.launch({
            executablePath,
            headless: "shell",
            defaultViewport: {
              width: deviceWidth,
              height: emulatedHeight,
              deviceScaleFactor,
            },
            args: chromium.args,
          });
        } catch (serverlessErr: unknown) {
          console.error("Failed to launch serverless chromium:", serverlessErr);
          return NextResponse.json(
            {
              error:
                "Could not launch browser in this environment. For custom cloud hosting, set PUPPETEER_WS_ENDPOINT or BROWSERLESS_URL in your environment variables.",
            },
            { status: 500 }
          );
        }
      }
    }

    try {
      const page = await browser.newPage();

      // Configure exact viewport metrics for responsive rendering
      await page.setViewport({
        width: deviceWidth,
        height: emulatedHeight,
        deviceScaleFactor: deviceScaleFactor,
        isMobile: isMobile,
        hasTouch: isMobile,
      });

      if (userAgent) {
        await page.setUserAgent(userAgent);
      }

      // Intercept network requests for redirect & subresource SSRF defense
      await page.setRequestInterception(true);
      page.on("request", (req) => {
        const reqUrl = req.url();
        try {
          const parsed = new URL(reqUrl);
          const proto = parsed.protocol.toLowerCase();
          if (proto !== "http:" && proto !== "https:" && proto !== "data:" && proto !== "blob:") {
            req.abort("blockedbyclient");
            return;
          }
          const host = parsed.hostname.toLowerCase();
          if (
            host === "localhost" ||
            host.endsWith(".localhost") ||
            host.endsWith(".local") ||
            host.endsWith(".internal") ||
            host === "metadata.google.internal" ||
            host === "instance-data" ||
            (net.isIP(host) && isPrivateOrBlockedIP(host))
          ) {
            req.abort("blockedbyclient");
            return;
          }
          req.continue();
        } catch {
          req.abort("blockedbyclient");
        }
      });

      // Navigate to target URL on its real origin
      try {
        await page.goto(targetUrl, {
          waitUntil: "domcontentloaded",
          timeout: 16000,
        });
      } catch (navErr: unknown) {
        const errStr = navErr instanceof Error ? navErr.message : String(navErr);
        const isTimeout =
          (navErr instanceof Error && navErr.name === "TimeoutError") ||
          errStr.toLowerCase().includes("timeout");

        if (isTimeout) {
          // Verify if usable content rendered before proceeding
          const hasContent = await page
            .evaluate(() => Boolean(document.body && document.body.children.length > 0))
            .catch(() => false);

          if (!hasContent) {
            return NextResponse.json(
              { error: "Page load timed out before any usable content could render." },
              { status: 504 }
            );
          }
          console.warn("Navigation reached timeout, proceeding with partial DOM state");
        } else {
          // Fatal navigation failure (DNS, TLS, connection refused)
          console.error("Fatal page navigation error:", errStr);
          return NextResponse.json(
            { error: "Failed to navigate to target URL. Check that the site is online and reachable." },
            { status: 502 }
          );
        }
      }

      // Small pause for fonts and responsive CSS to settle
      await new Promise((r) => setTimeout(r, 600));

      // Trigger lazy-loaded images (IntersectionObserver sweep)
      try {
        await page.evaluate(async () => {
          await new Promise<void>((resolve) => {
            let current = 0;
            const distance = 400;
            const limit = Math.min(document.body.scrollHeight || 2400, 2400);
            const timer = setInterval(() => {
              window.scrollBy(0, distance);
              current += distance;
              if (current >= limit) {
                clearInterval(timer);
                window.scrollTo(0, 0);
                resolve();
              }
            }, 60);
          });
        });
        await new Promise((r) => setTimeout(r, 400));
      } catch {
        // Fallback if scroll evaluation is interrupted
      }

      // Suppress scrollbars to preserve mockup aesthetics
      await page.addStyleTag({
        content: `
          *::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
          html, body, * { scrollbar-width: none !important; -ms-overflow-style: none !important; }
        `,
      });

      // Apply zoom if specified
      if (zoomLevel && zoomLevel !== 100) {
        await page.evaluate((z) => {
          (document.documentElement.style as unknown as { zoom: string }).zoom = String(z / 100);
        }, zoomLevel);
        await new Promise((r) => setTimeout(r, 400));
      }

      // Capture screenshot
      const base64Buffer = await page.screenshot({
        type: "png",
        fullPage: captureFullPage,
        encoding: "base64",
      });

      const fullPageHeight = await page
        .evaluate(() => Math.max(document.body.scrollHeight, document.documentElement.scrollHeight))
        .catch(() => emulatedHeight);

      return NextResponse.json({
        success: true,
        screenshotBase64: `data:image/png;base64,${base64Buffer}`,
        width: deviceWidth,
        height: emulatedHeight,
        fullHeight: fullPageHeight,
        deviceScaleFactor,
      });
    } finally {
      if (browser) await browser.close().catch(() => {});
      if (tempUserDataDir) {
        fs.rm(tempUserDataDir, { recursive: true, force: true }, () => {});
      }
    }
  } catch (err: unknown) {
    console.error("Screenshot error:", err);
    return NextResponse.json(
      { error: "Screenshot generation failed. Please check the URL or try again later." },
      { status: 500 }
    );
  }
}
