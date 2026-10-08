import { useState, type FormEvent } from "react";
import { Lock, LogIn, UserPlus } from "lucide-react";
import { useAuth } from "../hooks/authContext";

type Mode = "login" | "register";

export function AuthPage() {
  const { error, isSubmitting, login, register } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("demo@syncspace.local");
  const [password, setPassword] = useState("password");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (mode === "login") {
      await login({ email, password });
      return;
    }

    await register({ name, email, password });
  }

  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-4 py-8 text-ink">
      <section className="w-full max-w-md rounded-[18px] border border-line bg-panel p-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-md bg-ink text-lg font-black text-panel">
            S
          </span>
          <div>
            <h1 className="text-2xl font-bold">SyncSpace</h1>
            <p className="text-sm text-soft">Sign in to your workspace.</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 rounded-md border border-line bg-canvas p-1">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`h-9 rounded-md text-sm font-semibold transition ${
              mode === "login" ? "bg-panel shadow-sm" : "text-soft hover:text-ink"
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            className={`h-9 rounded-md text-sm font-semibold transition ${
              mode === "register" ? "bg-panel shadow-sm" : "text-soft hover:text-ink"
            }`}
          >
            Create account
          </button>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {mode === "register" ? (
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase text-soft">
                Name
              </span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="h-10 w-full rounded-md border border-line bg-canvas px-3 text-sm"
                placeholder="Maya Chen"
                required
              />
            </label>
          ) : null}

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase text-soft">
              Email
            </span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-10 w-full rounded-md border border-line bg-canvas px-3 text-sm"
              type="email"
              autoComplete="email"
              required
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase text-soft">
              Password
            </span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-10 w-full rounded-md border border-line bg-canvas px-3 text-sm"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={8}
              required
            />
          </label>

          {error ? (
            <div className="rounded-md border border-accent/30 bg-accent/8 px-3 py-2 text-sm text-accent">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-ink px-3 text-sm font-semibold text-panel transition hover:bg-ink/90 disabled:opacity-60"
          >
            {mode === "login" ? <LogIn size={16} /> : <UserPlus size={16} />}
            {isSubmitting
              ? "Working"
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>

        <div className="mt-5 flex items-start gap-2 rounded-md border border-line bg-canvas/70 p-3 text-xs leading-5 text-soft">
          <Lock className="mt-0.5 shrink-0" size={14} />
          <p>
            Demo account: <span className="font-semibold">demo@syncspace.local</span>{" "}
            with password <span className="font-semibold">password</span>.
          </p>
        </div>
      </section>
    </main>
  );
}
