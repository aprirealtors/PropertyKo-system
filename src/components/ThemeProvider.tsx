"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

// ✨ THE PROPERTYKO DEFAULT SYSTEM THEME
export const defaultTheme = {
  primaryColor: "#359b46",      // PropertyKo Green
  secondaryColor: "#0a1e3f",    // Navy Blue
  backgroundColor: "#f8fafc",   // Slate 50 (App Canvas)
  textColor: "#334155",         // Slate 700 (Main Typography)
  borderColor: "#e2e8f0",       // Slate 200 (Dividers)
  borderRadius: "0.5rem",       // Modern (Interactive elements)
  fontFamily: "Inter",          // System Default Font
  enableShadows: true           // True for modern depth, False for flat
};

type ThemeContextType = {
  theme: typeof defaultTheme;
  setTheme: (theme: Partial<typeof defaultTheme>) => void;
};

const ThemeContext = createContext<ThemeContextType>({
  theme: defaultTheme,
  setTheme: () => {},
});

// ✨ LUMINANCE HELPER: Auto-computes readable text color (black/white) inside colored buttons
const getAccessibleTextColor = (hexColor: string) => {
  const hex = hexColor.replace("#", "");
  if (hex.length !== 6) return "#ffffff";
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? "#0f172a" : "#ffffff";
};

export function ThemeProvider({
  children,
  initialTheme,
}: {
  children: React.ReactNode;
  initialTheme?: Partial<typeof defaultTheme>;
}) {
  // Merge initial theme from server (proxy.ts) or fallback to default
  const [theme, setThemeState] = useState({ ...defaultTheme, ...initialTheme });

  const setTheme = (newTheme: Partial<typeof defaultTheme>) => {
    setThemeState((prev) => ({ ...prev, ...newTheme }));
  };

  // ✨ ENGINE: Injecting to CSS Variables globally
  useEffect(() => {
    const root = document.documentElement;
    const safePrimaryText = getAccessibleTextColor(theme.primaryColor);
    const isFlat = !theme.enableShadows;
    const r = theme.borderRadius;

    // Check if the corner style is highly restrictive (sharp/strict)
    const isStrictCorner = r === "0px" || r === "2px";

    // 1. Skin Colors (Balat)
    root.style.setProperty("--color-primary", theme.primaryColor);
    root.style.setProperty("--color-secondary", theme.secondaryColor);
    root.style.setProperty("--color-bg", theme.backgroundColor);
    root.style.setProperty("--color-text", theme.textColor);
    root.style.setProperty("--color-border", theme.borderColor);
    root.style.setProperty("--color-primary-text", safePrimaryText);

    // 2. Typography
    root.style.setProperty("--font-corporate", `"${theme.fontFamily}", sans-serif`);

    // 3. Safe Interactive Corners (Only affects small UI elements)
    root.style.setProperty("--radius-sm", isStrictCorner ? r : "0.25rem");
    root.style.setProperty("--radius-md", isStrictCorner ? r : "0.375rem");
    root.style.setProperty("--radius-lg", isStrictCorner ? r : "0.5rem");
    root.style.setProperty("--radius-xl", isStrictCorner ? r : "0.75rem");
    
    // Note: --radius-2xl, 3xl, max are INTENTIONALLY NOT OVERRIDDEN 
    // to preserve structural layout of your modals and main containers.

    // 4. Depth & Shadows
    root.style.setProperty("--shadow-sm", isFlat ? "none" : "0 1px 2px 0 rgba(0, 0, 0, 0.05)");
    root.style.setProperty("--shadow-md", isFlat ? "none" : "0 4px 6px -1px rgba(0, 0, 0, 0.1)");
    root.style.setProperty("--shadow-lg", isFlat ? "none" : "0 10px 15px -3px rgba(0, 0, 0, 0.1)");
    root.style.setProperty("--shadow-inner", isFlat ? "none" : "inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)");
    
    // 5. Advanced Sidebar Logic (Prevents layout jumping)
    root.style.setProperty("--nav-active-text", isFlat ? "white" : safePrimaryText);
    root.style.setProperty("--nav-active-bg", isFlat ? "transparent" : theme.primaryColor);
    root.style.setProperty("--nav-border-left-width", isFlat ? "3px" : "0px");

  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);