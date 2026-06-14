import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  component: Index,
});

function Index() {
  const [target, setTarget] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setTarget(data.session ? "/app" : "/auth");
    });
  }, []);
  if (!target) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="size-6 animate-pulse rounded-full brand-gradient" />
      </div>
    );
  }
  return <Navigate to={target} />;
}
