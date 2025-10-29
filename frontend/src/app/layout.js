import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/ui/theme-provider";
import Script from "next/script";
import WeglotProvider from "@/components/WeglotProvider";
import NoSSR from "@/components/NoSSR";
import CleanupService from "@/components/cleanup-service";
import "@/lib/hydration-error-handler"; // Suppress hydration errors globally

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Al Tajheez School AI Platform",
  description: "Al Tajheez School AI Platform - Advanced Educational Technology Solutions",
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning={true}
      >
        {/* Multiple layers of hydration suppression */}
        <div suppressHydrationWarning>
          <div suppressHydrationWarning>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
              suppressHydrationWarning
            >
              <div suppressHydrationWarning>
                <div suppressHydrationWarning>
                  {children}
                </div>
              </div>
            </ThemeProvider>

            <div suppressHydrationWarning>
              <Toaster suppressHydrationWarning />
            </div>
            
            {/* Weglot Translation Script */}
            <NoSSR>
              <div suppressHydrationWarning>
                <Script
                  src="https://cdn.weglot.com/weglot.min.js"
                  strategy="lazyOnload"
                  suppressHydrationWarning
                />
                <WeglotProvider />
              </div>
            </NoSSR>
            
            {/* Background Cleanup Service */}
            <NoSSR>
              <CleanupService />
            </NoSSR>
          </div>
        </div>
      </body>
    </html>
  );
}