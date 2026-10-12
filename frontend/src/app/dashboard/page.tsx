"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { AnswerBlock } from "@/components/AnswerBlock";
import { LogoMark } from "@/components/Logo";
import { btnPrimary } from "@/components/ui";
import {
  askQuestion,
  clearToken,
  deleteDocument,
  getMe,
  listDocuments,
  uploadDocument,
  type Doc,
  type Source,
} from "@/lib/api";

// These match the backend limits (MAX_DOCUMENTS_PER_USER and MAX_UPLOAD_MB in config.py).
const MAX_DOCS = 5;
const MAX_MB = 10;

type Entry = {
  id: number;
  question: string;
  status: "pending" | "done" | "error";
  answer?: string;
  sources?: Source[];
  error?: string;
};

type Notice = { kind: "ok" | "error"; text: string } | null;

function DocIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0 text-teal" fill="none" aria-hidden="true">
      <path
        d="M5 2.5h6l4 4v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M11 2.5v4h4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="M4 6h12M8 6V4h4v2M6 6l.7 10h6.6L14 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [docs, setDocs] = useState<Doc[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [question, setQuestion] = useState("");
  const [uploadingName, setUploadingName] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [slow, setSlow] = useState(false);

  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const slowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(1);

  const logout = useCallback(() => {
    clearToken();
    router.push("/login");
  }, [router]);

  // A 401 anywhere means the login expired, so send the user back to log in.
  const handleError = useCallback(
    (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Something went wrong. Try again.";
      if (msg === "UNAUTHORIZED") logout();
      else setNotice({ kind: "error", text: msg });
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

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [entries]);

  const busy = entries.some((e) => e.status === "pending");
  const full = docs.length >= MAX_DOCS;

  async function addFile(file: File | undefined) {
    if (!file) return;
    setDrawerOpen(false);
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setNotice({ kind: "error", text: "Only PDF files are supported." });
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setNotice({ kind: "error", text: `That file is over ${MAX_MB} MB. Choose a smaller PDF.` });
      return;
    }
    if (full) {
      setNotice({
        kind: "error",
        text: `Your library is full (${MAX_DOCS} of ${MAX_DOCS}). Delete a document to add another.`,
      });
      return;
    }
    setNotice(null);
    setUploadingName(file.name);
    try {
      const res = await uploadDocument(file);
      setDocs(await listDocuments());
      setNotice({ kind: "ok", text: `Added ${res.filename}. It is ready for questions.` });
    } catch (err) {
      handleError(err);
    } finally {
      setUploadingName(null);
    }
  }

  function onFileChosen(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // lets the same file be chosen again later
    void addFile(file);
  }

  async function removeDoc(doc: Doc) {
    setConfirmId(null);
    try {
      await deleteDocument(doc.id);
      setDocs((d) => d.filter((x) => x.id !== doc.id));
      setNotice({ kind: "ok", text: `Deleted ${doc.filename}.` });
    } catch (err) {
      handleError(err);
    }
  }

  async function runAsk(id: number, q: string) {
    setSlow(false);
    if (slowTimer.current) clearTimeout(slowTimer.current);
    slowTimer.current = setTimeout(() => setSlow(true), 8000);
    try {
      const res = await askQuestion(q);
      setEntries((es) =>
        es.map(
          (e): Entry =>
            e.id === id ? { ...e, status: "done", answer: res.answer, sources: res.sources } : e
        )
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Try again.";
      if (msg === "UNAUTHORIZED") {
        logout();
        return;
      }
      setEntries((es) =>
        es.map((e): Entry => (e.id === id ? { ...e, status: "error", error: msg } : e))
      );
    } finally {
      if (slowTimer.current) clearTimeout(slowTimer.current);
      setSlow(false);
    }
  }

  function submit(e?: FormEvent) {
    e?.preventDefault();
    const q = question.trim();
    if (!q || busy || docs.length === 0) return;
    const id = nextId.current++;
    setEntries((es) => [...es, { id, question: q, status: "pending" }]);
    setQuestion("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    void runAsk(id, q);
  }

  function retry(entry: Entry) {
    if (busy) return;
    setEntries((es) =>
      es.map((x): Entry =>
        x.id === entry.id ? { ...x, status: "pending", error: undefined } : x
      )
    );
    void runAsk(entry.id, entry.question);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  function onQuestionChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setQuestion(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  const hasFiles = (e: DragEvent) => e.dataTransfer.types.includes("Files");

  function onDragOver(e: DragEvent) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    setDragging(true);
  }

  function onDragLeave(e: DragEvent) {
    if (e.relatedTarget === null) setDragging(false);
  }

  function onDrop(e: DragEvent) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    setDragging(false);
    void addFile(e.dataTransfer.files[0]);
  }

  if (!email) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <LogoMark className="h-10 w-10 motion-safe:animate-pulse" />
        {notice?.kind === "error" ? (
          <>
            <p role="alert" className="max-w-sm text-danger">
              {notice.text}
            </p>
            <button type="button" onClick={() => window.location.reload()} className={btnPrimary}>
              Try again
            </button>
          </>
        ) : (
          <p className="text-muted">Opening your library…</p>
        )}
      </main>
    );
  }

  return (
    <div
      className="flex h-dvh bg-paper text-ink"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center border-4 border-dashed border-teal bg-teal-wash/90">
          <p className="font-serif text-2xl font-semibold text-teal-deep">
            Drop a PDF to add it to your library
          </p>
        </div>
      )}

      {drawerOpen && (
        <div
          className="fixed inset-0 z-20 bg-ink/40 md:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Library */}
      <aside
        id="library"
        aria-label="Library"
        className={`fixed inset-y-0 left-0 z-30 flex w-80 max-w-[85vw] flex-col border-r border-rule bg-surface transition-transform md:static md:visible md:translate-x-0 ${
          drawerOpen ? "translate-x-0" : "-translate-x-full max-md:invisible"
        }`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-rule px-5 py-4">
          <span className="inline-flex items-center gap-2.5 font-serif text-base font-semibold">
            <LogoMark className="h-6 w-6" />
            Health Knowledge Assistant
          </span>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="rounded px-2 py-1 text-sm font-medium text-muted hover:text-ink md:hidden"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Library</h2>
            <p className="text-sm text-muted">
              {docs.length} of {MAX_DOCS}
            </p>
          </div>

          <label
            htmlFor="file-input"
            className={`mt-4 block rounded-md border-2 border-dashed px-4 py-5 text-center transition-colors focus-within:border-teal ${
              uploadingName || full
                ? "cursor-not-allowed border-rule bg-paper text-muted"
                : "cursor-pointer border-rule hover:border-teal hover:bg-teal-wash/50"
            }`}
          >
            <span className="block font-medium">
              {uploadingName ? "Adding a document…" : full ? "Library is full" : "Add a PDF"}
            </span>
            <span className="mt-1 block text-sm text-muted">
              {full
                ? "Delete a document to add another."
                : `Drop a file here or choose one. Up to ${MAX_MB} MB.`}
            </span>
            <input
              id="file-input"
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              onChange={onFileChosen}
              disabled={uploadingName !== null || full}
            />
          </label>

          <ul className="mt-5 space-y-1">
            {docs.length === 0 && (
              <li className="text-sm text-muted">No documents yet.</li>
            )}
            {docs.map((d) => (
              <li
                key={d.id}
                className="flex items-center gap-2.5 rounded-md px-2 py-2 hover:bg-paper"
              >
                <DocIcon />
                {confirmId === d.id ? (
                  <div className="flex min-w-0 flex-1 items-center justify-between gap-2 text-sm">
                    <span className="font-medium">Delete this document?</span>
                    <span className="flex shrink-0 gap-3">
                      <button
                        type="button"
                        onClick={() => removeDoc(d)}
                        className="font-medium text-danger underline underline-offset-4"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(null)}
                        className="font-medium text-muted underline underline-offset-4"
                      >
                        Keep
                      </button>
                    </span>
                  </div>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate text-sm" title={d.filename}>
                      {d.filename}
                    </span>
                    <button
                      type="button"
                      onClick={() => setConfirmId(d.id)}
                      aria-label={`Delete ${d.filename}`}
                      className="shrink-0 rounded p-1.5 text-muted hover:bg-danger-wash hover:text-danger"
                    >
                      <TrashIcon />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t border-rule px-5 py-4">
          <p className="truncate text-sm text-muted" title={email}>
            {email}
          </p>
          <button
            type="button"
            onClick={logout}
            className="mt-2 text-sm font-medium text-teal-deep underline underline-offset-4 hover:text-teal"
          >
            Log out
          </button>
        </div>
      </aside>

      {/* Conversation */}
      <main className="flex min-w-0 flex-1 flex-col">
        <h1 className="sr-only">Health Knowledge Assistant</h1>

        <header className="flex items-center justify-between gap-3 border-b border-rule bg-surface px-4 py-3 md:px-8">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-expanded={drawerOpen}
            aria-controls="library"
            className="text-sm font-medium text-teal-deep md:hidden"
          >
            Library ({docs.length})
          </button>
          <p className="hidden text-sm text-muted md:block">
            {docs.length === 0
              ? "No documents in your library"
              : `Searching ${docs.length} ${docs.length === 1 ? "document" : "documents"}`}
          </p>
          {entries.length > 0 && (
            <button
              type="button"
              onClick={() => setEntries([])}
              className="text-sm font-medium text-muted underline underline-offset-4 hover:text-ink"
            >
              Clear conversation
            </button>
          )}
        </header>

        {(uploadingName || notice) && (
          <div
            role={notice?.kind === "error" && !uploadingName ? "alert" : "status"}
            className={`flex items-start justify-between gap-4 px-4 py-2.5 text-sm md:px-8 ${
              uploadingName
                ? "bg-teal-wash text-teal-deep"
                : notice?.kind === "error"
                  ? "bg-danger-wash text-danger"
                  : "bg-teal-wash text-teal-deep"
            }`}
          >
            <p className={uploadingName ? "motion-safe:animate-pulse" : ""}>
              {uploadingName
                ? `Reading ${uploadingName} and preparing it for search. Long documents can take a minute.`
                : notice?.text}
            </p>
            {!uploadingName && (
              <button
                type="button"
                onClick={() => setNotice(null)}
                className="shrink-0 font-medium underline underline-offset-4"
              >
                Dismiss
              </button>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-5 py-8 md:px-8">
            {entries.length === 0 ? (
              docs.length === 0 ? (
                <section className="py-10">
                  <h2 className="max-w-[24ch] font-serif text-4xl font-semibold leading-tight">
                    Add a document to begin
                  </h2>
                  <p className="mt-4 max-w-[52ch] text-lg leading-8 text-muted">
                    Upload a public health PDF, such as a guideline or fact sheet. Then ask
                    questions and see which page each answer comes from.
                  </p>
                  <label
                    htmlFor="file-input"
                    className={`${btnPrimary} mt-6 cursor-pointer`}
                  >
                    Choose a PDF
                  </label>
                  <p className="mt-3 text-sm text-muted">
                    Up to {MAX_MB} MB and 50 pages. You can also drop a file anywhere on this
                    page.
                  </p>
                </section>
              ) : (
                <section className="py-10">
                  <h2 className="max-w-[26ch] font-serif text-4xl font-semibold leading-tight">
                    Ask about your {docs.length === 1 ? "document" : `${docs.length} documents`}
                  </h2>
                  <p className="mt-4 max-w-[52ch] text-lg leading-8 text-muted">
                    Answers come only from the pages in your library. Specific questions work
                    best, like what a guideline recommends in a particular situation.
                  </p>
                </section>
              )
            ) : (
              entries.map((entry) => (
                <article key={entry.id} className="mb-10">
                  <h2 className="max-w-[65ch] font-serif text-xl font-semibold leading-snug">
                    {entry.question}
                  </h2>

                  {entry.status === "pending" && (
                    <div role="status" className="mt-3 text-muted">
                      <p className="motion-safe:animate-pulse">Searching your documents…</p>
                      {slow && (
                        <p className="mt-1 text-sm">
                          The server was idle and is waking up. This can take up to a minute.
                        </p>
                      )}
                    </div>
                  )}

                  {entry.status === "error" && (
                    <div
                      role="alert"
                      className="mt-3 max-w-[65ch] rounded-md bg-danger-wash px-4 py-3 text-danger"
                    >
                      <p>{entry.error}</p>
                      <button
                        type="button"
                        onClick={() => retry(entry)}
                        disabled={busy}
                        className="mt-1 text-sm font-medium underline underline-offset-4 disabled:opacity-60"
                      >
                        Try again
                      </button>
                    </div>
                  )}

                  {entry.status === "done" &&
                    (entry.sources && entry.sources.length > 0 ? (
                      <div className="mt-3">
                        <AnswerBlock
                          answer={entry.answer ?? ""}
                          sources={entry.sources}
                          showCopy
                        />
                      </div>
                    ) : (
                      <div className="mt-3 max-w-[65ch] border-l-4 border-rule pl-4">
                        <p className="font-serif text-[1.0625rem] leading-7">{entry.answer}</p>
                        <p className="mt-1 text-sm text-muted">
                          No passage matched closely enough. Try different wording, or add a
                          document that covers this.
                        </p>
                      </div>
                    ))}
                </article>
              ))
            )}
            <div ref={endRef} />
          </div>
        </div>

        <form onSubmit={submit} className="border-t border-rule bg-surface px-4 py-4 md:px-8">
          <div className="mx-auto flex max-w-3xl items-end gap-3">
            <label htmlFor="question" className="sr-only">
              Your question
            </label>
            <textarea
              id="question"
              ref={textareaRef}
              rows={1}
              value={question}
              onChange={onQuestionChange}
              onKeyDown={onKeyDown}
              disabled={docs.length === 0}
              placeholder={
                docs.length === 0 ? "Add a document to start asking" : "Ask about your documents"
              }
              className="max-h-40 min-h-[2.75rem] flex-1 resize-none rounded-md border border-rule bg-surface px-3 py-2.5 text-base placeholder:text-muted/70 focus:border-teal disabled:bg-paper"
            />
            <button
              type="submit"
              disabled={!question.trim() || busy || docs.length === 0}
              className={btnPrimary}
            >
              {busy ? "Searching…" : "Ask"}
            </button>
          </div>
          <p className="mx-auto mt-2 max-w-3xl text-xs text-muted">
            Answers come only from your documents and aren&apos;t medical advice. Press Enter to
            send, Shift+Enter for a new line.
          </p>
        </form>
      </main>
    </div>
  );
}
