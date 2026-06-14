import { createFileRoute, Link, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LogOut, Settings as SettingsIcon, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Logo, Wordmark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserSearch } from "@/components/user-search";
import { ConversationList } from "@/components/conversation-list";
import { Button } from "@/components/ui/button";
import { listMyConversations } from "@/lib/conversations.functions";
import { heartbeat } from "@/lib/profiles.functions";
import { amIAdmin } from "@/lib/admin.functions";
import { toast } from "sonner";
import { cn, debounceInvalidation } from "@/lib/utils";

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

  // Detect if a conversation is active (for mobile layout switching)
  const params = useParams({ strict: false }) as { conversationId?: string };
  const hasActiveConversation = !!params.conversationId;

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const u = data.user;
      if (!u) return;
      const { data: prof } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", u.id)
        .maybeSingle();
      setMe({
        id: u.id,
        email: u.email ?? null,
        username: prof?.username ?? u.email?.split("@")[0] ?? "you",
      });
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

  // Realtime: debounce invalidation to prevent stampeding on rapid changes
  useEffect(() => {
    const ch = supabase
      .channel("app-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        debounceInvalidation(queryClient, [["conversations"], ["messages"]]);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => {
        debounceInvalidation(queryClient, [["conversations"]]);
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversation_status" },
        () => {
          debounceInvalidation(queryClient, [["conversations"]]);
        },
      )
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
    <div className="flex h-dvh min-h-0 overflow-hidden bg-background text-foreground">
      {/* Sidebar: full-screen on mobile, fixed 320px on desktop */}
      <aside
        className={cn(
          "flex shrink-0 flex-col border-r border-border bg-sidebar",
          "w-full md:w-80",
          // On mobile: show sidebar only when no conversation is active
          hasActiveConversation ? "hidden md:flex" : "flex",
        )}
      >
        <div className="border-b border-border p-5">
          <div className="mb-5 flex items-center justify-between">
            <Link to="/app" className="flex items-center gap-2">
              <Logo size={28} />
              <Wordmark className="text-xl" />
            </Link>
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <Link to="/settings">
                <Button variant="ghost" size="icon" aria-label="Settings">
                  <SettingsIcon className="size-4" />
                </Button>
              </Link>
              {isAdminQ.data?.admin && (
                <Link to="/admin">
                  <Button variant="ghost" size="icon" aria-label="Admin">
                    <Shield className="size-4 text-amber-400" />
                  </Button>
                </Link>
              )}
              <Button variant="ghost" size="icon" aria-label="Sign out" onClick={signOut}>
                <LogOut className="size-4" />
              </Button>
            </div>
          </div>
          <UserSearch />
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto">
          <ConversationList items={conversations.data ?? []} loading={conversations.isLoading} />
        </nav>

        <div className="border-t border-border bg-sidebar/80 p-4">
          <div className="flex items-center gap-3">
            <div className="grid size-8 place-items-center rounded-full brand-gradient text-[10px] font-bold text-white ring-1 ring-white/20">
              {(me?.username ?? "?").slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">@{me?.username ?? "you"}</div>
              <div className="truncate text-[10px] uppercase tracking-widest text-muted-foreground">
                Online
              </div>
            </div>
          </div>
          <p className="mt-3 text-center text-[10px] leading-relaxed text-muted-foreground/80">
            Chats disappear permanently
            <br />
            after both participants leave.
          </p>
        </div>
      </aside>

      {/* Main chat area: full-screen on mobile when conversation active */}
      <main
        className={cn(
          "relative flex min-h-0 flex-col bg-card",
          "w-full md:flex-1",
          hasActiveConversation ? "flex" : "hidden md:flex",
        )}
      >
        <Outlet />
      </main>
    </div>
  );
}
