type SupabaseResponse<T> = {
  ok: boolean;
  status: number;
  data: T | null;
};

const getConfig = () => {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";

  if (!url || !anonKey) {
    throw new Error("Supabase server configuration is missing");
  }

  return { url, anonKey };
};

export async function supabaseRequest<T>(
  path: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<SupabaseResponse<T>> {
  const { url, anonKey } = getConfig();
  const headers = new Headers(init.headers);
  headers.set("apikey", anonKey);
  headers.set("Authorization", `Bearer ${accessToken}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${url}${path}`, { ...init, headers });
  const data = (await response.json().catch(() => null)) as T | null;
  return { ok: response.ok, status: response.status, data };
}