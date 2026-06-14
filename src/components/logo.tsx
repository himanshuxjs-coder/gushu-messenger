import logoAsset from "@/assets/gushu-logo.png.asset.json";
import { cn } from "@/lib/utils";

export function Logo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <img
      src={logoAsset.url}
      alt="Gushu"
      width={size}
      height={size}
      className={cn("select-none", className)}
      draggable={false}
    />
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-display tracking-tight", className)}>Gushu</span>
  );
}