import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "InstaFrame - Studio Mockup Suite & Responsive Viewports",
  description: "Preview responsive viewports live and capture web pages in exact mobile, tablet, and desktop viewports with realistic device mockups.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/assets/icons/icon16.png", sizes: "16x16", type: "image/png" },
      { url: "/assets/icons/icon32.png", sizes: "32x32", type: "image/png" },
      { url: "/assets/icons/icon48.png", sizes: "48x48", type: "image/png" },
      { url: "/assets/icons/icon128.png", sizes: "128x128", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-white selection:text-zinc-950">
        {children}
      </body>
    </html>
  );
}
