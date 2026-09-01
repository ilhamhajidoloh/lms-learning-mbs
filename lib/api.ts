const TOKEN_KEY = "lms_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
  // Also set cookie for middleware (7 days expiry to match JWT)
  if (typeof document !== "undefined") {
    document.cookie = `token=${token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
  }
}

export function removeToken() {
  localStorage.removeItem(TOKEN_KEY);
  // Also remove cookie
  if (typeof document !== "undefined") {
    document.cookie = "token=; path=/; max-age=0";
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<{ data: T | null; error: string | null }> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const res = await fetch(path, {
      ...options,
      headers,
      // Add timeout and retry logic for better Vercel performance
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    // Handle 401 Unauthorized - token expired
    if (res.status === 401) {
      removeToken();
      if (typeof window !== "undefined" && !window.location.pathname.includes("/login")) {
        window.location.href = "/login";
      }
      return { data: null, error: "Session expired. Please login again." };
    }

    const json = await res.json();
    if (!res.ok) {
      return { data: null, error: json.error || `HTTP ${res.status}` };
    }
    return { data: json as T, error: null };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "TimeoutError") {
      return { data: null, error: "Request timeout. Please try again." };
    }
    const message = err instanceof Error ? err.message : "Network error";
    return { data: null, error: message };
  }
}
