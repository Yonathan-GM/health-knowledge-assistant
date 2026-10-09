export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export type Source = { n: number; filename: string; page: number };
export type Doc = { id: number; filename: string };

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${localStorage.getItem("token")}` };
}

async function handle(res: Response) {
  if (res.status === 401) throw new Error("UNAUTHORIZED");
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? "Request failed");
  }
  return res.status === 204 ? null : res.json();
}

export async function signup(email: string, password: string) {
  const res = await fetch(`${API_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return handle(res);
}

export async function login(email: string, password: string) {
  // The login endpoint expects form data, not JSON
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    body: new URLSearchParams({ username: email, password }),
  });
  const data = await handle(res);
  localStorage.setItem("token", data.access_token);
}

export async function getMe() {
  return handle(await fetch(`${API_URL}/auth/me`, { headers: authHeaders() }));
}

export async function listDocuments(): Promise<Doc[]> {
  return handle(await fetch(`${API_URL}/documents`, { headers: authHeaders() }));
}

export async function uploadDocument(file: File) {
  const form = new FormData();
  form.append("file", file);
  // Don't set Content-Type: the browser adds it, including the file boundary
  return handle(
    await fetch(`${API_URL}/documents`, {
      method: "POST",
      headers: authHeaders(),
      body: form,
    })
  );
}

export async function deleteDocument(id: number) {
  return handle(
    await fetch(`${API_URL}/documents/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    })
  );
}

export async function askQuestion(
  question: string
): Promise<{ answer: string; sources: Source[] }> {
  return handle(
    await fetch(`${API_URL}/ask?question=${encodeURIComponent(question)}`, {
      method: "POST",
      headers: authHeaders(),
    })
  );
}