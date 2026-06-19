import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  Dumbbell,
  Flame,
  Loader2,
  LogIn,
  TrendingUp,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import beMoveLogo from "@/assets/be-move-logo.svg";
import gymAnalyticsCard from "@/assets/gym-analytics-card.svg";
import { useApp } from "@/contexts/AppContext";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: LoginPage,
});

function LoginPage() {
  const { user, loadingAuth, signIn } = useApp();
  const navigate = useNavigate();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loadingAuth && user) {
      navigate({ to: "/", replace: true });
    }
  }, [loadingAuth, navigate, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const ok = await signIn(login, password);
    setSubmitting(false);

    if (ok) {
      navigate({ to: "/", replace: true });
      return;
    }

    setError("Login ou senha invalidos.");
  }

  return (
    <main className="relative grid min-h-screen overflow-hidden bg-background px-4 py-10 text-foreground md:grid-cols-[1.1fr_0.9fr] md:px-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,oklch(0.7_0.18_155_/_0.22),transparent_26%),radial-gradient(circle_at_78%_18%,oklch(0.7_0.2_265_/_0.22),transparent_24%),linear-gradient(135deg,transparent_0%,oklch(0.55_0.22_265_/_0.08)_100%)]" />
        <div className="login-grid-sweep absolute inset-x-0 top-0 h-full opacity-60" />
      </div>

      <section
        aria-hidden="true"
        className="relative hidden min-h-[520px] items-center justify-center md:flex"
      >
        <div className="relative h-[460px] w-full max-w-xl">
          <div className="absolute left-4 top-10 grid h-24 w-24 place-items-center overflow-hidden rounded-lg border border-primary/20 bg-[#29498b] p-3 shadow-lg login-float">
            <img
              src={beMoveLogo}
              alt=""
              className="h-full w-full object-contain"
              draggable={false}
            />
          </div>
          <div className="absolute bottom-8 right-8 grid h-28 w-28 place-items-center overflow-hidden rounded-lg border border-success/20 bg-[#101828] p-3 shadow-lg login-float-delayed">
            <img
              src={gymAnalyticsCard}
              alt=""
              className="h-full w-full object-contain"
              draggable={false}
            />
          </div>

          <div className="absolute left-12 top-28 h-60 w-60 rounded-full border border-primary/15" />
          <div className="absolute left-24 top-40 h-36 w-36 rounded-full border border-success/20" />

          <div className="login-lift absolute left-12 top-48 flex items-center gap-3 text-primary">
            <div className="h-14 w-6 rounded-md bg-current" />
            <div className="h-2 w-64 rounded-full bg-current" />
            <div className="h-14 w-6 rounded-md bg-current" />
          </div>

          <div className="absolute left-40 top-36 grid h-24 w-24 place-items-center rounded-full bg-primary text-primary-foreground shadow-2xl shadow-primary/25 login-pulse">
            <Dumbbell className="h-12 w-12" />
          </div>

          <div className="absolute bottom-28 left-8 flex h-28 w-72 items-end gap-3 rounded-lg border border-border/70 bg-card/80 p-5 shadow-lg backdrop-blur">
            {[52, 78, 46, 88, 64, 96, 72].map((height, index) => (
              <span
                key={height + index}
                className="login-sprint w-full rounded-t-sm bg-success"
                style={{
                  height: `${height}%`,
                  animationDelay: `${index * 120}ms`,
                }}
              />
            ))}
          </div>

          <div className="absolute right-12 top-28 grid gap-3">
            <div className="login-count flex h-14 w-36 items-center gap-3 rounded-lg border border-border/70 bg-card/85 px-4 shadow-lg backdrop-blur">
              <Activity className="h-5 w-5 text-success" />
              <span className="text-lg font-bold">128</span>
            </div>
            <div className="login-count-delayed flex h-14 w-36 items-center gap-3 rounded-lg border border-border/70 bg-card/85 px-4 shadow-lg backdrop-blur">
              <Flame className="h-5 w-5 text-warning" />
              <span className="text-lg font-bold">742</span>
            </div>
            <div className="login-count-slow flex h-14 w-36 items-center gap-3 rounded-lg border border-border/70 bg-card/85 px-4 shadow-lg backdrop-blur">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span className="text-lg font-bold">94%</span>
            </div>
          </div>
        </div>
      </section>

      <form
        onSubmit={handleSubmit}
        className="login-card-in relative z-10 m-auto w-full max-w-sm rounded-lg border border-border bg-card/95 p-6 shadow-2xl shadow-primary/10 backdrop-blur"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Dumbbell className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold">be.move BI</h1>
            <p className="text-xs text-muted-foreground">Acesso ao painel</p>
          </div>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Login
            </span>
            <input
              value={login}
              onChange={(event) => setLogin(event.target.value)}
              autoComplete="username"
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Senha
            </span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring"
            />
          </label>
        </div>

        {error && (
          <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LogIn className="h-4 w-4" />
          )}
          Entrar
        </button>
      </form>
    </main>
  );
}
