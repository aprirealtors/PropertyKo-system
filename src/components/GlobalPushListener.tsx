"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/utils/supabase/client";
import { usePushNotifications } from "@/utils/usePushNotifications";

export default function GlobalPushListener({ userEmail, role }: { userEmail: string, role: string }) {
  const { token, requestPermission } = usePushNotifications();
  
  // Create a ref to hold our preloaded audio
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Preload the audio once when the component mounts
  useEffect(() => {
    if (typeof window !== "undefined") {
      const audio = new Audio('/notification.wav');
      audio.preload = "auto"; // Tells the browser to download it immediately
      audioRef.current = audio;
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && Notification.permission === "granted" && !token) {
      if (requestPermission) {
        requestPermission(); 
      }
    }
  }, [token, requestPermission]);

  // State to hold the user's specific module access levels if they are an assistant
  const [userAccessLevel, setUserAccessLevel] = useState<string>("");

  // Fetch access level on mount to ensure we have the latest scopes
  useEffect(() => {
    const fetchAccessLevel = async () => {
      if (!userEmail) return;
      const { data } = await supabase
        .from('team_members')
        .select('access_level')
        .eq('email', userEmail)
        .single();
      
      if (data?.access_level) {
        setUserAccessLevel(data.access_level);
      }
    };
    fetchAccessLevel();
  }, [userEmail]);

  // Dynamic Notification Filter exactly like the Dashboard
  const isAllowedNotif = (notif: any, currentRole: string, accessScope: string) => {
    if (currentRole === 'admin' || currentRole === 'manager') return true; // Admins and managers see everything
    if (currentRole !== 'assistant') return true; // Tenants/Owners pass through to exact-email checks

    const type = (notif.type || '').toUpperCase();
    const title = (notif.title || '').toUpperCase();
    
    // Check if the assistant has the specific module in their access scope string
    const hasAccess = (moduleName: string) => {
      if (!accessScope) return false;
      if (accessScope.includes("All properties") || accessScope.includes("Full Platform Access")) return true;
      return accessScope.includes(moduleName);
    };

    if (type === 'TICKET' || type === 'MAINTENANCE') return hasAccess("Maintenance");
    if (type.includes('PAYMENT') || type === 'BILLING' || type === 'SOA' || type === 'SUBSCRIPTION' || title.includes('PAYMENT')) return hasAccess("Billing");
    if (type === 'MESSAGE' || type === 'CHAT') return hasAccess("Conversation");
    if (type.includes('LEASE') || type.includes('TENANT')) return hasAccess("Leasing & Tenants") || hasAccess("Properties & Units");
    if (type.includes('PROPERTY') || type.includes('UNIT')) return hasAccess("Properties & Units");
    if (type.includes('USER') || type.includes('ACCOUNT')) return hasAccess("User");
    if (type === 'KPI' || type === 'REPORT') return hasAccess("KPI Reports");
    
    // If it's a general admin alert, require full access
    if (notif.recipient === 'ADMIN') {
      return hasAccess("All properties") || hasAccess("Full Platform Access");
    }

    return true; 
  };

  useEffect(() => {
    if (!userEmail) return;

    const normalizedRole = (role || "").toLowerCase().trim();
    const normalizedEmail = (userEmail || "").toLowerCase().trim();

    // Use the preloaded audio reference
    const playNotificationSound = () => {
      try {
        if (audioRef.current) {
          // Reset the time to 0 so it can play immediately even if triggered twice quickly
          audioRef.current.currentTime = 0; 
          audioRef.current.play().catch((err) => console.log("Audio blocked by browser autoplay policy:", err));
        }
      } catch (error) {
        console.error("Error playing sound:", error);
      }
    };

    const triggerNotification = async (title: string, options: any) => {
      if (typeof window !== "undefined" && Notification.permission === "granted") {
        
        playNotificationSound();

        try {
          if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.ready;
            await registration.showNotification(title, options);
          } else {
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

          // ✨ FIX: Allow Assistants to catch 'admin' and 'manager' notifications if their scopes allow it
          let isForMe = false;

          if (normalizedRole === 'assistant') {
            isForMe = msgRecipient === normalizedEmail || 
                      msgRecipient === 'assistant' || 
                      msgRecipient === 'admin' || 
                      msgRecipient === 'manager' || 
                      msgAdminEmail === normalizedEmail;
          } else {
            isForMe = msgRecipient === normalizedEmail || 
                      msgRecipient === normalizedRole ||
                      (msgAdminEmail === normalizedEmail && ['admin', 'manager'].includes(msgRecipient));
          }

          if (isForMe) {
            // ✨ FIX: Validate against the assistant's specific module access scopes before triggering!
            if (isAllowedNotif(payload.new, normalizedRole, userAccessLevel)) {
              const cleanMessage = payload.new.message?.replace(/<[^>]*>?/gm, '') || "New alert";
              
              triggerNotification(payload.new.title || "PropertyKo Update", {
                body: cleanMessage,
                icon: "/icon-192.png", 
                badge: "/badge.png",   
                vibrate: [200, 100, 200], 
              });
            }
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

          // ✨ FIX: Allow Assistants to catch chat messages routed to admins/managers if they have 'Conversation' scope
          let isChatForMe = false;

          if (normalizedRole === 'assistant') {
             isChatForMe = recipientRole === 'assistant' || 
                           recipientRole === 'admin' || 
                           recipientRole === 'manager' ||
                           tenantEmail === normalizedEmail || 
                           msg.recipient_email?.toLowerCase().trim() === normalizedEmail ||
                           adminEmail === normalizedEmail;
          } else {
             isChatForMe = recipientRole === normalizedRole || 
                           tenantEmail === normalizedEmail || 
                           msg.recipient_email?.toLowerCase().trim() === normalizedEmail ||
                           (adminEmail === normalizedEmail && ['admin', 'manager'].includes(recipientRole));
          }

          // Ensure they don't get a sound for their own message, and if they are an assistant, check scope
          if (isChatForMe && senderEmail !== normalizedEmail) {
            
            // Check conversation scope for assistants
            if (normalizedRole === 'assistant' && !userAccessLevel.includes("Conversation") && !userAccessLevel.includes("Full Platform Access")) {
              return; // Block sound if they don't have message access
            }

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

            triggerNotification("New Message", {
              body: `${displayName}: ${msg.content ? msg.content.substring(0, 60) : "Sent a message"}`,
              icon: "/icon-192.png", 
              badge: "/badge.png",
              vibrate: [200, 100, 200], 
            });
          }
        }
      ).subscribe();

    return () => {
      supabase.removeChannel(notifChannel);
      supabase.removeChannel(chatChannel);
    };
  }, [userEmail, role, userAccessLevel]); // Re-run if access level changes

  return null; 
}