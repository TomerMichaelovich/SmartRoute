import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
});

export const metadata: Metadata = {
  title: "SmartRoute",
  description: "קניות חכמות: תכננו את המסלול, חסכו זמן וקנו רק מה שתכננתם",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-neutral-50 text-neutral-900 font-sans">
        {children}
      </body>
    </html>
  );
}
