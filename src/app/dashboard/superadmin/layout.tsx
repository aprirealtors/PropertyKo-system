// src/app/dashboard/superadmin/layout.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      // Ensure a session exists AND the user is the super admin
      if (!session || session.user.email !== "superadmin@propertyko.com") {
        router.push("/login");
      } else {
        setIsAuthorized(true);
      }
    };

    checkAuth();
  }, [router]);

  if (!isAuthorized) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-white z-[100] fixed inset-0">
         <div className="w-10 h-10 border-4 border-[#0a1e3f]/20 border-t-[#0a1e3f] rounded-full animate-spin"></div>
      </div>
    );
  }

  return <>{children}</>;
}