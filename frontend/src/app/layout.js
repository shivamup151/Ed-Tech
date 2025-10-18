import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/ui/theme-provider";
import Script from "next/script";

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
        >
          {children}
        </ThemeProvider>

        <Toaster />
        
        {/* Weglot Translation Script */}
        <Script
          src="https://cdn.weglot.com/weglot.min.js"
          strategy="afterInteractive"
        />
        <Script id="weglot-init" strategy="afterInteractive">
          {`
            if (typeof window !== 'undefined' && window.Weglot) {
              window.Weglot.initialize({
                api_key: '${process.env.NEXT_PUBLIC_WEGLOT_API_KEY}',
                original_language: 'en',
                destination_languages: 'ar',
                auto_switch: true,
                switcher: {
                  style: 'dropdown',
                  position: 'bottom-right'
                }
              });
            }
          `}
        </Script>
      </body>
    </html>
  );
}
