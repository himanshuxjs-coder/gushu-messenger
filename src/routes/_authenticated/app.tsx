import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LogOut, Settings as SettingsIcon, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Logo, Wordmark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserSearch } from "@/components/user-search";
import { ConversationList } from "@/components/conversation-list";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { listMyConversations } from "@/lib/conversations.functions";
import { heartbeat } from "@/lib/profiles.functions";
import { amIAdmin } from "@/lib/admin.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppShell,
});

function AppShell() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const listFn = useServerFn(listMyConversations);
  const beat = useServerFn(heartbeat);
  const isAdminFn = useServerFn(amIAdmin);
  const [me, setMe] = useState<{ id: string; email: string | null; username: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const u = data.user;
      if (!u) return;
      const { data: prof } = await supabase.from("profiles").select("username").eq("id", u.id).maybeSingle();
      setMe({ id: u.id, email: u.email ?? null, username: prof?.username ?? u.email?.split("@")[0] ?? "you" });
    });
  }, []);

  useEffect(() => {
    beat({ data: undefined as any }).catch(() => {});
    const t = setInterval(() => beat({ data: undefined as any }).catch(() => {}), 45_000);
    return () => clearInterval(t);
  }, [beat]);

  const conversations = useQuery({
    queryKey: ["conversations"],
    queryFn: () => listFn({ data: undefined as any }),
  });

  const isAdminQ = useQuery({
    queryKey: ["amIAdmin"],
    queryFn: () => isAdminFn({ data: undefined as any }),
  });

  // Realtime: invalidate on any messages / conversations change
  useEffect(() => {
    const ch = supabase
      .channel("app-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
        queryClient.invalidateQueries({ queryKey: ["messages"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => {
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_status" }, () => {
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [queryClient]);

  // Title unread counter
  useEffect(() => {
    const totalUnread = (conversations.data ?? []).reduce((n, c) => n + c.unread, 0);
    document.title = totalUnread > 0 ? `(${totalUnread}) Gushu` : "Gushu";
  }, [conversations.data]);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex h-screen min-h-0 bg-background text-foreground">
      <aside className="flex w-80 shrink-0 flex-col border-r border-border bg-sidebar">
        <div className="border-b border-border p-5">
          <div className="mb-5 flex items-center justify-between">
            <Link to="/app" className="flex items-center gap-2">
              <Logo size={28} />
              <Wordmark className="text-xl" />
            </Link>
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <Link to="/settings">
                <Button variant="ghost" size="icon" aria-label="Settings"><SettingsIcon className="size-4" /></Button>
              </Link>
              {isAdminQ.data?.admin && (
                <Link to="/admin">
                  <Button variant="ghost" size="icon" aria-label="Admin"><Shield className="size-4 text-amber-400" /></Button>
                </Link>
              )}
              <Button variant="ghost" size="icon" aria-label="Sign out" onClick={signOut}><LogOut className="size-4" /></Button>
            </div>
          </div>
          <UserSearch />
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto">
          <ConversationList items={conversations.data ?? []} />
        </nav>

        <div className="border-t border-border bg-sidebar/80 p-4">
          <div className="flex items-center gap-3">
            <div className="grid size-8 place-items-center rounded-full brand-gradient text-[10px] font-bold text-white ring-1 ring-white/20">
              {(me?.username ?? "?").slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">@{me?.username ?? "you"}</div>
              <div className="truncate text-[10px] uppercase tracking-widest text-muted-foreground">Online</div>
            </div>
          </div>
          <p className="mt-3 text-center text-[10px] leading-relaxed text-muted-foreground/80">
            Chats disappear permanently<br />after both participants leave.
          </p>
        </div>
      </aside>

      <main className="relative flex min-h-0 flex-1 flex-col bg-card">
        <Outlet />
      </main>
    </div>
  );
}