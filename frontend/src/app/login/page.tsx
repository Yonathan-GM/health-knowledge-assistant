"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { login } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <form onSubmit={handleSubmit} className="flex w-80 flex-col gap-3">
        <h1 className="text-2xl font-bold">Log in</h1>
        <input className="rounded border p-2" type="email" placeholder="Email"
          value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="rounded border p-2" type="password" placeholder="Password"
          value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="rounded bg-blue-600 p-2 text-white">Log in</button>
        <Link href="/signup" className="text-sm underline">No account? Sign up</Link>
      </form>
    </main>
  );
}