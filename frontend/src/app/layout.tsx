import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Orchid219 - Local AI Translation",
  description: "Private, offline translation powered by TranslateGemma 12B",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>
        <div className="absolute inset-0 bg-[url('/bg-orange.png')] bg-cover bg-center opacity-40 blur-3xl animate-pulse-slow"></div>
        {children}
      </body>
    </html>
  );
}
