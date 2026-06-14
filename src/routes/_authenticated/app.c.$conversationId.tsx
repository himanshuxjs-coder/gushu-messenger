import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getConversation } from "@/lib/conversations.functions";
import { listMessages, markRead } from "@/lib/messages.functions";
import { ChatHeader } from "@/components/chat-header";
import { MessageBubble } from "@/components/message-bubble";
import { Composer } from "@/components/composer";
import { Loader as Loader2, CircleAlert as AlertCircle } from "lucide-react";
import { debounceInvalidation } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/c/$conversationId")({
  component: ChatPage,
});

function ChatPage() {
  const { conversationId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const meId = user.id;
  const getConv = useServerFn(getConversation);
  const listMsgs = useServerFn(listMessages);
  const mark = useServerFn(markRead);
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);

  const conv = useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: () => getConv({ data: { id: conversationId } }),
  });

  const msgs = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: () => listMsgs({ data: { conversationId } }),
  });

  // Realtime subscription scoped to this conversation (debounced)
  useEffect(() => {
    const ch = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          debounceInvalidation(queryClient, [["messages", conversationId], ["conversations"]]);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [conversationId, queryClient]);

  // Mark read on initial load or when new messages arrive
  useEffect(() => {
    if (msgs.data && msgs.data.length) {
      mark({ data: { conversationId } }).catch(() => {});
    }
  }, [conversationId, msgs.data?.length, mark]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.data?.length]);

  const onEdited = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["messages", conversationId] }),
    [queryClient, conversationId],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ChatHeader
        conversationId={conversationId}
        other={conv.data?.other ?? null}
        onLeft={() => queryClient.invalidateQueries({ queryKey: ["conversations"] })}
      />
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-6 space-y-5 sm:px-8">
        {msgs.isLoading && (
          <div className="grid h-full place-items-center text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
          </div>
        )}
        {msgs.isError && (
          <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 text-center text-sm text-destructive">
            <AlertCircle className="size-5" />
            <p>Failed to load messages</p>
            <button
              onClick={() => msgs.refetch()}
              className="text-xs underline underline-offset-2 hover:no-underline"
            >
              Try again
            </button>
          </div>
        )}
        {msgs.data?.map((m) => (
          <MessageBubble key={m.id} m={m as any} mine={m.sender_id === meId} onEdited={onEdited} />
        ))}
        {msgs.data && msgs.data.length === 0 && !msgs.isLoading && (
          <div className="flex h-full min-h-[200px] items-center justify-center text-center text-sm text-muted-foreground">
            <div>
              <p>This is a fresh, private conversation.</p>
              <p className="mt-1 text-xs">Say hello — messages disappear when you both leave.</p>
            </div>
          </div>
        )}
      </div>
      <Composer conversationId={conversationId} />
    </div>
  );
}
