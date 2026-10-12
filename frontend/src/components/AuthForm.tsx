"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { LogoMark } from "@/components/Logo";
import { btnPrimary, inputClass } from "@/components/ui";
import { login, signup } from "@/lib/api";

const copy = {
  login: {
    title: "Log in",
    intro: "Welcome back. Your library is where you left it.",
    submit: "Log in",
    busy: "Logging in…",
    switchText: "New here?",
    switchLink: "Create an account",
    href: "/signup",
    autoComplete: "current-password",
  },
  signup: {
    title: "Create your account",
    intro: "Free to use. Add public health PDFs and start asking.",
    submit: "Create account",
    busy: "Creating account…",
    switchText: "Already have an account?",
    switchLink: "Log in",
    href: "/login",
    autoComplete: "new-password",
  },
} as const;

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const c = copy[mode];
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [slow, setSlow] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    // The free server sleeps when idle, so the first request can take a while.
    const timer = setTimeout(() => setSlow(true), 5000);
    try {
      if (mode === "signup") await signup(email, password);
      await login(email, password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      clearTimeout(timer);
      setSlow(false);
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-dvh md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="hidden flex-col justify-between bg-teal-deep p-12 text-white md:flex">
        <Link href="/" className="inline-flex items-center gap-2.5 font-serif text-lg font-semibold">
          <LogoMark className="h-7 w-7 rounded-[7px] ring-1 ring-white/50" />
          Health Knowledge Assistant
        </Link>
        <div>
          <p className="font-serif text-4xl font-semibold leading-tight">
            Every answer points to a page.
          </p>
          <p className="mt-4 max-w-sm text-white/80">
            Upload public health documents, ask in plain words, then check the passage
            behind each statement.
          </p>
        </div>
        <p className="text-sm text-white/75">Use public or synthetic documents only.</p>
      </aside>

      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-2.5 font-serif text-lg font-semibold md:hidden"
          >
            <LogoMark className="h-7 w-7" />
            Health Knowledge Assistant
          </Link>

          <h1 className="font-serif text-3xl font-semibold">{c.title}</h1>
          <p className="mt-2 text-muted">{c.intro}</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={c.autoComplete}
                  required
                  minLength={mode === "signup" ? 8 : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputClass} pr-16`}
                  aria-describedby={mode === "signup" ? "password-hint" : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 px-3 text-sm font-medium text-teal-deep hover:text-teal"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              {mode === "signup" && (
                <p id="password-hint" className="mt-1.5 text-sm text-muted">
                  At least 8 characters.
                </p>
              )}
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-md bg-danger-wash px-3 py-2.5 text-sm text-danger"
              >
                {error}
              </p>
            )}

            <button type="submit" disabled={loading} className={`${btnPrimary} w-full`}>
              {loading ? c.busy : c.submit}
            </button>

            {slow && (
              <p role="status" className="text-sm text-muted">
                The server was idle and is waking up. This can take up to a minute.
              </p>
            )}
          </form>

          <p className="mt-8 text-sm text-muted">
            {c.switchText}{" "}
            <Link href={c.href} className="font-medium text-teal-deep underline underline-offset-4 hover:text-teal">
              {c.switchLink}
            </Link>
          </p>

          {mode === "signup" && (
            <p className="mt-6 border-t border-rule pt-4 text-sm text-muted">
              Documents you upload are sent to an AI service to be searched. Use public or
              synthetic documents only, never patient records.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
