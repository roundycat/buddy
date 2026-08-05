import type { Metadata } from "next";
import { Noto_Sans_KR, Plus_Jakarta_Sans } from "next/font/google";
import { DevJumpButtons } from "@/frontend/shared/components/DevJumpButtons";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

const notoSansKr = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-sans-kr",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Beddy",
  description: "퇴원까지 함께하는 AI Beddy",
  applicationName: "Beddy",
  themeColor: "#F7F5F0",
  appleWebApp: {
    capable: true,
    title: "Beddy",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/favicon.ico?v=4", sizes: "any" },
      { url: "/favicon-16.png?v=4", type: "image/png", sizes: "16x16" },
      { url: "/favicon-32.png?v=4", type: "image/png", sizes: "32x32" },
      { url: "/icon-192.png?v=4", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png?v=4", type: "image/png", sizes: "512x512" },
    ],
    apple: [
      {
        url: "/apple-touch-icon.png?v=4",
        type: "image/png",
        sizes: "180x180",
      },
    ],
    shortcut: "/favicon.ico?v=4",
  },
  manifest: "/site.webmanifest?v=4",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${plusJakarta.variable} ${notoSansKr.variable} paper-bg font-sans min-h-screen`}
      >
        {children}
        <DevJumpButtons />
      </body>
    </html>
  );
}
