import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Custom Cookie Storage for Supabase
const sharedCookieStorage = {
  getItem: (key: string) => {
    if (typeof document === "undefined") return null;
    const match = document.cookie.match(new RegExp("(^| )" + encodeURIComponent(key) + "=([^;]+)"));
    return match ? decodeURIComponent(match[2]) : null;
  },
  setItem: (key: string, value: string) => {
    if (typeof document === "undefined") return;
    const host = window.location.hostname;
    
    if (host.includes("propertyko.com")) {
      // PRODUCTION: Use leading dot to share across ALL subdomains
      document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}; domain=.propertyko.com; path=/; max-age=31536000; SameSite=Lax; Secure`;
    } else {
      // LOCALHOST: Browsers reject "domain=localhost", so we must omit it
      document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax`;
    }
  },
  removeItem: (key: string) => {
    if (typeof document === "undefined") return;
    const host = window.location.hostname;
    
    if (host.includes("propertyko.com")) {
      document.cookie = `${encodeURIComponent(key)}=; domain=.propertyko.com; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    } else {
      document.cookie = `${encodeURIComponent(key)}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    }
  },
};

// Initialize Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: sharedCookieStorage,
  },
});