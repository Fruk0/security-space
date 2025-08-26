// app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { ThemeProvider } from "@/components/theme-provider"; // ⬅️ next-themes wrapper
import { ThemeToggle } from "@/components/theme-toggle";     // ⬅️ botón de tema

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = { title: 'Security Space', description: 'Evaluación y priorización de riesgos' };


export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-dvh bg-background text-foreground`}
      >
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          {/* Header global con toggle */}
          <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
            <div className="mx-auto max-w-4xl px-4 py-2 flex justify-end">
              <ThemeToggle />
            </div>
          </header>

          <main className="mx-auto max-w-4xl px-4">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
