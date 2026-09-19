import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isPrivateOrBlockedIP, validateUrlSafe } from "../src/lib/ssrf.ts";

describe("SSRF & Network Security Protection", () => {
  test("blocks standard private and loopback IPv4 addresses", () => {
    const blockedIps = [
      "0.0.0.0",
      "10.0.0.1",
      "10.255.255.255",
      "127.0.0.1",
      "127.0.0.53",
      "169.254.169.254", // AWS/GCP metadata
      "169.254.1.1",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.0.1",
      "192.168.1.254",
      "255.255.255.255",
    ];

    for (const ip of blockedIps) {
      assert.equal(isPrivateOrBlockedIP(ip), true, `Should block ${ip}`);
    }
  });

  test("blocks CGNAT, documentation, benchmark, and cloud metadata IPv4 addresses", () => {
    const blockedIps = [
      "100.64.0.1", // CGNAT start
      "100.100.100.200", // Alibaba Cloud metadata
      "100.127.255.254", // CGNAT end
      "192.0.0.1", // IETF protocol assignments
      "192.0.2.1", // TEST-NET-1
      "198.18.0.1", // Benchmark network
      "198.19.255.255", // Benchmark network
      "198.51.100.1", // TEST-NET-2
      "203.0.113.1", // TEST-NET-3
      "224.0.0.1", // Multicast
      "240.0.0.1", // Reserved
    ];

    for (const ip of blockedIps) {
      assert.equal(isPrivateOrBlockedIP(ip), true, `Should block ${ip}`);
    }
  });

  test("allows public IPv4 addresses", () => {
    const publicIps = [
      "8.8.8.8",
      "1.1.1.1",
      "93.184.216.34", // example.com
      "142.250.190.46", // google.com
    ];

    for (const ip of publicIps) {
      assert.equal(isPrivateOrBlockedIP(ip), false, `Should allow public IP ${ip}`);
    }
  });

  test("blocks private, loopback, and documentation IPv6 addresses", () => {
    const blockedIps = [
      "::1",
      "::",
      "0:0:0:0:0:0:0:1",
      "fc00::1",
      "fd12:3456:789a::1",
      "fe80::1",
      "febf::ffff",
      "::ffff:127.0.0.1",
      "::ffff:10.0.0.1",
      "::ffff:192.168.1.1",
      "64:ff9b::192.0.2.1",
      "2001:db8::1",
      "[::1]",
      "[fe80::1]",
    ];

    for (const ip of blockedIps) {
      assert.equal(isPrivateOrBlockedIP(ip), true, `Should block IPv6 ${ip}`);
    }
  });

  test("allows public IPv6 addresses", () => {
    const publicIps = [
      "2607:f8b0:4005:805::200e", // Google
      "2606:4700:4700::1111", // Cloudflare
    ];

    for (const ip of publicIps) {
      assert.equal(isPrivateOrBlockedIP(ip), false, `Should allow public IPv6 ${ip}`);
    }
  });

  test("validateUrlSafe blocks disallowed schemes and dangerous hostnames", async () => {
    const dangerousUrls = [
      "ftp://example.com",
      "file:///etc/passwd",
      "javascript:alert(1)",
      "data:text/html,<h1>test</h1>",
      "http://localhost:3000",
      "http://test.localhost",
      "http://service.local",
      "http://api.internal",
      "http://metadata.google.internal",
      "http://instance-data/latest/meta-data/",
      "http://169.254.169.254/latest/meta-data/",
      "http://100.100.100.200/latest/meta-data/",
      "http://127.0.0.1:8080/admin",
      "http://10.0.0.1/",
      "http://192.168.1.1/",
      "http://[::1]:3000/",
      "http://[fe80::1]/",
    ];

    for (const url of dangerousUrls) {
      const res = await validateUrlSafe(url);
      assert.equal(res.safe, false, `Should reject ${url}`);
    }
  });

  test("validateUrlSafe accepts valid public website", async () => {
    const res = await validateUrlSafe("https://example.com");
    assert.equal(res.safe, true);
    assert.equal(res.error, undefined);
  });
});
