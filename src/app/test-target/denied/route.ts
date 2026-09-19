import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>Framing Denied Target</title>
      <style>
        body { font-family: sans-serif; padding: 2rem; text-align: center; background: #fafafa; }
      </style>
    </head>
    <body>
      <h1>Framing Restricted Endpoint</h1>
      <p>This endpoint explicitly emits <code>X-Frame-Options: DENY</code> and <code>CSP frame-ancestors 'none'</code> headers to verify honest status handling.</p>
    </body>
    </html>
  `;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Frame-Options": "DENY",
      "Content-Security-Policy": "frame-ancestors 'none';",
    },
  });
}
