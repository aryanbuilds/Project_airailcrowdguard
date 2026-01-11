import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { UserCircle } from "lucide-react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Railway Anomaly Detection",
  description: "AI-Powered Railway Track Safety Monitoring",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
            <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold">R</div>
                <span className="text-xl font-bold tracking-tight text-foreground">TrackSafe AI</span>
              </div>
              <nav className="flex items-center gap-4">
                  <div className="flex items-center gap-4">
                    <a href="/upload" className="text-sm font-medium text-muted-foreground hover:text-foreground font-bold italic">Report</a>
                    <a href="/dashboard" className="text-sm font-medium text-muted-foreground hover:text-foreground font-bold italic">Dashboard</a>
                    <a href="/console" className="text-sm font-medium text-muted-foreground hover:text-foreground font-bold italic">Console</a>
                    <div className="flex items-center gap-2 pl-4 border-l">
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-bold">Admin User</span>
                        <span className="text-[10px] text-muted-foreground">Dummy Auth</span>
                      </div>
                      <div className="bg-slate-200 p-1.5 rounded-full">
                        <UserCircle className="h-6 w-6 text-slate-600" />
                      </div>
                    </div>
                  </div>
              </nav>
            </div>
          </header>
          <main>{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
