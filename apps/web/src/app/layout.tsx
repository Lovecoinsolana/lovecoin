import type { Metadata, Viewport } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://lovecoin.fun"),
  title: "LOVECOIN",
  description: "Web3 Dating Platform - Connect wallets, find love, powered by Solana",
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo-full.jpg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Lovecoin",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: "LOVECOIN",
    description: "Web3 Dating Platform - Connect wallets, find love, powered by Solana",
    url: "https://lovecoin.fun",
    siteName: "Lovecoin",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "LOVECOIN",
    description: "Web3 Dating Platform - Connect wallets, find love, powered by Solana",
    creator: "@lovecoin",
    site: "@lovecoin",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#ec4899",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${dmSans.variable} ${jetbrainsMono.variable} antialiased bg-theme text-theme transition-colors`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
