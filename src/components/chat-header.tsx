import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { VerifiedBadge } from "@/components/verified-badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { leaveConversation } from "@/lib/conversations.functions";
import { isOnline, formatRelative } from "@/lib/format";
import { toast } from "sonner";

type Other = { id: string; username: string; display_name: string | null; avatar_url: string | null; verified: boolean; last_seen_at: string };

export function ChatHeader({ conversationId, other, onLeft }: { conversationId: string; other: Other | null; onLeft: () => void }) {
  const leave = useServerFn(leaveConversation);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function handleLeave() {
    setBusy(true);
    try {
      await leave({ data: { id: conversationId } });
      toast.success("You left this conversation");
      onLeft();
      navigate({ to: "/app" });
    } catch (e: any) {
      toast.error(e?.message ?? "Leave failed");
    } finally {
      setBusy(false);
    }
  }

  if (!other) return null;
  const online = isOnline(other.last_seen_at);

  return (
    <header className="flex h-20 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-md sm:px-8">
      <div className="flex items-center gap-4">
        <Avatar name={other.display_name ?? other.username} url={other.avatar_url} size={40} />
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl tracking-tight">{other.display_name ?? other.username}</h2>
            {other.verified && <VerifiedBadge size={14} />}
            <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">@{other.username}</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {online ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-emerald-400" /> Online
              </span>
            ) : (
              `Last seen ${formatRelative(other.last_seen_at)} ago`
            )}
          </p>
        </div>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs uppercase tracking-widest text-destructive hover:bg-destructive/10 hover:text-destructive">
            <LogOut className="size-3.5" />
            Leave
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave this conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              Chats disappear permanently after both participants leave. Your messages and any shared media will be deleted from this conversation when {other.display_name ?? other.username} also leaves.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLeave} disabled={busy} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Leave conversation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
}