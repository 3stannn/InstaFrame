import { test } from "node:test";
import assert from "node:assert/strict";
import dns from "node:dns/promises";
import { getCaptureCacheKey, executeScreenshotCapture, setCachedCapture } from "../src/lib/capture-client.ts";
import { normalizeSettings, DEFAULT_SETTINGS } from "../src/lib/storage.ts";
import { isPrivateOrBlockedIP, validateUrlSafe, safeFetch } from "../src/lib/ssrf.ts";
import { PreviewBridgeController } from "../src/lib/preview-bridge-controller.ts";

test("capture cache distinguishes case-sensitive paths and query values", () => {
  assert.notEqual(getCaptureCacheKey({ url: "https://example.com/Page?name=Alice" }), getCaptureCacheKey({ url: "https://example.com/page?name=alice" }));
  assert.equal(getCaptureCacheKey({ url: "https://EXAMPLE.COM/Page" }), getCaptureCacheKey({ url: "https://example.com/Page" }));
  assert.notEqual(getCaptureCacheKey({ url: "https://example.com", useCustomDimensions: true }), getCaptureCacheKey({ url: "https://example.com" }));
});

test("cancelled capture cannot return cached data", async () => {
  const params = { url: "https://example.com/cancelled" };
  setCachedCapture(getCaptureCacheKey(params), { success: true, screenshotBase64: "data:image/png;base64,test", width: 100, height: 100, fullHeight: 100, deviceScaleFactor: 1 });
  const controller = new AbortController(); controller.abort();
  const result = await executeScreenshotCapture({ ...params, signal: controller.signal });
  assert.equal(result.success, false);
  assert.match(result.error || "", /cancelled/);
});

test("incomplete successful response is read once and reported as a service error", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } }));
  const result = await executeScreenshotCapture({ url: "https://example.com/incomplete" }, { skipCache: true });
  assert.equal(result.success, false);
  assert.equal(result.statusCode, 200);
  assert.match(result.error || "", /incomplete/);
});

test("forced refresh bypasses old capture cache", async (t) => {
  const params = { url: "https://example.com/refresh" };
  const image = { success: true, screenshotBase64: "old", width: 100, height: 100, fullHeight: 100, deviceScaleFactor: 1 };
  setCachedCapture(getCaptureCacheKey(params), image);
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ ...image, screenshotBase64: "new" }), { headers: { "Content-Type": "application/json" } }));
  assert.equal((await executeScreenshotCapture(params)).data?.screenshotBase64, "old");
  assert.equal((await executeScreenshotCapture(params, { skipCache: true })).data?.screenshotBase64, "new");
});

test("damaged saved settings cannot create invalid viewport dimensions or duplicate devices", () => {
  const settings = normalizeSettings({ customH: -1, customW: "broken", fullPage: "false", responsive: { scale: -2, activeDevices: [{ id: "bad", name: "bad", presetKey: "custom", width: -10, height: null }] } });
  assert.equal(settings.customH, 100);
  assert.equal(settings.customW, DEFAULT_SETTINGS.customW);
  assert.equal(settings.fullPage, false);
  assert.deepEqual(settings.responsive?.activeDevices, DEFAULT_SETTINGS.responsive?.activeDevices);
  assert.equal(settings.responsive?.scale, "auto");
});

test("restored URLs discard credentials and secret query parameters", () => {
  const settings = normalizeSettings({ targetUrl: "https://user:secret@example.com/Page?token=secret&tab=calendar" });
  assert.equal(settings.targetUrl, "https://example.com/Page?tab=calendar");
});

test("IPv6 long-form private and multicast addresses remain blocked", () => {
  for (const ip of ["0:0:0:0:0:ffff:7f00:1", "0:0:0:0:0:ffff:0a00:1", "ff02::1", "fec0::1"]) assert.equal(isPrivateOrBlockedIP(ip), true, ip);
});

test("private DNS records cause rejection even alongside a public answer", async (t) => {
  t.mock.method(dns, "lookup", async () => [{ address: "93.184.216.34", family: 4 }, { address: "10.0.0.1", family: 4 }]);
  assert.equal((await validateUrlSafe("https://example.com")).safe, false);
});

test("safe fetch permits a request with zero redirects allowed", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("ok"));
  assert.equal(await (await safeFetch("https://93.184.216.34/", undefined, 0)).text(), "ok");
});

test("bridge re-registration keeps its session and retries handshake after load", () => {
  const sent: unknown[] = [];
  const frame = { contentWindow: { postMessage: (...args: unknown[]) => sent.push(args) } } as unknown as HTMLIFrameElement;
  const controller = new PreviewBridgeController();
  const first = controller.registerFrame("device", frame, "https://example.com");
  const second = controller.registerFrame("device", frame, "https://example.com");
  assert.equal(first, second);
  assert.equal(sent.length, 2);
  assert.notEqual(controller.registerFrame("device", frame, "https://another.example"), first);
  controller.destroy();
});


test("proxy interpolation escapes markup and script-closing URLs", async () => {
  const { escapeHtml, scriptString } = await import("../src/lib/proxy-utils.ts");
  assert.equal(escapeHtml('https://example.com/?x="&'), "https://example.com/?x=&quot;&amp;");
  const serialized = scriptString("</script><script>alert(1)</script>");
  assert.equal(serialized.includes("<"), false);
  assert.equal(JSON.parse(serialized), "</script><script>alert(1)</script>");
});


test("capture viewport height matches the actual hardware area below the thicker browser bar", async () => {
  const { getBrowserChromeDimensions, getFrameContentHeight } = await import("../src/lib/frame-layout.ts");
  const chrome = getBrowserChromeDimensions(3443, true);
  assert.equal(chrome.menuBarHeight, 74);
  assert.equal(chrome.safariHeight, 110);
  assert.equal(getFrameContentHeight({ name: "MacBook Air", screenWidth: 3443, screenHeight: 2242 }, 1280), Math.round(1280 * (2242 - 184) / 3443));
  assert.equal(getFrameContentHeight({ name: "iPhone 15", screenWidth: 1010, screenHeight: 2193 }, 393), Math.round(393 * (2193 - 131.3) / 1010));
});


test("capture cache includes the selected scroll position", () => {
  assert.notEqual(getCaptureCacheKey({ url: "https://example.com", scrollY: 100 }), getCaptureCacheKey({ url: "https://example.com", scrollY: 900 }));
});

test("live bridge tracks navigation and scroll for capture and ignores other windows", () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  let listener: ((event: MessageEvent) => void) | undefined;
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    location: { origin: "https://studio.example" },
    addEventListener: (_: string, callback: (event: MessageEvent) => void) => { listener = callback; },
    removeEventListener: () => {},
  } });
  try {
    const frameWindow = { postMessage: () => {} };
    const frame = { contentWindow: frameWindow, hasAttribute: () => true, sandbox: { contains: () => false } } as unknown as HTMLIFrameElement;
    const controller = new PreviewBridgeController({ syncScroll: false });
    const sessionId = controller.registerFrame("live", frame, "https://example.com/start");
    const send = (data: Record<string, unknown>, source: unknown = frameWindow) => listener?.({ data: { ...data, sessionId, timestamp: Date.now() }, source, origin: "null" } as MessageEvent);
    send({ type: "PREVIEW_HANDSHAKE_ACK", url: "https://example.com/start", title: "Start", capabilitiesGranted: { scroll: true, navigation: true, click: false, input: false }, maxScroll: { x: 0, y: 3000 } });
    send({ type: "PREVIEW_NAVIGATED", url: "https://example.com/next", title: "Next" });
    send({ type: "PREVIEW_SCROLL_UPDATE", scrollX: 0, scrollY: 750, ratioX: 0, ratioY: 0.25, mode: "ratio" });
    assert.deepEqual(controller.getFrameState("live"), { url: "https://example.com/next", scrollX: 0, scrollY: 750, connected: true });
    send({ type: "PREVIEW_NAVIGATED", url: "https://attacker.example", title: "Wrong source" }, {});
    assert.equal(controller.getFrameState("live")?.url, "https://example.com/next");
    controller.destroy();
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "window", descriptor);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
