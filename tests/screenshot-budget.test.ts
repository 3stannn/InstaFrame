import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  CaptureLogger,
  sanitizeUrlForLogging,
} from "../src/lib/capture-logger.ts";

describe("Capture Logger & Budget Bounds", () => {
  test("sanitizeUrlForLogging redacts passwords, tokens, and query parameters", () => {
    const rawWithAuth = "https://user:supersecret123@example.com/dashboard?token=xyz123&apiKey=secretKey";
    const sanitized = sanitizeUrlForLogging(rawWithAuth);

    assert.equal(sanitized.includes("supersecret123"), false);
    assert.equal(sanitized.includes("xyz123"), false);
    assert.equal(sanitized.includes("secretKey"), false);
    assert.equal(sanitized, "https://example.com/dashboard?[redacted]");
  });

  test("sanitizeUrlForLogging handles clean URLs without query parameters", () => {
    const cleanUrl = "https://example.com/about-us";
    const sanitized = sanitizeUrlForLogging(cleanUrl);
    assert.equal(sanitized, "https://example.com/about-us");
  });

  test("CaptureLogger initializes with unique requestId and tracks stages", async () => {
    const logger = new CaptureLogger({
      url: "https://example.com",
      presetKey: "macbook-air-13",
      quality: "preview",
      captureFullPage: false,
    });

    assert.ok(logger.requestId.startsWith("req_"));
    assert.equal(logger.quality, "preview");
    assert.equal(logger.captureFullPage, false);

    logger.setBackend("local-chrome");
    assert.equal(logger.getBackend(), "local-chrome");

    logger.startStage("validation");
    assert.equal(logger.getActiveStage(), "validation");
    await new Promise((r) => setTimeout(r, 10));
    logger.endStage("validation");
    assert.equal(logger.getActiveStage(), null);
  });

  test("oversized pixel calculation correctly identifies safe vs excessive jobs", () => {
    const MAX_TOTAL_PIXELS = 35_000_000;
    const MAX_FULL_PAGE_HEIGHT = 16384;

    function isJobOversized(
      width: number,
      height: number,
      scaleFactor: number,
      isFullPage: boolean
    ): boolean {
      const totalPixels = width * height * (scaleFactor * scaleFactor);
      return totalPixels > MAX_TOTAL_PIXELS || (isFullPage && height > MAX_FULL_PAGE_HEIGHT);
    }

    // 1. Standard preview captures (1x density)
    assert.equal(isJobOversized(1440, 900, 1, false), false);
    assert.equal(isJobOversized(393, 852, 1, false), false);
    assert.equal(isJobOversized(2048, 1152, 1, false), false);

    // 2. Standard export captures (2x density)
    assert.equal(isJobOversized(1440, 900, 2, false), false); // 1440*900*4 = 5.18M px
    assert.equal(isJobOversized(2048, 1152, 2, false), false); // 2048*1152*4 = 9.43M px

    // 3. Moderate full-page capture
    assert.equal(isJobOversized(1440, 4000, 1, true), false); // 5.76M px
    assert.equal(isJobOversized(1440, 4000, 2, true), false); // 23.04M px

    // 4. Excessive / Malicious full-page capture
    assert.equal(isJobOversized(1440, 20000, 1, true), true); // height > 16384
    assert.equal(isJobOversized(3840, 10000, 2, true), true); // 3840*10000*4 = 153.6M px > 35M
  });
});
