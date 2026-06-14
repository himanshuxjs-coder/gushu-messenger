import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Logo, Wordmark } from "@/components/logo";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";
import {
  resolveUsernameToEmail,
  checkUsernameAvailable,
  ensureDemoUsers,
} from "@/lib/auth.functions";
import { promoteFirstAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app", replace: true });
    });
  }, [navigate]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 opacity-50 [background:radial-gradient(60rem_60rem_at_20%_-10%,oklch(0.7_0.23_295/0.18),transparent_50%),radial-gradient(50rem_50rem_at_120%_120%,oklch(0.72_0.2_245/0.16),transparent_50%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-[440px] flex-col px-6 py-16">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-5 grid size-16 place-items-center rounded-2xl ring-1 ring-border bg-card shadow-xl">
            <Logo size={40} />
          </div>
          <h1 className="font-display text-5xl tracking-tight">
            <Wordmark />
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Private conversations. Zero clutter.</p>
        </div>

        <div className="rounded-2xl bg-card ring-1 ring-border p-2 shadow-2xl backdrop-blur">
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 rounded-xl bg-muted/50">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>
            <TabsContent value="signin" className="p-4 pt-5">
              <SignInForm />
            </TabsContent>
            <TabsContent value="signup" className="p-4 pt-5">
              <SignUpForm />
            </TabsContent>
          </Tabs>
        </div>

        <DemoCard />

        <p className="mt-8 text-center text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          <ShieldCheck className="mr-1 inline size-3 text-foreground/60" />
          End-to-conversation privacy — chats vanish when both leave
        </p>
      </div>
    </div>
  );
}

function SignInForm() {
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const resolve = useServerFn(resolveUsernameToEmail);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      let email = id.trim();
      if (!email.includes("@")) {
        const r = await resolve({ data: { username: email } });
        email = r.email;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Welcome back");
      navigate({ to: "/app", replace: true });
    } catch (err: any) {
      toast.error(err?.message ?? "Sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Identity">
        <Input
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder="email or username"
          autoComplete="username"
          required
        />
      </Field>
      <Field label="Credential">
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="current-password"
          required
          minLength={6}
        />
      </Field>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? <Loader2 className="size-4 animate-spin" /> : "Enter Vault"}
      </Button>
    </form>
  );
}

function SignUpForm() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const check = useServerFn(checkUsernameAvailable);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const u = username.trim().toLowerCase();
      const { available } = await check({ data: { username: u } });
      if (!available) throw new Error("Username already taken");
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/app`,
          data: { username: u, display_name: u },
        },
      });
      if (error) throw error;
      toast.success("Account created");
      navigate({ to: "/app", replace: true });
    } catch (err: any) {
      toast.error(err?.message ?? "Sign-up failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Username">
        <Input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="lowercase, 3–20 chars"
          pattern="[a-z0-9_]{3,20}"
          required
        />
      </Field>
      <Field label="Email">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
        />
      </Field>
      <Field label="Password">
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="at least 8 characters"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </Field>
      <Field label="Confirm password">
        <Input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="repeat password"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </Field>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? <Loader2 className="size-4 animate-spin" /> : "Create account"}
      </Button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function DemoCard() {
  const seed = useServerFn(ensureDemoUsers);
  const promote = useServerFn(promoteFirstAdmin);
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);

  async function loginAs(username: string, password: string) {
    setBusy(username);
    try {
      await seed({ data: undefined as any });
      await promote({ data: { username: "alex" } });
      const email = `${username}@gushu.demo`;
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate({ to: "/app", replace: true });
    } catch (e: any) {
      toast.error(e?.message ?? "Demo sign-in failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-5 rounded-2xl bg-card/60 p-4 ring-1 ring-border">
      <div className="mb-3 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
        Try the demo
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => loginAs("alex", "alex123")}
          className="group rounded-xl bg-muted/40 p-3 text-left ring-1 ring-border transition-all hover:ring-foreground/30"
        >
          <div className="font-display text-lg">alex</div>
          <div className="font-mono text-[10px] text-muted-foreground">alex123 · admin</div>
          {busy === "alex" && <Loader2 className="mt-1 size-3 animate-spin" />}
        </button>
        <button
          type="button"
          onClick={() => loginAs("sophia", "sophia123")}
          className="group rounded-xl bg-muted/40 p-3 text-left ring-1 ring-border transition-all hover:ring-foreground/30"
        >
          <div className="font-display text-lg">sophia</div>
          <div className="font-mono text-[10px] text-muted-foreground">sophia123</div>
          {busy === "sophia" && <Loader2 className="mt-1 size-3 animate-spin" />}
        </button>
      </div>
    </div>
  );
}
