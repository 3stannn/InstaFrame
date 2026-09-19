/**
 * Preview Bridge Controller (Viewer side)
 *
 * Manages active frame sessions, performs capability handshakes,
 * validates incoming postMessages, and synchronizes events (scroll, navigation)
 * across cooperating frames while preventing feedback loops.
 */

import {
  BridgeMessage,
  BridgeCapabilities,
  HandshakeInitMessage,
  HandshakeAckMessage,
  ScrollUpdateMessage,
  ScrollApplyMessage,
  NavigatedMessage,
  isValidBridgeMessage,
} from "./preview-bridge";

export interface FrameSession {
  sessionId: string;
  deviceId: string;
  iframe: HTMLIFrameElement;
  targetOrigin: string;
  isBridgeConnected: boolean;
  capabilities: BridgeCapabilities;
  lastUrl?: string;
  lastTitle?: string;
  maxScroll?: { x: number; y: number };
}

export type BridgeStatusChangeCallback = (
  deviceId: string,
  connected: boolean,
  capabilities?: BridgeCapabilities,
  meta?: { url?: string; title?: string }
) => void;

export class PreviewBridgeController {
  private sessions = new Map<string, FrameSession>(); // key: sessionId
  private deviceToSession = new Map<string, string>(); // key: deviceId -> sessionId
  private onStatusChange?: BridgeStatusChangeCallback;
  private isDispatchingScroll = false;
  private syncScrollEnabled = true;
  private scrollMode: "ratio" | "pixels" = "ratio";
  private boundMessageHandler: (e: MessageEvent) => void;

  constructor(options?: {
    onStatusChange?: BridgeStatusChangeCallback;
    syncScroll?: boolean;
    scrollMode?: "ratio" | "pixels";
  }) {
    this.onStatusChange = options?.onStatusChange;
    this.syncScrollEnabled = options?.syncScroll ?? true;
    this.scrollMode = options?.scrollMode ?? "ratio";

    this.boundMessageHandler = this.handleMessage.bind(this);
    if (typeof window !== "undefined") {
      window.addEventListener("message", this.boundMessageHandler);
    }
  }

  public setSyncScroll(enabled: boolean) {
    this.syncScrollEnabled = enabled;
  }

  public setScrollMode(mode: "ratio" | "pixels") {
    this.scrollMode = mode;
  }

  /**
   * Registers a device iframe and initiates the handshake.
   */
  public registerFrame(
    deviceId: string,
    iframe: HTMLIFrameElement,
    targetUrl: string
  ): string {
    // Teardown any existing session for this device
    this.unregisterFrame(deviceId);

    let targetOrigin = "*";
    try {
      targetOrigin = new URL(targetUrl).origin;
    } catch {}

    // If identical frame is already registered, don't teardown and rebuild
    const existingSessionId = this.deviceToSession.get(deviceId);
    if (existingSessionId) {
      const existing = this.sessions.get(existingSessionId);
      if (existing && existing.iframe === iframe && existing.targetOrigin === targetOrigin) {
        return existingSessionId;
      }
      this.unregisterFrame(deviceId);
    }

    const sessionId = `sb_${deviceId}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    const session: FrameSession = {
      sessionId,
      deviceId,
      iframe,
      targetOrigin,
      isBridgeConnected: false,
      capabilities: {
        scroll: false,
        navigation: false,
        click: false,
        input: false,
      },
    };

    this.sessions.set(sessionId, session);
    this.deviceToSession.set(deviceId, sessionId);

    this.sendHandshake(session);
    return sessionId;
  }

  /**
   * Sends handshake init to the target iframe.
   */
  public sendHandshake(session: FrameSession) {
    if (!session.iframe || !session.iframe.contentWindow) return;

    const viewerOrigin = typeof window !== "undefined" ? window.location.origin : "";
    const initMsg: HandshakeInitMessage = {
      type: "PREVIEW_HANDSHAKE_INIT",
      sessionId: session.sessionId,
      viewerOrigin,
      capabilitiesRequested: ["scroll", "navigation", "click", "input"],
      timestamp: Date.now(),
    };

    try {
      // Use specific target origin if known and not 'null' / 'file:', fallback to '*' for initial probe
      const targetOrigin =
        session.targetOrigin && session.targetOrigin !== "null"
          ? session.targetOrigin
          : "*";

      session.iframe.contentWindow.postMessage(initMsg, targetOrigin);
    } catch (err) {
      console.warn("[BridgeController] Failed to send handshake:", err);
    }
  }

  /**
   * Unregisters a device frame and cleans up.
   */
  public unregisterFrame(deviceId: string) {
    const sessionId = this.deviceToSession.get(deviceId);
    if (!sessionId) return;

    const session = this.sessions.get(sessionId);
    const wasConnected = Boolean(session?.isBridgeConnected);

    if (session && session.iframe && session.iframe.contentWindow) {
      try {
        session.iframe.contentWindow.postMessage(
          { type: "PREVIEW_TEARDOWN", sessionId, timestamp: Date.now() },
          session.targetOrigin || "*"
        );
      } catch {}
    }

    this.sessions.delete(sessionId);
    this.deviceToSession.delete(deviceId);

    // Only notify if status actually changed from connected to disconnected
    if (wasConnected && this.onStatusChange) {
      this.onStatusChange(deviceId, false);
    }
  }

  /**
   * Handles incoming postMessages from iframes.
   */
  private handleMessage(event: MessageEvent) {
    if (!isValidBridgeMessage(event.data)) return;
    const msg = event.data as BridgeMessage;

    const session = this.sessions.get(msg.sessionId);
    if (!session) return; // Unknown session

    // Security check: Verify event.source matches the iframe's contentWindow
    if (session.iframe.contentWindow && event.source !== session.iframe.contentWindow) {
      console.warn(
        `[BridgeController] Rejected message for session ${msg.sessionId}: event.source did not match frame window.`
      );
      return;
    }

    // Security check: If targetOrigin is known, verify origin
    if (
      session.targetOrigin &&
      session.targetOrigin !== "*" &&
      session.targetOrigin !== "null" &&
      event.origin.toLowerCase() !== session.targetOrigin.toLowerCase()
    ) {
      console.warn(
        `[BridgeController] Rejected message: origin ${event.origin} does not match expected target ${session.targetOrigin}`
      );
      return;
    }

    // 1. Handshake ACK
    if (msg.type === "PREVIEW_HANDSHAKE_ACK") {
      const ackMsg = msg as HandshakeAckMessage;
      session.isBridgeConnected = true;
      session.capabilities = ackMsg.capabilitiesGranted;
      session.lastUrl = ackMsg.url;
      session.lastTitle = ackMsg.title;
      session.maxScroll = ackMsg.maxScroll;

      if (this.onStatusChange) {
        this.onStatusChange(session.deviceId, true, session.capabilities, {
          url: ackMsg.url,
          title: ackMsg.title,
        });
      }
      return;
    }

    // 2. Scroll Update
    if (msg.type === "PREVIEW_SCROLL_UPDATE") {
      if (!this.syncScrollEnabled || this.isDispatchingScroll) return;
      const scrollMsg = msg as ScrollUpdateMessage;

      this.isDispatchingScroll = true;

      // Broadcast to other bridge-connected frames
      this.sessions.forEach((peerSession) => {
        if (
          peerSession.sessionId !== session.sessionId &&
          peerSession.isBridgeConnected &&
          peerSession.capabilities.scroll &&
          peerSession.iframe?.contentWindow
        ) {
          const applyMsg: ScrollApplyMessage = {
            type: "PREVIEW_SCROLL_APPLY",
            sessionId: peerSession.sessionId,
            scrollX: scrollMsg.scrollX,
            scrollY: scrollMsg.scrollY,
            ratioX: scrollMsg.ratioX,
            ratioY: scrollMsg.ratioY,
            mode: this.scrollMode,
            timestamp: Date.now(),
          };

          try {
            peerSession.iframe.contentWindow.postMessage(
              applyMsg,
              peerSession.targetOrigin || "*"
            );
          } catch {}
        }
      });

      // Release dispatch lock on next animation frame
      if (typeof requestAnimationFrame !== "undefined") {
        requestAnimationFrame(() => {
          this.isDispatchingScroll = false;
        });
      } else {
        setTimeout(() => {
          this.isDispatchingScroll = false;
        }, 16);
      }
      return;
    }

    // 3. Navigation Update
    if (msg.type === "PREVIEW_NAVIGATED") {
      const navMsg = msg as NavigatedMessage;
      session.lastUrl = navMsg.url;
      session.lastTitle = navMsg.title;

      if (this.onStatusChange) {
        this.onStatusChange(session.deviceId, true, session.capabilities, {
          url: navMsg.url,
          title: navMsg.title,
        });
      }
    }
  }

  /**
   * Complete destruction on unmount.
   */
  public destroy() {
    if (typeof window !== "undefined") {
      window.removeEventListener("message", this.boundMessageHandler);
    }
    this.sessions.clear();
    this.deviceToSession.clear();
  }
}
