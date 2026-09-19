/**
 * InstaFrame Cooperative Preview Bridge (Standalone Bundle)
 * Version: 1.0.0
 *
 * Include this script on authorized websites you control to enable
 * synchronized scrolling and navigation reporting inside InstaFrame.
 *
 * Example usage:
 * <script src="https://your-instaframe.com/preview-bridge.js" data-allowed-origins="https://your-instaframe.com"></script>
 */
(function () {
  "use strict";

  if (typeof window === "undefined" || window.parent === window) {
    return; // Not embedded in an iframe
  }

  // Read configuration from script tag or global variable
  var currentScript = document.currentScript;
  var scriptAllowedOrigins = currentScript
    ? currentScript.getAttribute("data-allowed-origins") || ""
    : "";
  var globalAllowedOrigins = window.__INSTAFRAME_ALLOWED_ORIGINS__ || [];

  var rawOrigins = scriptAllowedOrigins
    ? scriptAllowedOrigins.split(",").map(function (s) { return s.trim().toLowerCase(); })
    : Array.isArray(globalAllowedOrigins)
    ? globalAllowedOrigins.map(function (s) { return String(s).trim().toLowerCase(); })
    : [];

  var allowedOrigins = {};
  for (var i = 0; i < rawOrigins.length; i++) {
    if (rawOrigins[i]) allowedOrigins[rawOrigins[i]] = true;
  }

  var activeSessionId = null;
  var viewerOrigin = null;
  var viewerWindow = null;
  var isReplayingScroll = false;
  var scrollThrottleTimer = null;

  function isValidBridgeMessage(data) {
    if (!data || typeof data !== "object") return false;
    if (typeof data.type !== "string" || typeof data.sessionId !== "string") return false;
    var validTypes = [
      "PREVIEW_HANDSHAKE_INIT",
      "PREVIEW_HANDSHAKE_ACK",
      "PREVIEW_SCROLL_UPDATE",
      "PREVIEW_SCROLL_APPLY",
      "PREVIEW_NAVIGATED",
      "PREVIEW_INTERACTION_EVENT",
      "PREVIEW_TEARDOWN"
    ];
    return validTypes.indexOf(data.type) !== -1;
  }

  function handleMessage(event) {
    if (!isValidBridgeMessage(event.data)) return;
    var msg = event.data;

    if (msg.type === "PREVIEW_HANDSHAKE_INIT") {
      var origin = (event.origin || "").toLowerCase();
      var hasOriginFilter = Object.keys(allowedOrigins).length > 0;

      if (hasOriginFilter && !allowedOrigins[origin]) {
        console.warn("[InstaFrame Bridge] Handshake rejected from unauthorized origin:", origin);
        return;
      }

      activeSessionId = msg.sessionId;
      viewerOrigin = event.origin;
      viewerWindow = event.source;

      var maxScrollX = Math.max(0, document.documentElement.scrollWidth - window.innerWidth);
      var maxScrollY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

      var ack = {
        type: "PREVIEW_HANDSHAKE_ACK",
        sessionId: activeSessionId,
        capabilitiesGranted: {
          scroll: true,
          navigation: true,
          click: false,
          input: false
        },
        url: window.location.href,
        title: document.title,
        maxScroll: { x: maxScrollX, y: maxScrollY },
        timestamp: Date.now()
      };

      try {
        viewerWindow.postMessage(ack, viewerOrigin);
      } catch (err) {
        console.error("[InstaFrame Bridge] Failed to send handshake ack:", err);
      }
      return;
    }

    if (!activeSessionId || msg.sessionId !== activeSessionId) return;
    if (!viewerOrigin || event.origin !== viewerOrigin) return;

    if (msg.type === "PREVIEW_SCROLL_APPLY") {
      isReplayingScroll = true;
      var maxScrollX = Math.max(0, document.documentElement.scrollWidth - window.innerWidth);
      var maxScrollY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

      var targetX = msg.scrollX;
      var targetY = msg.scrollY;

      if (msg.mode === "ratio") {
        targetX = Math.round(msg.ratioX * maxScrollX);
        targetY = Math.round(msg.ratioY * maxScrollY);
      }

      window.scrollTo({ left: targetX, top: targetY, behavior: "instant" });

      requestAnimationFrame(function () {
        isReplayingScroll = false;
      });
      return;
    }
  }

  function onScroll() {
    if (isReplayingScroll || !viewerWindow || !viewerOrigin || !activeSessionId) return;
    if (scrollThrottleTimer !== null) return;

    scrollThrottleTimer = setTimeout(function () {
      scrollThrottleTimer = null;
      if (!viewerWindow || !viewerOrigin || !activeSessionId) return;

      var maxScrollX = Math.max(0, document.documentElement.scrollWidth - window.innerWidth);
      var maxScrollY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

      var currentX = window.scrollX || window.pageXOffset || 0;
      var currentY = window.scrollY || window.pageYOffset || 0;

      var ratioX = maxScrollX > 0 ? Math.min(1, Math.max(0, currentX / maxScrollX)) : 0;
      var ratioY = maxScrollY > 0 ? Math.min(1, Math.max(0, currentY / maxScrollY)) : 0;

      var updateMsg = {
        type: "PREVIEW_SCROLL_UPDATE",
        sessionId: activeSessionId,
        scrollX: currentX,
        scrollY: currentY,
        ratioX: ratioX,
        ratioY: ratioY,
        mode: "ratio",
        timestamp: Date.now()
      };

      try {
        viewerWindow.postMessage(updateMsg, viewerOrigin);
      } catch (err) {}
    }, 20);
  }

  function onNavigated() {
    if (!viewerWindow || !viewerOrigin || !activeSessionId) return;
    var navMsg = {
      type: "PREVIEW_NAVIGATED",
      sessionId: activeSessionId,
      url: window.location.href,
      title: document.title,
      timestamp: Date.now()
    };
    try {
      viewerWindow.postMessage(navMsg, viewerOrigin);
    } catch (err) {}
  }

  window.addEventListener("message", handleMessage);
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("popstate", onNavigated);
  window.addEventListener("hashchange", onNavigated);

  console.info("[InstaFrame Bridge] Initialized and listening for viewer handshake.");
})();
