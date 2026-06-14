import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { signedAvatarUrl } from "@/lib/profiles.functions";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

/** Renders a user avatar by signing the storage path on demand. */
export function Avatar({ name, url, size = 40, className }: { name: string; url: string | null | undefined; size?: number; className?: string }) {
  const sign = useServerFn(signedAvatarUrl);
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!url) {
      setSrc(null);
      return;
    }
    if (url.startsWith("http")) {
      setSrc(url);
      return;
    }
    sign({ data: { path: url } })
      .then((r) => {
        if (!cancelled) setSrc(r.url);
      })
      .catch(() => setSrc(null));
    return () => {
      cancelled = true;
    };
  }, [url, sign]);

  return (
    <div
      className={cn(
        "relative grid place-items-center overflow-hidden rounded-full bg-muted text-xs font-semibold uppercase text-muted-foreground ring-1 ring-border",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {src ? (
        <img src={src} alt={name} className="size-full object-cover" />
      ) : (
        <span>{initials(name)}</span>
      )}
    </div>
  );
}