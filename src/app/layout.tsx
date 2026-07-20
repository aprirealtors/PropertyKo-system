// import type { Metadata } from "next";
// import { Inter } from "next/font/google";
// import "./globals.css";
// import GlobalPresence from "@/components/GlobalPresence";
// const inter = Inter({ subsets: ["latin"] });

// export const metadata: Metadata = {
//   title: "PropertyKo - Role-Based Access",
//   description: "One platform, five doors in. Your property. Made simple.",
// };

// export default function RootLayout({
//   children,
// }: Readonly<{
//   children: React.ReactNode;
// }>) {
//   return (
//     <html lang="en">
//       <body className={`${inter.className} bg-slate-50 min-h-screen flex flex-col`}>
//         {children}
//       </body>
//     </html>
//   );
// }

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import GlobalPresence from "@/components/GlobalPresence";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PropertyKo - Role-Based Access",
  description: "One platform, five doors in. Your property. Made simple.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-slate-50 min-h-screen flex flex-col`}>
        {/* Binalot natin ang children para lahat ng pages ay may access sa online users */}
        <GlobalPresence>
          {children}
        </GlobalPresence>
      </body>
    </html>
  );
}