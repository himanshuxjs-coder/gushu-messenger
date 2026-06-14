import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, CheckCheck, Edit2, FileText, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { signedMediaUrl, editMessage } from "@/lib/messages.functions";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  media_path: string | null;
  media_mime: string | null;
  media_name: string | null;
  media_size: number | null;
  message_type: "text" | "image" | "video" | "file";
  edited: boolean;
  read_at: string | null;
  created_at: string;
};

export function MessageBubble({ m, mine, onEdited }: { m: Message; mine: boolean; onEdited: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(m.content ?? "");
  const save = useServerFn(editMessage);

  async function commit() {
    const text = draft.trim();
    if (!text || text === m.content) {
      setEditing(false);
      return;
    }
    try {
      await save({ data: { id: m.id, content: text } });
      setEditing(false);
      onEdited();
    } catch (e: any) {
      toast.error(e?.message ?? "Edit failed");
    }
  }

  return (
    <div className={cn("group flex flex-col", mine ? "items-end" : "items-start")}>
      <div className={cn("max-w-[min(40ch,80%)] space-y-2")}>
        <div
          className={cn(
            "relative rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ring-1",
            mine
              ? "rounded-tr-md bg-foreground text-background ring-foreground/10"
              : "rounded-tl-md bg-muted text-foreground ring-border",
          )}
        >
          {m.media_path && <MediaBlock m={m} />}
          {editing ? (
            <div className="space-y-2">
              <Textarea
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={2}
                className="min-h-0 resize-none border-0 bg-transparent p-0 text-sm focus-visible:ring-0"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={commit} className="h-7 text-xs">Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="h-7 text-xs">Cancel</Button>
              </div>
            </div>
          ) : (
            m.content && <p className="whitespace-pre-wrap break-words">{m.content}</p>
          )}
        </div>
      </div>
      <div className={cn("mt-1.5 flex items-center gap-2 px-1 text-[10px] text-muted-foreground", mine && "flex-row-reverse")}>
        <span>{formatTime(m.created_at)}</span>
        {m.edited && <span className="italic">edited</span>}
        {mine && (m.read_at ? <CheckCheck className="size-3 text-foreground/70" /> : <Check className="size-3" />)}
        {mine && !editing && m.content && (
          <button
            onClick={() => {
              setDraft(m.content ?? "");
              setEditing(true);
            }}
            className="opacity-0 transition-opacity group-hover:opacity-100"
            aria-label="Edit"
          >
            <Edit2 className="size-3" />
          </button>
        )}
      </div>
    </div>
  );
}

function MediaBlock({ m }: { m: Message }) {
  const sign = useServerFn(signedMediaUrl);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!m.media_path) return;
    let cancel = false;
    sign({ data: { path: m.media_path } })
      .then((r) => !cancel && setUrl(r.url))
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, [m.media_path, sign]);

  if (m.message_type === "image") {
    return (
      <a href={url ?? "#"} target="_blank" rel="noreferrer" className="mb-2 block overflow-hidden rounded-xl ring-1 ring-black/10">
        {url ? <img src={url} alt={m.media_name ?? ""} className="max-h-80 w-full object-cover" /> : <div className="h-40 animate-pulse bg-muted-foreground/10" />}
      </a>
    );
  }
  if (m.message_type === "video") {
    return (
      <div className="mb-2 overflow-hidden rounded-xl ring-1 ring-black/10">
        {url ? <video src={url} controls className="max-h-80 w-full" /> : <div className="h-40 animate-pulse bg-muted-foreground/10" />}
      </div>
    );
  }
  return (
    <a
      href={url ?? "#"}
      target="_blank"
      rel="noreferrer"
      className="mb-2 flex items-center gap-3 rounded-xl bg-black/10 p-3 text-xs"
    >
      <FileText className="size-5 shrink-0" />
      <div className="min-w-0">
        <div className="truncate font-medium">{m.media_name}</div>
        {m.media_size && <div className="text-[10px] opacity-70">{(m.media_size / 1024).toFixed(0)} KB</div>}
      </div>
    </a>
  );
}