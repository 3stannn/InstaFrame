/**
 * Cooperative Preview Bridge (Mode B)
 *
 * Provides safe, validated bidirectional postMessage communication
 * between the InstaFrame viewer and cooperating target websites.
 */

export type BridgeCapability = "scroll" | "navigation" | "click" | "input";

export interface BridgeCapabilities {
  scroll: boolean;
  navigation: boolean;
  click: boolean;
  input: boolean;
}

// Message types
export type BridgeMessageType =
  | "PREVIEW_HANDSHAKE_INIT"
  | "PREVIEW_HANDSHAKE_ACK"
  | "PREVIEW_SCROLL_UPDATE"
  | "PREVIEW_SCROLL_APPLY"
  | "PREVIEW_NAVIGATED"
  | "PREVIEW_INTERACTION_EVENT"
  | "PREVIEW_TEARDOWN";

export interface BaseBridgeMessage {
  type: BridgeMessageType;
  sessionId: string;
  timestamp: number;
}

export interface HandshakeInitMessage extends BaseBridgeMessage {
  type: "PREVIEW_HANDSHAKE_INIT";
  viewerOrigin: string;
  capabilitiesRequested: BridgeCapability[];
}

export interface HandshakeAckMessage extends BaseBridgeMessage {
  type: "PREVIEW_HANDSHAKE_ACK";
  capabilitiesGranted: BridgeCapabilities;
  url: string;
  title: string;
  maxScroll: { x: number; y: number };
}

export interface ScrollUpdateMessage extends BaseBridgeMessage {
  type: "PREVIEW_SCROLL_UPDATE";
  scrollX: number;
  scrollY: number;
  ratioX: number;
  ratioY: number;
  mode: "ratio" | "pixels";
}

export interface ScrollApplyMessage extends BaseBridgeMessage {
  type: "PREVIEW_SCROLL_APPLY";
  scrollX: number;
  scrollY: number;
  ratioX: number;
  ratioY: number;
  mode: "ratio" | "pixels";
}

export interface NavigatedMessage extends BaseBridgeMessage {
  type: "PREVIEW_NAVIGATED";
  url: string;
  title: string;
}

export interface InteractionMessage extends BaseBridgeMessage {
  type: "PREVIEW_INTERACTION_EVENT";
  action: "click" | "input";
  targetId: string;
  value?: string;
}

export interface TeardownMessage extends BaseBridgeMessage {
  type: "PREVIEW_TEARDOWN";
}

export type BridgeMessage =
  | HandshakeInitMessage
  | HandshakeAckMessage
  | ScrollUpdateMessage
  | ScrollApplyMessage
  | NavigatedMessage
  | InteractionMessage
  | TeardownMessage;

/**
 * Validates whether an incoming event payload matches the BridgeMessage schema.
 */
export function isValidBridgeMessage(data: unknown): data is BridgeMessage {
  if (!data || typeof data !== "object") return false;
  const msg = data as Record<string, unknown>;

  if (typeof msg.type !== "string" || typeof msg.sessionId !== "string") {
    return false;
  }

  const validTypes: BridgeMessageType[] = [
    "PREVIEW_HANDSHAKE_INIT",
    "PREVIEW_HANDSHAKE_ACK",
    "PREVIEW_SCROLL_UPDATE",
    "PREVIEW_SCROLL_APPLY",
    "PREVIEW_NAVIGATED",
    "PREVIEW_INTERACTION_EVENT",
    "PREVIEW_TEARDOWN",
  ];

  if (!validTypes.includes(msg.type as BridgeMessageType)) {
    return false;
  }

  if (typeof msg.timestamp !== "number" || isNaN(msg.timestamp)) {
    return false;
  }

  return true;
}

/**
 * Checks whether an element is sensitive and must be excluded from interaction sync.
 * Strictly excludes:
 * - Passwords
 * - File inputs
 * - Payment/credit card fields
 * - Purchase/destructive submit buttons
 */
export function isSensitiveElement(el: Element): boolean {
  const tagName = el.tagName.toLowerCase();

  if (tagName === "input") {
    const input = el as HTMLInputElement;
    const type = (input.type || "").toLowerCase();
    if (type === "password" || type === "file" || type === "hidden") {
      return true;
    }

    // Check autocomplete and name for payment / auth
    const name = (input.name || "").toLowerCase();
    const autocomplete = (input.getAttribute("autocomplete") || "").toLowerCase();
    const sensitiveTokens = [
      "cc-",
      "card",
      "cvv",
      "cvc",
      "password",
      "token",
      "secret",
      "ssn",
      "security",
    ];

    if (sensitiveTokens.some((t) => name.includes(t) || autocomplete.includes(t))) {
      return true;
    }
  }

  if (tagName === "form") {
    return true; // Never sync entire form submissions
  }

  // Check data attributes or class names that flag sensitivity
  const dataSensitive = el.getAttribute("data-preview-sensitive");
  if (dataSensitive === "true" || dataSensitive === "1") {
    return true;
  }

  return false;
}

export interface BridgeOptions {
  allowedOrigins?: string[];
  enableScroll?: boolean;
  enableNavigation?: boolean;
  enableClick?: boolean;
  enableInput?: boolean;
}

/**
 * Initializes the target-side bridge inside a participating website document.
 */
export function initTargetBridge(options: BridgeOptions = {}): () => void {
  if (typeof window === "undefined" || window.parent === window) {
    // Not running inside an iframe
    return () => {};
  }

  const allowedOrigins = new Set(
    (options.allowedOrigins || []).map((o) => o.toLowerCase().trim()).filter(Boolean)
  );

  let activeSessionId: string | null = null;
  let viewerOrigin: string | null = null;
  let viewerWindow: Window | null = null;
  let isReplayingScroll = false;
  let scrollThrottleTimer: number | null = null;

  function handleMessage(event: MessageEvent) {
    if (!isValidBridgeMessage(event.data)) return;
    const msg = event.data;

    // Handshake
    if (msg.type === "PREVIEW_HANDSHAKE_INIT") {
      const initMsg = msg as HandshakeInitMessage;
      const origin = event.origin.toLowerCase();

      // Check allowed origins if configured
      if (allowedOrigins.size > 0 && !allowedOrigins.has(origin)) {
        console.warn("[InstaFrame Bridge] Handshake rejected from unauthorized origin:", origin);
        return;
      }

      activeSessionId = initMsg.sessionId;
      viewerOrigin = event.origin;
      viewerWindow = event.source as Window;

      const maxScrollX = Math.max(0, document.documentElement.scrollWidth - window.innerWidth);
      const maxScrollY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

      const ack: HandshakeAckMessage = {
        type: "PREVIEW_HANDSHAKE_ACK",
        sessionId: activeSessionId,
        capabilitiesGranted: {
          scroll: options.enableScroll !== false,
          navigation: options.enableNavigation !== false,
          click: Boolean(options.enableClick), // off by default
          input: Boolean(options.enableInput), // off by default
        },
        url: window.location.href,
        title: document.title,
        maxScroll: { x: maxScrollX, y: maxScrollY },
        timestamp: Date.now(),
      };

      viewerWindow.postMessage(ack, viewerOrigin);
      return;
    }

    // Verify session ID and origin for all subsequent messages
    if (!activeSessionId || msg.sessionId !== activeSessionId) return;
    if (!viewerOrigin || event.origin !== viewerOrigin) return;

    // Apply scroll from peer frame
    if (msg.type === "PREVIEW_SCROLL_APPLY") {
      const scrollMsg = msg as ScrollApplyMessage;
      isReplayingScroll = true;

      const maxScrollX = Math.max(0, document.documentElement.scrollWidth - window.innerWidth);
      const maxScrollY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

      let targetX = scrollMsg.scrollX;
      let targetY = scrollMsg.scrollY;

      if (scrollMsg.mode === "ratio") {
        targetX = Math.round(scrollMsg.ratioX * maxScrollX);
        targetY = Math.round(scrollMsg.ratioY * maxScrollY);
      }

      window.scrollTo({ left: targetX, top: targetY, behavior: "instant" });

      // Reset replay flag on next tick to prevent feedback loop
      requestAnimationFrame(() => {
        isReplayingScroll = false;
      });
      return;
    }

    // Interaction replay (if enabled)
    if (msg.type === "PREVIEW_INTERACTION_EVENT" && options.enableClick) {
      const actionMsg = msg as InteractionMessage;
      if (actionMsg.action === "click" && actionMsg.targetId) {
        const targetEl = document.querySelector(`[data-preview-id="${actionMsg.targetId}"]`);
        if (targetEl && !isSensitiveElement(targetEl) && typeof (targetEl as HTMLElement).click === "function") {
          (targetEl as HTMLElement).click();
        }
      }
    }
  }

  // Scroll listener with loop suppression and throttling
  function onScroll() {
    if (isReplayingScroll || !viewerWindow || !viewerOrigin || !activeSessionId) return;
    if (scrollThrottleTimer !== null) return;

    scrollThrottleTimer = window.setTimeout(() => {
      scrollThrottleTimer = null;
      if (!viewerWindow || !viewerOrigin || !activeSessionId) return;

      const maxScrollX = Math.max(0, document.documentElement.scrollWidth - window.innerWidth);
      const maxScrollY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

      const currentX = window.scrollX || window.pageXOffset || 0;
      const currentY = window.scrollY || window.pageYOffset || 0;

      const ratioX = maxScrollX > 0 ? Math.min(1, Math.max(0, currentX / maxScrollX)) : 0;
      const ratioY = maxScrollY > 0 ? Math.min(1, Math.max(0, currentY / maxScrollY)) : 0;

      const updateMsg: ScrollUpdateMessage = {
        type: "PREVIEW_SCROLL_UPDATE",
        sessionId: activeSessionId,
        scrollX: currentX,
        scrollY: currentY,
        ratioX,
        ratioY,
        mode: "ratio",
        timestamp: Date.now(),
      };

      viewerWindow.postMessage(updateMsg, viewerOrigin);
    }, 20);
  }

  // Navigation listener
  function onNavigated() {
    if (!viewerWindow || !viewerOrigin || !activeSessionId) return;
    const navMsg: NavigatedMessage = {
      type: "PREVIEW_NAVIGATED",
      sessionId: activeSessionId,
      url: window.location.href,
      title: document.title,
      timestamp: Date.now(),
    };
    viewerWindow.postMessage(navMsg, viewerOrigin);
  }

  window.addEventListener("message", handleMessage);
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("popstate", onNavigated);
  window.addEventListener("hashchange", onNavigated);

  // Return cleanup function
  return () => {
    window.removeEventListener("message", handleMessage);
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("popstate", onNavigated);
    window.removeEventListener("hashchange", onNavigated);
    if (scrollThrottleTimer !== null) {
      clearTimeout(scrollThrottleTimer);
    }
  };
}
