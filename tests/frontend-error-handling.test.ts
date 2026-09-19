import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  getCaptureCacheKey,
  getCachedCapture,
  setCachedCapture,
  executeScreenshotCapture,
} from "../src/lib/capture-client.ts";

describe("Frontend Error Handling & Cache", () => {
  test("getCaptureCacheKey creates deterministic keys based on capture-affecting parameters", () => {
    const key1 = getCaptureCacheKey({
      url: "https://example.com",
      presetKey: "macbook-air-13",
      customW: 1440,
      customH: 900,
      frameId: "none",
      zoomLevel: 100,
      captureFullPage: false,
      captureQuality: "preview",
    });

    const key2 = getCaptureCacheKey({
      url: "https://example.com/",
      presetKey: "macbook-air-13",
      customW: 1440,
      customH: 900,
      frameId: "none",
      zoomLevel: 100,
      captureFullPage: false,
      captureQuality: "preview",
    });

    // Normalized URLs produce matching keys
    assert.equal(key1, key2);

    // Changing captureFullPage produces a different key
    const keyFullPage = getCaptureCacheKey({
      url: "https://example.com",
      presetKey: "macbook-air-13",
      captureFullPage: true,
    });
    assert.notEqual(key1, keyFullPage);

    // Changing quality produces a different key
    const keyExport = getCaptureCacheKey({
      url: "https://example.com",
      presetKey: "macbook-air-13",
      captureQuality: "export",
    });
    assert.notEqual(key1, keyExport);
  });

  test("session cache stores and retrieves capture data correctly", () => {
    const testKey = "test-cache-key-123";
    const testData = {
      success: true,
      screenshotBase64: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      width: 1440,
      height: 900,
      fullHeight: 900,
      deviceScaleFactor: 1,
    };

    setCachedCapture(testKey, testData);
    const retrieved = getCachedCapture(testKey);

    assert.deepEqual(retrieved, testData);
  });

  test("executeScreenshotCapture handles non-JSON 504 Gateway Timeout gracefully without throwing SyntaxError", async () => {
    // Mock global fetch to simulate a Vercel 504 Gateway Timeout returning HTML error page
    const originalFetch = global.fetch;
    global.fetch = async () => {
      return {
        ok: false,
        status: 504,
        headers: {
          get: (header: string) => (header.toLowerCase() === "content-type" ? "text/html" : null),
        },
        text: async () =>
          "An error occurred with your deployment. FUNCTION_INVOCATION_TIMEOUT",
        json: async () => {
          throw new SyntaxError('Unexpected token \'A\', "An error o"... is not valid JSON');
        },
      } as unknown as Response;
    };

    try {
      const result = await executeScreenshotCapture(
        {
          url: "https://slow-website-test.com",
          presetKey: "macbook-air-13",
        },
        { skipCache: true }
      );

      assert.equal(result.success, false);
      assert.equal(result.statusCode, 504);
      assert.ok(result.error?.includes("timed out"));
      assert.equal(result.error?.includes("Unexpected token"), false);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test("executeScreenshotCapture handles 502/503 service unavailable cleanly", async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => {
      return {
        ok: false,
        status: 503,
        headers: {
          get: (header: string) => (header.toLowerCase() === "content-type" ? "text/plain" : null),
        },
        text: async () => "Service Unavailable",
        json: async () => ({}),
      } as unknown as Response;
    };

    try {
      const result = await executeScreenshotCapture(
        {
          url: "https://example.com",
          presetKey: "macbook-air-13",
        },
        { skipCache: true }
      );

      assert.equal(result.success, false);
      assert.equal(result.statusCode, 503);
      assert.ok(result.error?.includes("unavailable"));
    } finally {
      global.fetch = originalFetch;
    }
  });
});
