"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/utils/supabase/client";
import { usePushNotifications } from "@/utils/usePushNotifications";

export default function GlobalPushListener({ userEmail, role }: { userEmail: string, role: string }) {
  const { token, requestPermission } = usePushNotifications();
  
  // ✨ FIX: Create a ref to hold our preloaded audio
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ✨ FIX: Preload the audio once when the component mounts
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

  useEffect(() => {
    if (!userEmail) return;

    const normalizedRole = (role || "").toLowerCase().trim();
    const normalizedEmail = (userEmail || "").toLowerCase().trim();

    // ✨ FIX: Use the preloaded audio reference
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

          const isForMe = 
            msgRecipient === normalizedEmail || 
            msgRecipient === normalizedRole ||
            (msgAdminEmail === normalizedEmail && ['admin', 'manager'].includes(msgRecipient));

          if (isForMe) {
            const cleanMessage = payload.new.message?.replace(/<[^>]*>?/gm, '') || "New alert";
            
            triggerNotification(payload.new.title || "PropertyKo Update", {
              body: cleanMessage,
              icon: "/icon-192.png", 
              badge: "/badge.png",   
              vibrate: [200, 100, 200], 
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
  }, [userEmail, role]);

  return null; 
}