import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Paperclip, Send, Smile, Loader as Loader2 } from "lucide-react";
import EmojiPicker, { Theme as EmojiTheme } from "emoji-picker-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createMediaUpload, sendMessage } from "@/lib/messages.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function kindForMime(mime: string): "image" | "video" | "file" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return "file";
}

export function Composer({ conversationId }: { conversationId: string }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [emoji, setEmoji] = useState(false);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const send = useServerFn(sendMessage);
  const createUpload = useServerFn(createMediaUpload);

  async function uploadAndSend(file: File) {
    if (file.size > 25 * 1024 * 1024) {
      toast.error("File too large (max 25 MB)");
      return;
    }
    setBusy(true);
    try {
      const { path, token } = await createUpload({
        data: {
          conversationId,
          name: file.name,
          mime: file.type || "application/octet-stream",
          size: file.size,
        },
      });
      const { error } = await supabase.storage
        .from("chat-media")
        .uploadToSignedUrl(path, token, file, {
          contentType: file.type || "application/octet-stream",
        });
      if (error) throw error;
      await send({
        data: {
          conversationId,
          media: {
            path,
            mime: file.type || "application/octet-stream",
            name: file.name,
            size: file.size,
            kind: kindForMime(file.type),
          },
        },
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    const content = text.trim();
    if (!content || busy) return;
    setBusy(true);
    setText("");
    try {
      await send({ data: { conversationId, content } });
    } catch (e: any) {
      toast.error(e?.message ?? "Send failed");
      setText(content);
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const f = e.dataTransfer.files?.[0];
        if (f) uploadAndSend(f);
      }}
      className="relative p-4 sm:p-6"
    >
      {drag && (
        <div className="pointer-events-none absolute inset-4 grid place-items-center rounded-2xl border-2 border-dashed border-foreground/30 bg-foreground/5 text-xs uppercase tracking-widest text-foreground/70">
          Drop to send
        </div>
      )}
      <div className="relative mx-auto flex max-w-4xl items-end gap-2 rounded-2xl bg-card/80 p-2 ring-1 ring-border backdrop-blur">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          aria-label="Attach"
        >
          <Paperclip className="size-4" />
        </Button>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadAndSend(f);
            e.currentTarget.value = "";
          }}
        />
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder="Type a confidential message…"
          className="min-h-0 resize-none border-0 bg-transparent px-2 py-2 text-sm focus-visible:ring-0"
        />
        <div className="relative">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => setEmoji((v) => !v)}
            aria-label="Emoji"
          >
            <Smile className="size-4" />
          </Button>
          {emoji && (
            <div className="absolute bottom-12 right-0 z-30 max-[480px]:right-[-60px]">
              <EmojiPicker
                theme={
                  typeof document !== "undefined" &&
                  document.documentElement.classList.contains("dark")
                    ? EmojiTheme.DARK
                    : EmojiTheme.LIGHT
                }
                onEmojiClick={(d) => {
                  setText((t) => t + d.emoji);
                  setEmoji(false);
                }}
              />
            </div>
          )}
        </div>
        <Button
          type="button"
          onClick={submit}
          disabled={busy || !text.trim()}
          className={cn("gap-1.5")}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          <span className="text-[11px] font-bold uppercase tracking-wider">Send</span>
        </Button>
      </div>
    </div>
  );
}
