import type { Metadata, Viewport } from "next"; // ✨ ADDED: Viewport
import { Inter } from "next/font/google";
import "./globals.css";
import GlobalPresence from "@/components/GlobalPresence";
import { ThemeProvider, defaultTheme } from "@/components/ThemeProvider";
import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const inter = Inter({ subsets: ["latin"] });

// ✨ ADDED: Viewport configuration for mobile browsers
export const viewport: Viewport = {
  themeColor: "#f8fafc", 
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "PropertyKo - Role-Based Access",
  description: "One platform, five doors in. Your property. Made simple.",
  // ✨ ADDED: Apple web app configuration
  appleWebApp: {
    capable: true,
    title: "PropertyKo",
    statusBarStyle: "default",
  },
};

// ✨ SAFE SERVER-SIDE SUPABASE CLIENT 
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // ✨ FIX: Nilagyan natin ng 'await' ang headers() dahil Promise na siya sa bagong Next.js
  const headersList = await headers();
  const host = headersList.get("host") || "";
  
  // Logic para makuha ang subdomain (safe for both Localhost at Production)
  const isLocal = host.includes("localhost");
  const baseDomain = isLocal ? "localhost:3000" : "propertyko.com";
  const subdomain = host.replace(`.${baseDomain}`, "");

  let initialTheme = defaultTheme;

  // Hatakin ang Theme Base sa Subdomain (Kung may subdomain na tinype)
  if (subdomain && subdomain !== host && subdomain !== "www") {
    const { data, error } = await supabase
      .from("organizations")
      .select("theme_config")
      .eq("subdomain", subdomain)
      .single();

    if (!error && data?.theme_config) {
      initialTheme = data.theme_config;
    }
  }

  return (
    <html lang="en">
      <body className={`${inter.className} font-[family-name:var(--font-corporate)] bg-[var(--color-bg,#f8fafc)] min-h-screen flex flex-col transition-colors duration-300`}>
        <ThemeProvider initialTheme={initialTheme}>
          <GlobalPresence>
            {children}
          </GlobalPresence>
        </ThemeProvider>
      </body>
    </html>
  );
}