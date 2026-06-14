import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Search, Loader2 } from "lucide-react";
import { searchUsers } from "@/lib/profiles.functions";
import { getOrCreateConversation } from "@/lib/conversations.functions";
import { Avatar } from "@/components/avatar";
import { VerifiedBadge } from "@/components/verified-badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type R = { id: string; username: string; display_name: string | null; avatar_url: string | null; verified: boolean };

export function UserSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<R[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const search = useServerFn(searchUsers);
  const create = useServerFn(getOrCreateConversation);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await search({ data: { q: q.trim() } });
        setResults(r);
      } catch (e: any) {
        // ignore
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [q, search]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function start(user: R) {
    try {
      const { id } = await create({ data: { otherUserId: user.id } });
      setQ("");
      setOpen(false);
      navigate({ to: "/app/c/$conversationId", params: { conversationId: id } });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not start chat");
    }
  }

  return (
    <div ref={ref} className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search by username"
        className="h-9 rounded-full bg-muted/40 pl-9 text-xs ring-1 ring-border focus-visible:ring-foreground/30"
      />
      {open && q.trim() && (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-72 overflow-y-auto rounded-xl bg-popover p-1.5 ring-1 ring-border shadow-2xl">
          {loading && (
            <div className="flex items-center justify-center p-3 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
            </div>
          )}
          {!loading && results.length === 0 && (
            <div className="p-3 text-center text-xs text-muted-foreground">No users found</div>
          )}
          {results.map((u) => (
            <button
              key={u.id}
              onClick={() => start(u)}
              className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted"
            >
              <Avatar name={u.display_name ?? u.username} url={u.avatar_url} size={32} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium">{u.display_name ?? u.username}</span>
                  {u.verified && <VerifiedBadge size={12} />}
                </div>
                <div className="truncate text-[11px] text-muted-foreground">@{u.username}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}