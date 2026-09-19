import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "InstaFrame - Studio Mockup Suite & Responsive Viewports",
  description: "Preview responsive viewports live and capture web pages in exact mobile, tablet, and desktop viewports with realistic device mockups.",
  icons: {
    icon: "/assets/icons/icon48.png",
    apple: "/assets/icons/icon128.png",
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
