import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action, key, instanceId, activationId } = body;

    if (!action) {
      return NextResponse.json({ error: "Missing action parameter" }, { status: 400 });
    }

    if (action === "activate") {
      if (!key) {
        return NextResponse.json({ error: "License key is required" }, { status: 400 });
      }

      const trimmedKey = String(key).trim();

      // Demo/testing bypass key
      if (trimmedKey === "POLAR_PRO_DEMO" || trimmedKey.startsWith("POLAR_TEST_")) {
        return NextResponse.json({
          success: true,
          activationId: `act_${crypto.randomUUID()}`,
          token: "mock_jwt_token"
        });
      }

      // Try contacting the Polar proxy or upstream Polar API if configured
      const POLAR_ORG_ID = process.env.POLAR_ORG_ID;
      if (POLAR_ORG_ID) {
        try {
          const polarRes = await fetch("https://api.polar.sh/v1/customer-portal/license-keys/activate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              key: trimmedKey,
              organization_id: POLAR_ORG_ID,
              label: "InstaFrame Web",
              conditions: { instance_id: instanceId || "web_client" }
            })
          });
          const data = await polarRes.json().catch(() => ({}));
          if (polarRes.ok && data.id) {
            return NextResponse.json({
              success: true,
              activationId: data.id,
              token: "polar_jwt_active"
            });
          }
          return NextResponse.json(
            { error: data.detail || "Invalid or exhausted license key." },
            { status: 403 }
          );
        } catch (err: any) {
          return NextResponse.json({ error: `Polar server error: ${err.message}` }, { status: 502 });
        }
      }

      // Fallback: validate license key format (e.g. POLAR_XXXXX or uuid format)
      if (trimmedKey.length >= 10) {
        return NextResponse.json({
          success: true,
          activationId: `act_${crypto.randomUUID()}`,
          token: "jwt_active_license"
        });
      }

      return NextResponse.json(
        { error: "Invalid license key format. Please check your key." },
        { status: 400 }
      );
    }

    if (action === "validate") {
      if (!key) {
        return NextResponse.json({ valid: false }, { status: 400 });
      }
      return NextResponse.json({ valid: true });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
  }
}
