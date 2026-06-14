import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getConversation } from "@/lib/conversations.functions";
import { listMessages, markRead } from "@/lib/messages.functions";
import { ChatHeader } from "@/components/chat-header";
import { MessageBubble } from "@/components/message-bubble";
import { Composer } from "@/components/composer";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/c/$conversationId")({
  component: ChatPage,
});

function ChatPage() {
  const { conversationId } = Route.useParams();
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

  // Realtime subscription scoped to this conversation
  useEffect(() => {
    const ch = supabase
      .channel(`messages:${conversationId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [conversationId, queryClient]);

  // Mark read on view + invalidate
  useEffect(() => {
    if (msgs.data && msgs.data.length) {
      mark({ data: { conversationId } })
        .then(() => queryClient.invalidateQueries({ queryKey: ["conversations"] }))
        .catch(() => {});
    }
  }, [conversationId, msgs.data, mark, queryClient]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.data]);

  const [meId, setMeId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMeId(data.user?.id ?? null));
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ChatHeader
        conversationId={conversationId}
        other={conv.data?.other ?? null}
        onLeft={() => queryClient.invalidateQueries({ queryKey: ["conversations"] })}
      />
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-6 sm:p-8 space-y-5">
        {msgs.isLoading && (
          <div className="grid h-full place-items-center text-muted-foreground"><Loader2 className="size-4 animate-spin" /></div>
        )}
        {msgs.data?.map((m) => (
          <MessageBubble key={m.id} m={m as any} mine={m.sender_id === meId} onEdited={() => queryClient.invalidateQueries({ queryKey: ["messages", conversationId] })} />
        ))}
        {msgs.data && msgs.data.length === 0 && (
          <div className="grid h-full place-items-center text-center text-sm text-muted-foreground">
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