import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const TITLE = "RestoPanel — The Operating System for Modern Restaurants";
const DESCRIPTION =
  "RestoPanel is a cloud restaurant management platform. Launch your own admin dashboard and customer ordering site, manage menus, orders, customers and analytics — built for restaurants in the UK, US and Canada.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s · RestoPanel",
  },
  description: DESCRIPTION,
  applicationName: "RestoPanel",
  keywords: [
    "restaurant management software",
    "restaurant POS",
    "online ordering system",
    "restaurant dashboard",
    "restaurant SaaS",
    "table reservations",
    "QR menu",
  ],
  alternates: { canonical: "/" },
  authors: [{ name: "RestoPanel" }],
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  openGraph: {
    type: "website",
    siteName: "RestoPanel",
    url: SITE_URL,
    title: TITLE,
    description: "Launch your own restaurant dashboard and ordering site in minutes.",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: "Launch your own restaurant dashboard and ordering site in minutes.",
  },
  // Google Search Console verification — set GOOGLE_SITE_VERIFICATION in prod.
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
};

// Organization + SoftwareApplication structured data for the platform brand.
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "RestoPanel",
      url: SITE_URL,
      description: DESCRIPTION,
    },
    {
      "@type": "SoftwareApplication",
      name: "RestoPanel",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: SITE_URL,
      description: DESCRIPTION,
      offers: { "@type": "Offer", price: "0", priceCurrency: "GBP" },
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
      </head>
      <body className="antialiased">
        {children}
        <GoogleAnalytics />
      </body>
    </html>
  );
}
