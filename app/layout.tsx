import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner"; // 1. Импортируем Toaster
import AnalyticsProvider from "./components/AnalyticsProvider";
import AuthSessionCatcher from "./components/AuthSessionCatcher";
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
  title: "Jerdesh - Moscow",
  description: "Доска объявлений и сторис",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru" // Поменял на русский
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <AuthSessionCatcher /> {/* Google-вход, вернувшийся не на /auth/callback */}
        <AnalyticsProvider /> {/* PostHog Session Replay — только после согласия */}
        <Toaster position="top-right" richColors /> {/* 2. Добавляем компонент Toaster */}
      </body>
    </html>
  );
}