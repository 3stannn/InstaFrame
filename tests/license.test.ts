import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../src/app/api/license/route.ts";

function createRequest(body: Record<string, unknown>): any {
  return new Request("http://localhost:3000/api/license", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}


describe("License API Handler", () => {
  test("rejects request missing action parameter", async () => {
    const req = createRequest({});
    const res = await POST(req);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, "Missing action parameter");
  });

  test("rejects activate missing key", async () => {
    const req = createRequest({ action: "activate" });
    const res = await POST(req);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, "License key is required");
  });

  test("activates successfully with POLAR_PRO_DEMO bypass key", async () => {
    const req = createRequest({
      action: "activate",
      key: "POLAR_PRO_DEMO",
      instanceId: "inst_test123"
    });
    const res = await POST(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.activationId, "00000000-0000-4000-8000-000000000000");
    assert.equal(body.token, "mock_jwt_token");
  });

  test("activates successfully with POLAR_TEST_ prefix bypass key", async () => {
    const req = createRequest({
      action: "activate",
      key: "POLAR_TEST_QA_KEY",
      instanceId: "inst_test456"
    });
    const res = await POST(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.activationId, "00000000-0000-4000-8000-000000000000");
  });

  test("rejects invalid license key when calling Polar", async () => {
    const req = createRequest({
      action: "activate",
      key: "INVALID-KEY-12345678",
      instanceId: "inst_invalid"
    });
    const res = await POST(req);
    assert.equal(res.status >= 400, true);
    const body = await res.json();
    assert.equal(typeof body.error, "string");
  });

  test("deactivates successfully with POLAR_PRO_DEMO key", async () => {
    const req = createRequest({
      action: "deactivate",
      key: "POLAR_PRO_DEMO",
      activationId: "00000000-0000-4000-8000-000000000000"
    });
    const res = await POST(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
  });

  test("deactivates cleanly when activationId is legacy non-UUID", async () => {
    const req = createRequest({
      action: "deactivate",
      key: "72DBFDAC-5AE5-410A-86B2-A0A56D5D59CC",
      activationId: "act_legacy_fallback_1234"
    });
    const res = await POST(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
  });

  test("validates demo key successfully", async () => {
    const req = createRequest({
      action: "validate",
      key: "POLAR_PRO_DEMO"
    });
    const res = await POST(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.valid, true);
  });

  test("rejects validate with missing key", async () => {
    const req = createRequest({
      action: "validate"
    });
    const res = await POST(req);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.valid, false);
  });

  test("validates a genuine granted Polar key successfully", async () => {
    const req = createRequest({
      action: "validate",
      key: "72DBFDAC-5AE5-410A-86B2-A0A56D5D59CC"
    });
    const res = await POST(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.valid, true);
  });
});
