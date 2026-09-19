# Cooperative Preview Bridge (Mode B) Setup Guide

The **InstaFrame Cooperative Preview Bridge** allows websites you control to establish an authorized, bidirectional communication channel with InstaFrame viewports using `window.postMessage`.

When enabled, the bridge provides:
- Synchronized proportional scrolling across all device viewports without runaway feedback loops.
- Live intra-site navigation reporting.
- Capability negotiation and explicit origin isolation.

---

## 1. Server Configuration: Allowing InstaFrame

Modern browsers enforce `X-Frame-Options` and Content Security Policy (`CSP`) to prevent clickjacking. To allow InstaFrame to embed your website:

### Content Security Policy (Recommended)
Add your InstaFrame viewer origin to the `frame-ancestors` directive:

```http
Content-Security-Policy: frame-ancestors 'self' https://your-instaframe-domain.com http://localhost:3000;
```

> [!IMPORTANT]
> Do NOT use a blanket wildcard (`frame-ancestors *`) in production. Only authorize trusted viewer origins.

### Avoid Conflicting `X-Frame-Options`
`X-Frame-Options` (e.g. `DENY` or `SAMEORIGIN`) does not support origin lists and is superseded by CSP `frame-ancestors`. Remove `X-Frame-Options` or ensure it does not conflict with `frame-ancestors`.

---

## 2. Installing the Bridge Script

### Option A: Standalone Script Tag
Add the bridge script to your HTML `<head>` or before `</body>`:

```html
<script 
  src="https://your-instaframe-domain.com/preview-bridge.js" 
  data-allowed-origins="https://your-instaframe-domain.com,http://localhost:3000"
></script>
```

### Option B: React / Next.js / TypeScript Module
Import and initialize the bridge in your application:

```tsx
import { useEffect } from "react";
import { initTargetBridge } from "@/lib/preview-bridge";

export function PreviewBridgeInitializer() {
  useEffect(() => {
    // Only activates when running inside an iframe
    const cleanup = initTargetBridge({
      allowedOrigins: ["https://your-instaframe-domain.com", "http://localhost:3000"],
      enableScroll: true,
      enableNavigation: true,
      enableClick: false, // off by default
      enableInput: false, // off by default
    });

    return () => cleanup();
  }, []);

  return null;
}
```

---

## 3. Security Boundaries & Field Exclusion

To ensure user privacy and security:

1. **Origin Verification**: Every handshake and update verifies `event.origin` and `event.source`. Unauthorized origins are ignored.
2. **Session Identifiers**: Every viewport session is assigned a unique `sessionId`.
3. **Sensitive Field Exclusion**: The bridge **strictly ignores and excludes**:
   - `input[type="password"]`
   - `input[type="file"]`
   - Payment and credit card inputs (`[autocomplete*="cc-"]`, `[name*="card"]`, `[name*="cvv"]`)
   - Form submissions and destructive actions
   - Any element marked with `data-preview-sensitive="true"`
4. **Interaction Sync**: Click and input synchronization are optional and **disabled by default**. When enabled, they only target elements with explicit `data-preview-id` attributes.
5. **Navigation Boundaries**: If the user navigates away to an external third-party domain without the bridge script, synchronization gracefully disconnects.
