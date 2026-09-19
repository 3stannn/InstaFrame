import { NextRequest, NextResponse } from "next/server.js";

export const dynamic = "force-dynamic";

const POLAR_ORG_ID =
  process.env.POLAR_ORG_ID || "0f21e4e3-8c94-4bba-a50e-e915ecff6cc4";
const POLAR_BENEFIT_ID =
  process.env.POLAR_BENEFIT_ID || "372b64b5-cb51-4129-ac62-069b8a2ed423";

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isDemoKey(key: string): boolean {
  return key === "POLAR_PRO_DEMO" || key.startsWith("POLAR_TEST_");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action, key, instanceId, activationId } = body;

    if (!action) {
      return NextResponse.json({ error: "Missing action parameter" }, { status: 400 });
    }

    // -------------------------------------------------------------
    // ACTIVATE
    // -------------------------------------------------------------
    if (action === "activate") {
      if (!key) {
        return NextResponse.json({ error: "License key is required" }, { status: 400 });
      }

      const trimmedKey = String(key).trim();

      // Demo/testing bypass key
      if (isDemoKey(trimmedKey)) {
        return NextResponse.json({
          success: true,
          activationId: "00000000-0000-4000-8000-000000000000",
          token: "mock_jwt_token"
        });
      }

      const labelSuffix = instanceId
        ? String(instanceId).replace(/^inst_/, "").slice(0, 8)
        : "browser";
      const label = `InstaFrame Web (${labelSuffix})`;

      try {
        const polarRes = await fetch("https://api.polar.sh/v1/customer-portal/license-keys/activate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: trimmedKey,
            organization_id: POLAR_ORG_ID,
            label,
            conditions: { instance_id: instanceId || "web_client" }
          })
        });

        const data = await polarRes.json().catch(() => ({}));

        if (polarRes.ok && data.id) {
          // Verify benefit ID if configured and returned
          if (
            POLAR_BENEFIT_ID &&
            data.license_key?.benefit_id &&
            data.license_key.benefit_id !== POLAR_BENEFIT_ID
          ) {
            // Roll back activation if tier mismatch
            try {
              await fetch("https://api.polar.sh/v1/customer-portal/license-keys/deactivate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  key: trimmedKey,
                  organization_id: POLAR_ORG_ID,
                  activation_id: data.id
                })
              });
            } catch {
              // ignore rollback error
            }
            return NextResponse.json(
              { error: "This license key is not authorized for InstaFrame Pro." },
              { status: 403 }
            );
          }

          return NextResponse.json({
            success: true,
            activationId: data.id,
            token: "polar_jwt_active"
          });
        }

        const rawDetail = data.detail;
        let errorMessage = "Invalid or exhausted license key.";
        if (typeof rawDetail === "string") {
          errorMessage = rawDetail;
        } else if (Array.isArray(rawDetail) && rawDetail[0]?.msg) {
          errorMessage = rawDetail[0].msg;
        } else if (data.message) {
          errorMessage = data.message;
        } else if (data.error) {
          errorMessage = data.error;
        }

        return NextResponse.json(
          { error: errorMessage },
          { status: polarRes.status >= 400 && polarRes.status < 500 ? polarRes.status : 403 }
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Network error";
        return NextResponse.json({ error: `Polar connection error: ${message}` }, { status: 502 });
      }
    }

    // -------------------------------------------------------------
    // DEACTIVATE
    // -------------------------------------------------------------
    if (action === "deactivate") {
      if (!key) {
        return NextResponse.json({ error: "License key is required" }, { status: 400 });
      }

      const trimmedKey = String(key).trim();

      if (isDemoKey(trimmedKey)) {
        return NextResponse.json({ success: true });
      }

      // If activationId is missing or not a UUID v4 (e.g. legacy fallback ID), consider it deactivated locally
      if (!activationId || !UUID_V4_REGEX.test(String(activationId).trim())) {
        return NextResponse.json({ success: true });
      }

      try {
        const polarRes = await fetch("https://api.polar.sh/v1/customer-portal/license-keys/deactivate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: trimmedKey,
            organization_id: POLAR_ORG_ID,
            activation_id: String(activationId).trim()
          })
        });

        // 200, 204, or 404 (already deleted/not found) all indicate successful release
        if (polarRes.ok || polarRes.status === 204 || polarRes.status === 404) {
          return NextResponse.json({ success: true });
        }

        const data = await polarRes.json().catch(() => ({}));
        return NextResponse.json(
          { error: data.detail || "Failed to deactivate license on Polar." },
          { status: polarRes.status }
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Network error";
        return NextResponse.json({ error: `Polar connection error: ${message}` }, { status: 502 });
      }
    }

    // -------------------------------------------------------------
    // VALIDATE
    // -------------------------------------------------------------
    if (action === "validate") {
      if (!key) {
        return NextResponse.json({ valid: false }, { status: 400 });
      }

      const trimmedKey = String(key).trim();

      if (isDemoKey(trimmedKey)) {
        return NextResponse.json({ valid: true });
      }

      try {
        const payload: { key: string; organization_id: string; activation_id?: string } = {
          key: trimmedKey,
          organization_id: POLAR_ORG_ID
        };

        if (activationId && UUID_V4_REGEX.test(String(activationId).trim())) {
          payload.activation_id = String(activationId).trim();
        }

        const polarRes = await fetch("https://api.polar.sh/v1/customer-portal/license-keys/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const data = await polarRes.json().catch(() => ({}));

        if (polarRes.ok && (data.status === "granted" || data.id)) {
          return NextResponse.json({ valid: true });
        }

        return NextResponse.json({
          valid: false,
          error: data.detail || "License is invalid or deactivated."
        });
      } catch (err: unknown) {
        // In case of Polar outage, allow grace period or return error
        const message = err instanceof Error ? err.message : "Network error";
        return NextResponse.json({ valid: false, error: message }, { status: 502 });
      }
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
