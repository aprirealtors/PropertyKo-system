"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from "@/utils/supabase/client";

const PresenceContext = createContext<string[]>([]);

export const usePresence = () => useContext(PresenceContext);

export default function GlobalPresence({ children }: { children: React.ReactNode }) {
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

  useEffect(() => {
    let channel: any = null;

    const setupPresence = async (user: any) => {
      if (!user?.email) return;
      
      const email = user.email;
      const adminEmail = user.user_metadata?.admin_parent || email;
      const topic = `online-users-${adminEmail}`;

      // 🔥 THE FIX: Hanapin at tanggalin ang existing channel bago gumawa ng bago
      // para iwas "cannot add presence callbacks after subscribe()" error
      const existingChannels = supabase.getChannels();
      existingChannels.forEach((c) => {
        if (c.topic === `realtime:${topic}`) {
          supabase.removeChannel(c);
        }
      });

      // Safe na gumawa ng bagong channel
      channel = supabase.channel(topic, {
        config: { presence: { key: email } },
      });

      channel
        .on('presence', { event: 'sync' }, () => {
          const newState = channel.presenceState();
          setOnlineUsers(Object.keys(newState));
        })
        .on('presence', { event: 'join' }, ({ key }: any) => {
          setOnlineUsers((prev) => Array.from(new Set([...prev, key])));
        })
        .on('presence', { event: 'leave' }, ({ key }: any) => {
          setOnlineUsers((prev) => prev.filter(u => u !== key));
        })
        .subscribe(async (status: string) => {
          if (status === 'SUBSCRIBED') {
            await channel.track({ email: email, online_at: new Date().toISOString() });
          }
        });
    };

    // 1. Initial Check
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setupPresence(session.user);
      }
    };
    
    init();

    // 2. Auth State Listener
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        if (channel) {
          supabase.removeChannel(channel);
          channel = null;
        }
        setOnlineUsers([]);
      } else if (event === 'SIGNED_IN' && session?.user) {
        setupPresence(session.user);
      }
    });

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
      authListener.subscription.unsubscribe();
    };
  }, []);

  return (
    <PresenceContext.Provider value={onlineUsers}>
      {children}
    </PresenceContext.Provider>
  );
}