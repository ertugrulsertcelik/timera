const BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

// accessToken → sessionStorage (sekme kapanınca silinir)
// refreshToken → localStorage (oturumlar arası kalıcı)
const getAT = () => sessionStorage.getItem("accessToken");
const setAT = (t: string) => sessionStorage.setItem("accessToken", t);

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getAT();
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });

  if (res.status === 401 && path !== "/auth/login") {
    const refreshed = await tryRefresh();
    if (refreshed) return request<T>(path, options);
    sessionStorage.removeItem("accessToken");
    sessionStorage.removeItem("refreshToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    window.location.href = "/login";
    throw new Error("Oturum süresi doldu");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || "Bir hata oluştu");
  }
  return res.json() as Promise<T>;
}

async function tryRefresh(): Promise<boolean> {
  const rt = localStorage.getItem("refreshToken") || sessionStorage.getItem("refreshToken");
  if (!rt) return false;
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: rt }),
    });
    if (!res.ok) return false;
    const { accessToken, refreshToken } = await res.json();
    setAT(accessToken);
    if (refreshToken) localStorage.setItem("refreshToken", refreshToken);
    return true;
  } catch {
    return false;
  }
}

export const api = {
  get:    <T>(path: string)                 => request<T>(path),
  post:   <T>(path: string, body?: unknown) => request<T>(path, { method: "POST",   body: JSON.stringify(body) }),
  put:    <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT",    body: JSON.stringify(body) }),
  patch:  <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH",  body: JSON.stringify(body) }),
  delete: <T>(path: string)                 => request<T>(path, { method: "DELETE" }),
};
