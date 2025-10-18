import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/ui/theme-provider";
import Script from "next/script";
import WeglotProvider from "@/components/WeglotProvider";
import NoSSR from "@/components/NoSSR";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "School AI Platform",
  description: "School AI Platform",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning={true}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          suppressHydrationWarning
        >
          <div suppressHydrationWarning>
            {children}
          </div>
        </ThemeProvider>

        <Toaster />
        
        {/* Weglot Translation Script */}
        <NoSSR>
          <Script
            src="https://cdn.weglot.com/weglot.min.js"
            strategy="lazyOnload"
          />
          <WeglotProvider />
        </NoSSR>
      </body>
    </html>
  );
}
