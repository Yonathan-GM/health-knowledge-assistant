"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  askQuestion, deleteDocument, getMe, listDocuments, uploadDocument,
  type Doc, type Source,
} from "@/lib/api";

type Message = { role: "user" | "assistant"; text: string; sources?: Source[] };

export default function DashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [docs, setDocs] = useState<Doc[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    router.push("/login");
  }, [router]);

  // Any request that fails with 401 sends the user back to login
  const handleError = useCallback(
    (err: unknown) => {
      const msg = (err as Error).message;
      if (msg === "UNAUTHORIZED") logout();
      else setError(msg);
    },
    [logout]
  );

  useEffect(() => {
    getMe()
      .then((u) => setEmail(u.email))
      .then(listDocuments)
      .then(setDocs)
      .catch(handleError);
  }, [handleError]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      await uploadDocument(file);
      setDocs(await listDocuments());
    } catch (err) {
      handleError(err);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteDocument(id);
      setDocs((d) => d.filter((x) => x.id !== id));
    } catch (err) {
      handleError(err);
    }
  }

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || busy) return;
    setError("");
    setQuestion("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setBusy(true);
    try {
      const res = await askQuestion(q);
      setMessages((m) => [
        ...m,
        { role: "assistant", text: res.answer, sources: res.sources },
      ]);
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  }

  if (!email) return <main className="p-8">Loading...</main>;

  return (
    <main className="flex h-screen">
      {/* Sidebar: documents */}
      <aside className="flex w-72 flex-col gap-3 border-r p-4">
        <div className="text-sm text-gray-500">{email}</div>
        <label className="cursor-pointer rounded bg-blue-600 p-2 text-center text-white">
          {uploading ? "Processing..." : "Upload PDF"}
          <input type="file" accept="application/pdf" className="hidden"
            onChange={handleUpload} disabled={uploading} />
        </label>
        <ul className="flex-1 space-y-2 overflow-y-auto">
          {docs.length === 0 && (
            <li className="text-sm text-gray-500">No documents yet.</li>
          )}
          {docs.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate" title={d.filename}>{d.filename}</span>
              <button onClick={() => handleDelete(d.id)}
                className="text-red-600" aria-label={`Delete ${d.filename}`}>✕</button>
            </li>
          ))}
        </ul>
        <button onClick={logout} className="rounded border p-2 text-sm">Log out</button>
      </aside>

      {/* Chat */}
      <section className="flex flex-1 flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {messages.length === 0 && (
            <p className="text-gray-500">
              Upload a PDF, then ask a question about it.
            </p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "text-right" : ""}>
              <div className={`inline-block max-w-2xl whitespace-pre-wrap rounded-lg p-3 text-left ${
                m.role === "user" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-900"}`}>
                {m.text}
              </div>
              {m.sources && m.sources.length > 0 && (
                <ul className="mt-1 text-xs text-gray-500">
                  {m.sources.map((s) => (
                    <li key={s.n}>[{s.n}] {s.filename}, page {s.page}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          {busy && <p className="text-gray-500">Thinking...</p>}
        </div>
        {error && <p className="px-6 text-sm text-red-600">{error}</p>}
        <form onSubmit={handleAsk} className="flex gap-2 border-t p-4">
          <input className="flex-1 rounded border p-2" placeholder="Ask about your documents..."
            value={question} onChange={(e) => setQuestion(e.target.value)} />
          <button className="rounded bg-blue-600 px-4 text-white disabled:opacity-50"
            disabled={busy}>Ask</button>
        </form>
      </section>
    </main>
  );
}