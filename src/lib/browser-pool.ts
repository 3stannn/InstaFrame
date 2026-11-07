import fs from "fs";
import type { Browser } from "puppeteer-core";

/**
 * Keeps one locally launched browser warm between captures.
 *
 * Launching Chrome costs 1-3 s per capture. Reusing the process and giving
 * every capture its own browser context keeps captures isolated (cookies,
 * storage and cache are per context) while removing the launch cost from
 * every capture after the first. The browser closes after a short idle period.
 */

export interface LaunchedBrowser {
  browser: Browser;
  userDataDir: string | null;
}

interface SharedEntry extends LaunchedBrowser {
  key: string;
  active: number;
  idleTimer: ReturnType<typeof setTimeout> | null;
}

const IDLE_CLOSE_MS = 45_000;

let shared: Promise<SharedEntry> | null = null;

function cleanupEntry(entry: LaunchedBrowser) {
  entry.browser.close().catch(() => {});
  if (entry.userDataDir) {
    fs.promises.rm(entry.userDataDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Returns the shared browser for `key`, launching it when needed.
 * Every successful call must be paired with `releaseSharedBrowser`.
 */
export async function acquireSharedBrowser(
  key: string,
  launch: () => Promise<LaunchedBrowser>
): Promise<Browser> {
  if (shared) {
    const existing = await shared.catch(() => null);
    if (existing && existing.key === key && existing.browser.connected) {
      if (existing.idleTimer) clearTimeout(existing.idleTimer);
      existing.idleTimer = null;
      existing.active += 1;
      return existing.browser;
    }
    if (existing && existing.active === 0) cleanupEntry(existing);
    shared = null;
  }

  const pending = launch().then((launched) => {
    const entry: SharedEntry = { ...launched, key, active: 0, idleTimer: null };
    launched.browser.once("disconnected", () => {
      if (shared === pending) shared = null;
      if (entry.userDataDir) {
        fs.promises.rm(entry.userDataDir, { recursive: true, force: true }).catch(() => {});
      }
    });
    return entry;
  });
  shared = pending;
  pending.catch(() => {
    if (shared === pending) shared = null;
  });

  const entry = await pending;
  entry.active += 1;
  return entry.browser;
}

export function releaseSharedBrowser(browser: Browser) {
  if (!shared) {
    browser.close().catch(() => {});
    return;
  }
  const current = shared;
  current
    .then((entry) => {
      if (entry.browser !== browser) {
        browser.close().catch(() => {});
        return;
      }
      entry.active = Math.max(0, entry.active - 1);
      if (entry.active > 0) return;
      if (entry.idleTimer) clearTimeout(entry.idleTimer);
      entry.idleTimer = setTimeout(() => {
        if (entry.active > 0 || shared !== current) return;
        shared = null;
        cleanupEntry(entry);
      }, IDLE_CLOSE_MS);
      entry.idleTimer.unref?.();
    })
    .catch(() => {});
}
