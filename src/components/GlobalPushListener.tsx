"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/utils/supabase/client";
import { usePushNotifications } from "@/utils/usePushNotifications";

export default function GlobalPushListener({ userEmail, role }: { userEmail: string, role: string }) {
  const { token, requestPermission } = usePushNotifications();
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const audio = new Audio('/notification.wav');
      audio.preload = "auto"; 
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

  const [userAccessLevel, setUserAccessLevel] = useState<string>("");

  // ✨ FIX 1: Robustly map "property_manager" (with underscore) to "manager"
  const getMappedRole = (rawRole: string) => {
    const r = (rawRole || "").toLowerCase().trim().replace('_', ' ');
    return (r === "property manager" || r === "manager") ? "manager" : r;
  };

  useEffect(() => {
    const fetchAccessLevel = async () => {
      const currentRole = getMappedRole(role);
      
      // Now it will correctly identify 'manager' and proceed!
      if (!userEmail || (currentRole !== 'assistant' && currentRole !== 'manager')) return;
      
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
  }, [userEmail, role]);

  const isAllowedNotif = (notif: any, currentRole: string, accessScope: string) => {
    if (currentRole === 'admin') return true; 
    // ✨ FIX 2: Check against the mapped role
    if (currentRole !== 'assistant' && currentRole !== 'manager') return true; 

    const type = (notif.type || '').toUpperCase();
    const title = (notif.title || '').toUpperCase();
    
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
    
    // Allow managers/assistants to see admin alerts if they have broad enough scopes
    if (notif.recipient === 'ADMIN' || notif.recipient === notif.admin_email) {
      return hasAccess("All properties") || hasAccess("Full Platform Access") || hasAccess("Billing") || hasAccess("Leasing & Tenants");
    }

    return true; 
  };

  useEffect(() => {
    if (!userEmail) return;

    // ✨ FIX 3: Use the mapped role across all event listeners
    const mappedRole = getMappedRole(role);
    const normalizedEmail = (userEmail || "").toLowerCase().trim();

    const playNotificationSound = () => {
      try {
        if (audioRef.current) {
          audioRef.current.currentTime = 0; 
          audioRef.current.play().catch((err) => console.log("Audio blocked by browser autoplay policy.", err));
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
            const registrations = await navigator.serviceWorker.getRegistrations();
            if (registrations.length > 0) {
              await registrations[0].showNotification(title, options);
            } else {
              new Notification(title, options);
            }
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

          let isForMe = false;

          if (mappedRole === 'assistant' || mappedRole === 'manager') {
            isForMe = msgRecipient === normalizedEmail || 
                      msgRecipient === 'assistant' || 
                      msgRecipient === 'manager' || 
                      msgRecipient === 'admin' || 
                      msgAdminEmail === normalizedEmail ||
                      msgRecipient === msgAdminEmail; // ✨ ALLOWS THEM TO HEAR COMPANY-WIDE ALERTS
          } else if (mappedRole === 'admin') {
            isForMe = msgRecipient === 'admin' || msgAdminEmail === normalizedEmail || msgRecipient === normalizedEmail;
          } else {
            isForMe = msgRecipient === normalizedEmail || msgRecipient === mappedRole;
          }

          if (isForMe) {
            if (isAllowedNotif(payload.new, mappedRole, userAccessLevel)) {
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

          let isChatForMe = false;

          if (mappedRole === 'assistant' || mappedRole === 'manager') {
             isChatForMe = recipientRole === 'assistant' || 
                           recipientRole === 'manager' || 
                           recipientRole === 'admin' || 
                           tenantEmail === normalizedEmail || 
                           msg.recipient_email?.toLowerCase().trim() === normalizedEmail ||
                           adminEmail === normalizedEmail;
          } else if (mappedRole === 'admin') {
             isChatForMe = recipientRole === 'admin' || 
                           adminEmail === normalizedEmail || 
                           msg.recipient_email?.toLowerCase().trim() === normalizedEmail;
          } else {
             isChatForMe = recipientRole === mappedRole || 
                           tenantEmail === normalizedEmail || 
                           msg.recipient_email?.toLowerCase().trim() === normalizedEmail;
          }

          if (isChatForMe && senderEmail !== normalizedEmail) {
            
            if ((mappedRole === 'assistant' || mappedRole === 'manager') && 
                !userAccessLevel.includes("Conversation") && 
                !userAccessLevel.includes("Full Platform Access") &&
                !userAccessLevel.includes("All properties")) {
              return; 
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
  }, [userEmail, role, userAccessLevel]); 

  return null; 
}