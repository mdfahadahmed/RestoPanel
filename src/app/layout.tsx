import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: "RestoPanel — The Operating System for Modern Restaurants",
  description:
    "RestoPanel is a cloud restaurant management platform. Launch your own admin dashboard and customer ordering site, manage menus, orders, customers and analytics — built for restaurants in the UK, US and Canada.",
  keywords: [
    "restaurant management software",
    "restaurant POS",
    "online ordering system",
    "restaurant dashboard",
    "restaurant SaaS",
  ],
  openGraph: {
    title: "RestoPanel — The Operating System for Modern Restaurants",
    description:
      "Launch your own restaurant dashboard and ordering site in minutes.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
