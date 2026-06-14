import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader as Loader2, Upload, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Logo } from "@/components/logo";
import { Avatar } from "@/components/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { updateMyProfile } from "@/lib/profiles.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const queryClient = useQueryClient();
  const update = useServerFn(updateMyProfile);
  const [me, setMe] = useState<{
    id: string;
    username: string;
    display_name: string | null;
    bio: string | null;
    avatar_url: string | null;
    verified: boolean;
    created_at: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const { data: prof } = await supabase
      .from("profiles")
      .select("id, username, display_name, bio, avatar_url, verified, created_at")
      .eq("id", data.user.id)
      .maybeSingle();
    if (prof) setMe(prof);
  }
  useEffect(() => {
    refresh();
  }, []);

  async function save() {
    if (!me) return;
    setBusy(true);
    try {
      await update({ data: { display_name: me.display_name ?? "", bio: me.bio ?? "" } });
      toast.success("Profile saved");
      queryClient.invalidateQueries();
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function uploadAvatar(file: File) {
    if (!me) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("Max 2 MB");
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${me.id}/avatar-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      await update({ data: { avatar_url: path } });
      toast.success("Avatar updated");
      await refresh();
      queryClient.invalidateQueries();
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeAvatar() {
    if (!me) return;
    setBusy(true);
    try {
      if (me.avatar_url) await supabase.storage.from("avatars").remove([me.avatar_url]);
      await update({ data: { avatar_url: null } });
      await refresh();
      queryClient.invalidateQueries();
    } catch (e: any) {
      toast.error(e?.message ?? "Remove failed");
    } finally {
      setBusy(false);
    }
  }

  if (!me) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="size-4 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6 sm:py-4">
        <Link
          to="/app"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to chats
        </Link>
        <div className="flex items-center gap-2">
          <Logo size={22} /> <span className="font-display text-lg">Gushu</span>
        </div>
        <ThemeToggle />
      </header>
      <main className="mx-auto max-w-2xl space-y-8 px-4 py-6 sm:px-6 sm:py-10">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Your profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Joined {new Date(me.created_at).toLocaleDateString()} · @{me.username}
            {me.verified && " · verified"}
          </p>
        </div>

        <section className="rounded-2xl bg-card p-6 ring-1 ring-border">
          <div className="flex flex-col items-center gap-5 sm:flex-row">
            <Avatar name={me.display_name ?? me.username} url={me.avatar_url} size={72} />
            <div className="flex flex-1 flex-col gap-2 sm:flex-row">
              <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md bg-foreground px-3 py-2 text-xs font-medium text-background hover:bg-foreground/90">
                <Upload className="size-3.5" /> Upload avatar
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadAvatar(f);
                  }}
                />
              </label>
              {me.avatar_url && (
                <Button variant="outline" size="sm" onClick={removeAvatar} className="gap-1.5">
                  <Trash2 className="size-3.5" /> Remove
                </Button>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl bg-card p-6 ring-1 ring-border">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              Username
            </Label>
            <Input value={me.username} disabled />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              Display name
            </Label>
            <Input
              value={me.display_name ?? ""}
              onChange={(e) => setMe({ ...me, display_name: e.target.value })}
              maxLength={40}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Bio</Label>
            <Textarea
              value={me.bio ?? ""}
              onChange={(e) => setMe({ ...me, bio: e.target.value })}
              rows={3}
              maxLength={280}
            />
          </div>
          <Button onClick={save} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : "Save changes"}
          </Button>
        </section>
      </main>
    </div>
  );
}
