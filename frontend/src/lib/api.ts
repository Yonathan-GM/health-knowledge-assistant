export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export type Source = { n: number; filename: string; page: number };
export type Doc = { id: number; filename: string };
export type UploadResult = { id: number; filename: string; chunks: number };

const TOKEN_KEY = "token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null; // storage can be blocked (private windows, strict settings)
  }
}

function setToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* storage unavailable: the user will need to log in again next visit */
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* nothing to clear */
  }
}

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${getToken() ?? ""}` };
}

// FastAPI sends a string for our own errors and a list of objects for validation errors.
function formatDetail(detail: unknown): string | undefined {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((d) => (d && typeof d === "object" && "msg" in d ? String(d.msg) : ""))
      .filter(Boolean);
    return msgs.length ? msgs.join(" ") : undefined;
  }
  return undefined;
}

// authed = false for login and signup, where a 401 means "wrong password", not "session expired".
async function request(path: string, init: RequestInit = {}, authed = true) {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, init);
  } catch {
    throw new Error(
      "Can't reach the server. If it has been idle, wait a minute and try again."
    );
  }
  if (authed && res.status === 401) throw new Error("UNAUTHORIZED");
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(formatDetail(body.detail) ?? "Something went wrong. Try again.");
  }
  return res.status === 204 ? null : res.json();
}

export async function signup(email: string, password: string) {
  return request(
    "/auth/signup",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    },
    false
  );
}

export async function login(email: string, password: string) {
  // The login endpoint expects form data, not JSON
  const data = await request(
    "/auth/login",
    { method: "POST", body: new URLSearchParams({ username: email, password }) },
    false
  );
  setToken(data.access_token);
}

export async function getMe(): Promise<{ id: number; email: string; role: string }> {
  return request("/auth/me", { headers: authHeaders() });
}

export async function listDocuments(): Promise<Doc[]> {
  return request("/documents", { headers: authHeaders() });
}

export async function uploadDocument(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);
  // Don't set Content-Type: the browser adds it, including the file boundary
  return request("/documents", {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });
}

export async function deleteDocument(id: number) {
  return request(`/documents/${id}`, { method: "DELETE", headers: authHeaders() });
}

export async function askQuestion(
  question: string
): Promise<{ answer: string; sources: Source[] }> {
  return request(`/ask?question=${encodeURIComponent(question)}`, {
    method: "POST",
    headers: authHeaders(),
  });
}
