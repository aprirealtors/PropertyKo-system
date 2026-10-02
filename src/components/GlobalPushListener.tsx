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

    // ✨ MOBILE FIX: Helper function to route notifications through the Service Worker
    const triggerNotification = async (title: string, options: any) => {
      if (typeof window !== "undefined" && Notification.permission === "granted") {
        try {
          if ('serviceWorker' in navigator) {
            // Mobile browsers require this to show the popup
            const registration = await navigator.serviceWorker.ready;
            await registration.showNotification(title, options);
          } else {
            // Fallback for older desktop browsers
            new Notification(title, options);
          }
        } catch (error) {
          console.error("Error triggering notification:", error);
          new Notification(title, options);
        }
      }
    };

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

          if (isForMe) {
            const cleanMessage = payload.new.message?.replace(/<[^>]*>?/gm, '') || "New alert";
            
            // ✨ Use the new mobile-friendly trigger
            triggerNotification(payload.new.title || "PropertyKo Update", {
              body: cleanMessage,
              icon: "/icon-192.png", // Keeps your full colored logo on the right side
              badge: "/badge.png",   // ✨ FIX: Points to the transparent silhouette for the left side
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

          if (isChatForMe && senderEmail !== normalizedEmail) {
            
            // DYNAMIC SENDER NAME LOGIC
            let displayName = msg.sender_email; 
            
            try {
              if (msg.sender_email === "superadmin@propertyko.com") {
                displayName = "PropertyKo Support";
              } 
              else if (msg.sender_email === msg.admin_email) {
                displayName = "Property Admin"; 
                
                const { data: org } = await supabase
                  .from('organizations')
                  .select('org_name')
                  .eq('admin_email', msg.admin_email)
                  .maybeSingle();
                  
                if (org?.org_name) {
                  displayName = org.org_name;
                }
              } 
              else {
                const { data: member } = await supabase
                  .from('team_members')
                  .select('name')
                  .eq('email', msg.sender_email)
                  .limit(1)
                  .maybeSingle(); 
                  
                if (member?.name) {
                  displayName = member.name;
                }
              }
            } catch (error) {
              console.error("Could not fetch sender name for notification", error);
            }

            // ✨ Use the new mobile-friendly trigger
            triggerNotification("New Message", {
              body: `${displayName}: ${msg.content ? msg.content.substring(0, 60) : "Sent a message"}`,
              icon: "/icon-192.png", // Keeps your full colored logo on the right side
              badge: "/badge.png"    // ✨ FIX: Points to the transparent silhouette for the left side
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