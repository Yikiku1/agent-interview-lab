import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { SiteHeader } from "@/components/layout/site-header";
import { ThemeProvider } from "@/components/layout/theme-provider";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "面试训练台", template: "%s · 面试训练台" },
  description: "Agent 开发与 LLM 应用开发岗位面试题训练工具",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="zh-CN"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body className="min-h-screen font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <a href="#main-content" className="skip-link">
            跳到主要内容
          </a>
          <SiteHeader />
          <main id="main-content" tabIndex={-1} className="app-container">
            {children}
          </main>
          <Toaster
            position="top-right"
            closeButton
            toastOptions={{
              style: {
                background: "var(--surface)",
                color: "var(--foreground)",
                borderColor: "var(--border)",
                fontFamily: "inherit",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
