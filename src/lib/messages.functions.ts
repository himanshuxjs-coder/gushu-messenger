import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const messageKind = z.enum(["text", "image", "video", "file"]);

export const listMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ conversationId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("messages")
      .select(
        "id, conversation_id, sender_id, content, media_path, media_mime, media_name, media_size, message_type, edited, read_at, created_at, updated_at",
      )
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        conversationId: z.string().uuid(),
        content: z.string().max(4000).optional(),
        media: z
          .object({
            path: z.string(),
            mime: z.string(),
            name: z.string(),
            size: z.number().int().nonnegative(),
            kind: messageKind,
          })
          .optional(),
      })
      .refine((v) => (v.content && v.content.trim().length > 0) || v.media, {
        message: "Empty message",
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: data.conversationId,
        sender_id: userId,
        content: data.content?.trim() || null,
        media_path: data.media?.path ?? null,
        media_mime: data.media?.mime ?? null,
        media_name: data.media?.name ?? null,
        media_size: data.media?.size ?? null,
        message_type: data.media?.kind ?? "text",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const editMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ id: z.string().uuid(), content: z.string().trim().min(1).max(4000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("messages")
      .update({ content: data.content, edited: true })
      .eq("id", data.id)
      .eq("sender_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ conversationId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("conversation_id", data.conversationId)
      .neq("sender_id", context.userId)
      .is("read_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const ALLOWED_MIME =
  /^(image\/(png|jpeg|webp|gif)|video\/(mp4|webm|quicktime)|application\/pdf|application\/zip|text\/.*|application\/(msword|vnd\.openxmlformats-officedocument.*))$/;

export const createMediaUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        conversationId: z.string().uuid(),
        name: z.string().min(1).max(200),
        mime: z.string().min(1).max(120).regex(ALLOWED_MIME, "Unsupported file type"),
        size: z
          .number()
          .int()
          .positive()
          .max(25 * 1024 * 1024),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const ext = data.name.includes(".") ? data.name.split(".").pop() : "bin";
    const path = `${data.conversationId}/${crypto.randomUUID()}.${ext}`;
    const { data: signed, error } = await context.supabase.storage
      .from("chat-media")
      .createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, token: signed.token };
  });

export const signedMediaUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ path: z.string().min(1).max(300) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: signed, error } = await context.supabase.storage
      .from("chat-media")
      .createSignedUrl(data.path, 60 * 60);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });
