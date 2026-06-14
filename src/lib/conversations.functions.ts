import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getOrCreateConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ otherUserId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc("get_or_create_conversation", {
      _other_user: data.otherUserId,
    });
    if (error) throw new Error(error.message);
    return { id: id as string };
  });

export const listMyConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: convs, error } = await supabase
      .from("conversations")
      .select("id, user1_id, user2_id, last_message_at, created_at")
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .order("last_message_at", { ascending: false });
    if (error) throw new Error(error.message);
    if (!convs?.length) return [];
    const ids = convs.map((c) => c.id);
    const otherIds = convs.map((c) => (c.user1_id === userId ? c.user2_id : c.user1_id));
    const [{ data: profiles }, { data: statuses }, { data: lastMsgs }, { data: unread }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url, verified, last_seen_at")
          .in("id", otherIds),
        supabase
          .from("conversation_status")
          .select("conversation_id, user_id, has_left")
          .in("conversation_id", ids),
        supabase
          .from("messages")
          .select("conversation_id, content, message_type, created_at, sender_id")
          .in("conversation_id", ids)
          .order("created_at", { ascending: false }),
        supabase
          .from("messages")
          .select("conversation_id, id")
          .in("conversation_id", ids)
          .is("read_at", null)
          .neq("sender_id", userId),
      ]);
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    const lastByConv = new Map<
      string,
      { content: string | null; message_type: string; created_at: string; sender_id: string }
    >();
    for (const m of lastMsgs ?? []) {
      if (!lastByConv.has(m.conversation_id)) lastByConv.set(m.conversation_id, m);
    }
    const unreadByConv = new Map<string, number>();
    for (const u of unread ?? [])
      unreadByConv.set(u.conversation_id, (unreadByConv.get(u.conversation_id) ?? 0) + 1);
    const myStatus = new Map(
      (statuses ?? [])
        .filter((s) => s.user_id === userId)
        .map((s) => [s.conversation_id, s.has_left]),
    );
    return convs
      .filter((c) => !myStatus.get(c.id))
      .map((c) => {
        const otherId = c.user1_id === userId ? c.user2_id : c.user1_id;
        return {
          id: c.id,
          other: profileMap.get(otherId) ?? null,
          last: lastByConv.get(c.id) ?? null,
          unread: unreadByConv.get(c.id) ?? 0,
          last_message_at: c.last_message_at,
        };
      });
  });

export const getConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: conv, error } = await supabase
      .from("conversations")
      .select("id, user1_id, user2_id, created_at")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!conv) return null;
    const otherId = conv.user1_id === userId ? conv.user2_id : conv.user1_id;
    const { data: other } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, verified, bio, last_seen_at")
      .eq("id", otherId)
      .maybeSingle();
    return { id: conv.id, other };
  });

export const leaveConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: purged, error } = await context.supabase.rpc("leave_conversation", {
      _conv: data.id,
    });
    if (error) throw new Error(error.message);
    return { purged: !!purged };
  });
