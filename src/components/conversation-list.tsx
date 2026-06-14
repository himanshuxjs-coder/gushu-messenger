import { Link, useParams } from "@tanstack/react-router";
import { memo } from "react";
import { VerifiedBadge } from "@/components/verified-badge";
import { Avatar } from "@/components/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelative, isOnline } from "@/lib/format";
import { cn } from "@/lib/utils";

type Item = {
  id: string;
  other: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    verified: boolean;
    last_seen_at: string;
  } | null;
  last: {
    content: string | null;
    message_type: string;
    created_at: string;
    sender_id: string;
  } | null;
  unread: number;
  last_message_at: string;
};

export const ConversationList = memo(function ConversationList({
  items,
  loading,
}: {
  items: Item[];
  loading?: boolean;
}) {
  const params = useParams({ strict: false }) as { conversationId?: string };

  if (loading) {
    return (
      <div className="divide-y divide-border">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-3 p-4">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2 pt-1">
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="p-6 text-center text-xs text-muted-foreground">
        No conversations yet. Search for a user to start one.
      </div>
    );
  }
  return (
    <div className="divide-y divide-border">
      {items.map((c) => {
        const isActive = params.conversationId === c.id;
        const o = c.other;
        const preview = c.last
          ? c.last.message_type === "text"
            ? (c.last.content ?? "")
            : c.last.message_type === "image"
              ? "📷 Photo"
              : c.last.message_type === "video"
                ? "🎬 Video"
                : "📎 File"
          : "Say hello";
        return (
          <Link
            key={c.id}
            to="/app/c/$conversationId"
            params={{ conversationId: c.id }}
            className={cn(
              "block p-4 transition-colors hover:bg-muted/40",
              isActive && "bg-muted/60",
            )}
          >
            <div className="flex gap-3">
              <div className="relative shrink-0">
                <Avatar
                  name={o?.display_name ?? o?.username ?? "?"}
                  url={o?.avatar_url}
                  size={40}
                />
                {o && isOnline(o.last_seen_at) && (
                  <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-400 ring-2 ring-sidebar" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="truncate text-sm font-medium text-foreground">
                      {o?.display_name ?? o?.username}
                    </span>
                    {o?.verified && <VerifiedBadge size={12} />}
                  </div>
                  <span className="ml-2 shrink-0 text-[10px] text-muted-foreground">
                    {formatRelative(c.last_message_at)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={cn(
                      "truncate text-xs",
                      c.unread > 0 ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {preview}
                  </p>
                  {c.unread > 0 && (
                    <span className="grid size-4 shrink-0 place-items-center rounded-full brand-gradient text-[9px] font-bold text-white">
                      {c.unread > 9 ? "9+" : c.unread}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
});
