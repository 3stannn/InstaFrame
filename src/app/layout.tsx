import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

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
    <html lang="en" className={inter.variable}>
      <body className={`${inter.className} min-h-screen bg-black text-white antialiased selection:bg-white selection:text-black`}>
        {children}
      </body>
    </html>
  );
}
