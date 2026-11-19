const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");

export function hasApi() {
  return apiBase.length > 0;
}

export async function api<T>(path: string, init?: RequestInit & { token?: string }): Promise<T> {
  const { token, ...rest } = init || {};
  const response = await fetch(`${apiBase}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(rest.headers || {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function adminLogin(phone = "admin", password = "desk") {
  return api<{ token: string; refresh: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ phone, password }),
  });
}
