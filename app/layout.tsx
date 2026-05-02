import type { Metadata } from "next";
import { Inter, Fraunces, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Footer from "./components/Footer";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ui",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-serif",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Habitable", template: "%s" },
  description: "Look up any NYC building before you sign a lease. Violations, complaints, ownership, and safety data in plain English.",
  metadataBase: new URL("https://habitable-xi.vercel.app"),
  verification: { google: "Ttpl8IvLe7s1ZJIxfERCbG2COeaohMtQ0nTP7EjOFP4" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${fraunces.variable} ${jetbrainsMono.variable} antialiased`}
      >
        {children}
        <Footer />
      </body>
    </html>
  );
}
