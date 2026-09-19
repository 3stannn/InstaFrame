import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  isValidBridgeMessage,
  isSensitiveElement,
} from "../src/lib/preview-bridge.ts";
import type { BridgeMessage } from "../src/lib/preview-bridge.ts";

describe("Bridge Message Schema & Security Validation", () => {
  test("validates well-formed handshake init message", () => {
    const validInit: BridgeMessage = {
      type: "PREVIEW_HANDSHAKE_INIT",
      sessionId: "session_123",
      viewerOrigin: "https://viewer.instaframe.com",
      capabilitiesRequested: ["scroll", "navigation"],
      timestamp: Date.now(),
    };
    assert.equal(isValidBridgeMessage(validInit), true);
  });

  test("validates well-formed scroll update message", () => {
    const validScroll: BridgeMessage = {
      type: "PREVIEW_SCROLL_UPDATE",
      sessionId: "session_123",
      scrollX: 0,
      scrollY: 450,
      ratioX: 0,
      ratioY: 0.35,
      mode: "ratio",
      timestamp: Date.now(),
    };
    assert.equal(isValidBridgeMessage(validScroll), true);
  });

  test("rejects malformed messages with missing or invalid fields", () => {
    const malformedCases = [
      null,
      undefined,
      "string-not-object",
      12345,
      {}, // missing type and sessionId
      { type: "PREVIEW_HANDSHAKE_INIT" }, // missing sessionId
      { sessionId: "s1" }, // missing type
      { type: "INVALID_UNKNOWN_TYPE", sessionId: "s1", timestamp: Date.now() },
      { type: "PREVIEW_HANDSHAKE_INIT", sessionId: "s1", timestamp: "not-a-number" },
    ];

    for (const testCase of malformedCases) {
      assert.equal(
        isValidBridgeMessage(testCase),
        false,
        `Should reject: ${JSON.stringify(testCase)}`
      );
    }
  });

  test("isSensitiveElement strictly identifies sensitive inputs", () => {
    // Create mock elements
    function createMockInput(type: string, name = "", autocomplete = "", dataSensitive?: string) {
      return {
        tagName: "INPUT",
        type,
        name,
        getAttribute: (attr: string) => {
          if (attr === "autocomplete") return autocomplete;
          if (attr === "data-preview-sensitive") return dataSensitive || null;
          return null;
        },
      } as unknown as Element;
    }

    // Passwords must be excluded
    const passwordInput = createMockInput("password");
    assert.equal(isSensitiveElement(passwordInput), true);

    // File inputs must be excluded
    const fileInput = createMockInput("file");
    assert.equal(isSensitiveElement(fileInput), true);

    // Credit card / payment inputs must be excluded
    const ccInput = createMockInput("text", "cardNumber", "cc-number");
    assert.equal(isSensitiveElement(ccInput), true);

    const cvvInput = createMockInput("text", "cvv");
    assert.equal(isSensitiveElement(cvvInput), true);

    // Custom sensitive data attribute must be excluded
    const customSensitive = createMockInput("text", "userSecret", "", "true");
    assert.equal(isSensitiveElement(customSensitive), true);

    // Standard public inputs should NOT be flagged as sensitive
    const standardInput = createMockInput("text", "searchQuery");
    assert.equal(isSensitiveElement(standardInput), false);
  });

  test("form tags are excluded from replay", () => {
    const formEl = {
      tagName: "FORM",
      getAttribute: () => null,
    } as unknown as Element;
    assert.equal(isSensitiveElement(formEl), true);
  });
});
