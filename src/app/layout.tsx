import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "BAGA Hospital Management System",
  description: "Complete Hospital Management System - Demo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ur">
      <body className="antialiased font-sans">
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
