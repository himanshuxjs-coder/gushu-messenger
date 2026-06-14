import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const searchUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ q: z.string().trim().min(1).max(40) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const term = data.q.toLowerCase().replace(/[%_]/g, "");
    const { data: rows, error } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, verified")
      .ilike("username", `%${term}%`)
      .neq("id", userId)
      .limit(10);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getProfileByUsername = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ username: z.string().trim().min(1).max(40) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, bio, verified, last_seen_at, created_at")
      .eq("username", data.username.toLowerCase())
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        display_name: z.string().trim().max(40).optional(),
        bio: z.string().trim().max(280).optional(),
        avatar_url: z.string().url().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("profiles").update(data).eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const heartbeat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase
      .from("profiles")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", context.userId);
    return { ok: true };
  });

export const signedAvatarUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ path: z.string().min(1).max(300) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: signed, error } = await context.supabase.storage
      .from("avatars")
      .createSignedUrl(data.path, 60 * 60 * 24);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });
