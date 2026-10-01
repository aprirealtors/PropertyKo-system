"use client";

import { useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
import { usePushNotifications } from "@/utils/usePushNotifications";

export default function GlobalPushListener({ userEmail, role }: { userEmail: string, role: string }) {
  const { token } = usePushNotifications();

  useEffect(() => {
    if (!userEmail) return;

    const normalizedRole = (role || "").toLowerCase().trim();
    const normalizedEmail = (userEmail || "").toLowerCase().trim();

    // 1. SYSTEM NOTIFICATIONS LISTENER
    const notifChannel = supabase.channel(`global-notifs-${normalizedEmail}`)
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          const msgRecipient = (payload.new.recipient || "").toLowerCase().trim();
          const msgAdminEmail = (payload.new.admin_email || "").toLowerCase().trim();

          const isForMe = 
            msgRecipient === normalizedEmail || 
            msgRecipient === normalizedRole ||
            (msgAdminEmail === normalizedEmail && ['admin', 'manager'].includes(msgRecipient));

          if (isForMe && typeof window !== "undefined" && Notification.permission === "granted") {
            const cleanMessage = payload.new.message?.replace(/<[^>]*>?/gm, '') || "New alert";
            new Notification(payload.new.title || "PropertyKo Update", {
              body: cleanMessage,
              icon: "/icon-192.png"
            });
          }
        }
      ).subscribe();

    // 2. DIRECT CHAT MESSAGES LISTENER 
    const chatChannel = supabase.channel(`global-chat-${normalizedEmail}`)
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => { 
          const msg = payload.new;
          const recipientRole = (msg.recipient_role || "").toLowerCase().trim();
          const senderEmail = (msg.sender_email || "").toLowerCase().trim();
          const tenantEmail = (msg.tenant_email || "").toLowerCase().trim();
          const adminEmail = (msg.admin_email || "").toLowerCase().trim();

          const isChatForMe = 
            recipientRole === normalizedRole || 
            tenantEmail === normalizedEmail || 
            msg.recipient_email?.toLowerCase().trim() === normalizedEmail ||
            (adminEmail === normalizedEmail && ['admin', 'manager'].includes(recipientRole));

          if (isChatForMe && senderEmail !== normalizedEmail && typeof window !== "undefined" && Notification.permission === "granted") {
            
            // ✨ DYNAMIC SENDER NAME LOGIC
            let displayName = msg.sender_email; 
            
            try {
              if (msg.sender_email === "superadmin@propertyko.com") {
                displayName = "PropertyKo Support";
              } 
              // ✨ IF SENDER IS THE ADMIN (Admin is NOT in team_members)
              else if (msg.sender_email === msg.admin_email) {
                displayName = "Property Admin"; // Fallback name
                
                // Fetch the Organization Name to look highly professional to the tenant
                const { data: org } = await supabase
                  .from('organizations')
                  .select('org_name')
                  .eq('admin_email', msg.admin_email)
                  .maybeSingle();
                  
                if (org?.org_name) {
                  displayName = org.org_name;
                }
              } 
              // ✨ IF SENDER IS A TENANT/MANAGER/STAFF (They ARE in team_members)
              else {
                const { data: member } = await supabase
                  .from('team_members')
                  .select('name')
                  .eq('email', msg.sender_email)
                  .limit(1)
                  .maybeSingle(); // maybeSingle guarantees this won't crash if duplicate emails exist
                  
                if (member?.name) {
                  displayName = member.name;
                }
              }
            } catch (error) {
              console.error("Could not fetch sender name for notification", error);
            }

            // TRIGGER THE NOTIFICATION WITH THE PROPER NAME
            new Notification("New Message", {
              body: `${displayName}: ${msg.content ? msg.content.substring(0, 60) : "Sent a message"}`,
              icon: "/icon-192.png"
            });
          }
        }
      ).subscribe();

    return () => {
      supabase.removeChannel(notifChannel);
      supabase.removeChannel(chatChannel);
    };
  }, [userEmail, role]);

  return null; 
}