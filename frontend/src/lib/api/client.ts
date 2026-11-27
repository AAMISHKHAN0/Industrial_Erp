let cachedDesktopApiBase: string | null = null;
let isHandlingUnauthorized = false;

export function getApiBase(): string {
  if (typeof window !== "undefined") {
    if (cachedDesktopApiBase) {
      return cachedDesktopApiBase;
    }
    const bridgeBase = (window as any).desktopBridge?.getApiBase?.();
    if (typeof bridgeBase === "string" && bridgeBase.trim()) {
      cachedDesktopApiBase = bridgeBase.trim().replace(/\/+$/, "");
      return cachedDesktopApiBase;
    }
    const port = window.location.port;
    if (port && port !== "3000") {
      const offset = parseInt(port, 10) - 3000;
      return `${window.location.protocol}//${window.location.hostname}:${4000 + offset}/api/v1`;
    }
  }
  return (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1").replace(/\/+$/, "");
}

export class UnauthorizedError extends Error {
  constructor(message = "Session invalid, expired, or missing") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/**
 * Synchronously retrieves the active session token from localStorage or document.cookie.
 * Keeps both storage mechanisms synchronized for Next.js SSR middleware and client fetch.
 */
export function getAuthSessionToken(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const fromStorage = localStorage.getItem("session_token");
    if (fromStorage && fromStorage.trim()) {
      return fromStorage.trim();
    }
  } catch {}

  try {
    const match = document.cookie.match(/(?:^|;\s*)session_token=([^;]+)/);
    if (match && match[1]) {
      const fromCookie = decodeURIComponent(match[1]).trim();
      if (fromCookie) {
        try {
          localStorage.setItem("session_token", fromCookie);
        } catch {}
        return fromCookie;
      }
    }
  } catch {}

  try {
    const bridge = (window as any).desktopBridge;
    if (bridge && typeof bridge.getSession === "function") {
      const fromDesktop = bridge.getSession();
      if (typeof fromDesktop === "string" && fromDesktop.trim()) {
        const clean = fromDesktop.trim();
        try {
          localStorage.setItem("session_token", clean);
          document.cookie = `session_token=${encodeURIComponent(clean)}; path=/; max-age=2592000; SameSite=Lax`;
        } catch {}
        return clean;
      }
    }
  } catch {}

  return null;
}

/**
 * Persists session token across localStorage, document.cookie, and Electron userData.
 */
export function setAuthSessionToken(token: string): void {
  if (typeof window === "undefined" || !token) return;
  const clean = token.trim();
  try {
    localStorage.setItem("session_token", clean);
  } catch {}
  try {
    document.cookie = `session_token=${encodeURIComponent(clean)}; path=/; max-age=2592000; SameSite=Lax`;
  } catch {}
  try {
    const bridge = (window as any).desktopBridge;
    if (bridge && typeof bridge.setSession === "function") {
      bridge.setSession(clean);
    }
  } catch {}
}

/**
 * Clears session token across localStorage, document.cookie, and Electron userData.
 */
export function clearAuthSessionToken(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("session_token");
    localStorage.removeItem("user-email");
  } catch {}
  try {
    document.cookie = "session_token=; path=/; max-age=0; SameSite=Lax";
  } catch {}
  try {
    const bridge = (window as any).desktopBridge;
    if (bridge && typeof bridge.clearSession === "function") {
      bridge.clearSession();
    }
  } catch {}
}

function handleUnauthorized(): never {
  clearAuthSessionToken();
  if (typeof window !== "undefined" && !isHandlingUnauthorized) {
    isHandlingUnauthorized = true;
    const currentPath = window.location.pathname;
    fetch(`${getApiBase()}/auth/logout`, {
      method: "POST",
      credentials: "include",
    })
      .catch(() => {})
      .finally(() => {
        if (!currentPath.startsWith("/login") && !currentPath.startsWith("/setup")) {
          window.location.replace(
            `/login?error=session_expired&redirect=${encodeURIComponent(currentPath)}`
          );
        } else {
          setTimeout(() => {
            isHandlingUnauthorized = false;
          }, 2000);
        }
      });
  }
  throw new UnauthorizedError("Session invalid, expired, or missing. Redirecting to login...");
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const localToken = getAuthSessionToken();
  if (localToken) {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localToken}`,
    };
  }

  return { "Content-Type": "application/json" };
}

async function parseJsonPayload(res: Response): Promise<any> {
  if (res.status === 401) {
    handleUnauthorized();
  }

  let json: any;
  try {
    json = await res.json();
  } catch {
    if (!res.ok) {
      throw new Error(`API request failed with status ${res.status}`);
    }
    return null;
  }

  if (!res.ok || !json.success) {
    throw new Error(json.message || "API request failed");
  }
  return json;
}

async function handleResponse<T>(res: Response): Promise<T> {
  const json = await parseJsonPayload(res);
  return (json ? json.data : {}) as T;
}

export const api = {
  async get<T>(path: string): Promise<T> {
    const headers = await getAuthHeaders();
    const res = await fetchWithTimeout(`${getApiBase()}${path}`, { headers });
    return handleResponse<T>(res);
  },

  async getWithMeta<T>(path: string): Promise<{ data: T; meta: any }> {
    const headers = await getAuthHeaders();
    const res = await fetchWithTimeout(`${getApiBase()}${path}`, { headers });
    const json = await parseJsonPayload(res);
    return { data: (json?.data ?? []) as T, meta: json?.meta ?? {} };
  },

  async post<T>(path: string, body: any): Promise<T> {
    const headers = await getAuthHeaders();
    const res = await fetchWithTimeout(`${getApiBase()}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    return handleResponse<T>(res);
  },

  async patch<T>(path: string, body: any): Promise<T> {
    const headers = await getAuthHeaders();
    const res = await fetchWithTimeout(`${getApiBase()}${path}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(body),
    });
    return handleResponse<T>(res);
  },

  async delete<T>(path: string): Promise<T> {
    const headers = await getAuthHeaders();
    const res = await fetchWithTimeout(`${getApiBase()}${path}`, {
      method: "DELETE",
      headers,
    });
    return handleResponse<T>(res);
  },

  async download(path: string, filename?: string): Promise<Blob> {
    const headers = await getAuthHeaders();
    const res = await fetchWithTimeout(`${getApiBase()}${path}`, { headers });
    if (res.status === 401) {
      handleUnauthorized();
    }
    if (!res.ok) {
      let message = `Download failed with status ${res.status}`;
      try {
        const json = await res.json();
        if (json?.message) message = json.message;
      } catch {}
      throw new Error(message);
    }
    const blob = await res.blob();
    if (typeof window !== "undefined") {
      const disposition = res.headers.get("content-disposition") || "";
      const match = disposition.match(/filename="?([^";]+)"?/i);
      const resolvedName = filename || match?.[1] || "download";
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = resolvedName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    }
    return blob;
  },
};

export const apiClient = api;

const REQUEST_TIMEOUT_MS = 15000;

async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const apiBase = getApiBase();
  try {
    return await fetch(url, {
      ...options,
      credentials: "include",
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw new Error(`Request timed out. Is the backend server running on ${apiBase}?`);
    }
    if (err instanceof TypeError) {
      throw new Error(`Cannot reach the server. Is the backend running on ${apiBase}?`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
