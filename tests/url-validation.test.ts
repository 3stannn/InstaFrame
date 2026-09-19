import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeAndValidateUrl,
  isSafeToPersist,
} from "../src/lib/url-validation.ts";

describe("URL Validation & Security", () => {
  test("accepts valid https URLs", () => {
    const res = sanitizeAndValidateUrl("https://example.com/path?foo=bar");
    assert.equal(res.isValid, true);
    assert.equal(res.normalizedUrl, "https://example.com/path?foo=bar");
    assert.equal(res.error, undefined);
  });

  test("accepts valid http URLs", () => {
    const res = sanitizeAndValidateUrl("http://example.com");
    assert.equal(res.isValid, true);
    assert.equal(res.normalizedUrl, "http://example.com/");
  });

  test("auto-prepends https:// to hostnames without scheme", () => {
    const res = sanitizeAndValidateUrl("example.com");
    assert.equal(res.isValid, true);
    assert.equal(res.normalizedUrl, "https://example.com/");
  });

  test("auto-prepends http:// to localhost or 127.0.0.1 without scheme", () => {
    const res1 = sanitizeAndValidateUrl("localhost:3000");
    assert.equal(res1.isValid, true);
    assert.equal(res1.normalizedUrl, "http://localhost:3000/");

    const res2 = sanitizeAndValidateUrl("127.0.0.1:8080");
    assert.equal(res2.isValid, true);
    assert.equal(res2.normalizedUrl, "http://127.0.0.1:8080/");
  });

  test("rejects executable and dangerous schemes", () => {
    const dangerousSchemes = [
      "javascript:alert(1)",
      "data:text/html,<h1>hi</h1>",
      "file:///etc/passwd",
      "blob:http://example.com/xyz",
      "vbscript:msgbox",
    ];

    for (const scheme of dangerousSchemes) {
      const res = sanitizeAndValidateUrl(scheme);
      assert.equal(res.isValid, false, `Scheme should be rejected: ${scheme}`);
      assert.match(res.error || "", /Unsupported scheme|Disallowed protocol/);
    }
  });

  test("detects mixed content when viewer is HTTPS and target is HTTP", () => {
    const res = sanitizeAndValidateUrl("http://insecure-site.com", "https://viewer-domain.com");
    assert.equal(res.isValid, true);
    assert.equal(res.isMixedContent, true);
  });

  test("detects credentials and strips them for persistence", () => {
    const urlWithCreds = "https://user:secret123@example.com/dashboard";
    const res = sanitizeAndValidateUrl(urlWithCreds);
    assert.equal(res.isValid, true);
    assert.equal(res.hasCredentials, true);
    assert.equal(res.sanitizedForStorage, "https://example.com/dashboard");
  });

  test("detects sensitive query parameters and strips them for persistence", () => {
    const urlWithTokens = "https://example.com/app?token=secretjwt123&apiKey=key999&page=home";
    const res = sanitizeAndValidateUrl(urlWithTokens);
    assert.equal(res.isValid, true);
    assert.equal(res.hasSensitiveParams, true);
    assert.equal(res.sanitizedForStorage, "https://example.com/app?page=home");
  });

  test("isSafeToPersist correctly flags clean vs sensitive URLs", () => {
    assert.equal(isSafeToPersist("https://example.com/public-page"), true);
    assert.equal(isSafeToPersist("https://user:pass@example.com"), false);
    assert.equal(isSafeToPersist("https://example.com?auth_token=abc"), false);
  });
});
