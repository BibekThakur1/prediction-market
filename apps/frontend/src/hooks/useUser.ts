import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

export function useUser(supabase: SupabaseClient) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  return { session, loading };
}
