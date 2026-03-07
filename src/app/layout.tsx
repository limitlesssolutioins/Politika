import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Sidebar from "@/components/Sidebar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Polítika - Análisis Electoral Colombia 2023",
  description: "Plataforma de análisis de datos electorales de Colombia - Elecciones 2023",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Sidebar />
        <main className="ml-0 md:ml-64 min-h-screen p-4 pt-16 md:pt-6 md:p-6 transition-all duration-300">
          {children}
        </main>
      </body>
    </html>
  );
}
