"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import GlobalPushListener from "@/components/GlobalPushListener";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [userContext, setUserContext] = useState<{ email: string; role: string } | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      const email = session.user.email || "";
      let role = session.user.user_metadata?.role;

      // SAFETY FALLBACK: If role is missing from auth metadata, grab it directly from the database
      if (!role) {
        const { data: teamMember } = await supabase
          .from('team_members')
          .select('role')
          .eq('email', email)
          .single();

        if (teamMember?.role) {
          // Normalize names like "Property manager" to "manager"
          role = teamMember.role.toLowerCase().includes("manager") ? "manager" : teamMember.role.toLowerCase();
        } else {
          // Default to tenant if totally unknown
          role = "tenant";
        }
      }

      setUserContext({ email, role: role.toLowerCase() });
      setIsAuthorized(true);
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

  return (
    <>
      {/* This invisible component runs the push notifications in the background */}
      {userContext && <GlobalPushListener userEmail={userContext.email} role={userContext.role} />}
      
      {children}
    </>
  );
}