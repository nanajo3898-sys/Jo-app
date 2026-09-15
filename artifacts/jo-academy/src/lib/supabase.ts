let SUPABASE_URL = (
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
  ''
).replace(/\/$/, '');
let SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

let runtimeConfigPromise: Promise<void> | null = null;
let useServerProxy = false;

async function loadRuntimeConfig() {
  if (SUPABASE_URL && SUPABASE_ANON_KEY) return;
  if (!runtimeConfigPromise) {
    runtimeConfigPromise = fetch('/api/config')
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.error || 'تعذر تحميل إعدادات المنصة');
        SUPABASE_URL = String(payload?.supabaseUrl || '').replace(/\/$/, '');
        SUPABASE_ANON_KEY = String(payload?.supabaseAnonKey || '');
      })
      .catch(() => {
        useServerProxy = true;
      });
  }
  await runtimeConfigPromise;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) useServerProxy = true;
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  auth?: boolean;
};

type AuthResponse = { access_token?: string; refresh_token?: string; user?: User; error_description?: string; msg?: string };
export type User = { id: string; email?: string; user_metadata?: Record<string, unknown> };

const tokenKey = 'jo_supabase_session';
const readSession = () => {
  try { return JSON.parse(localStorage.getItem(tokenKey) || 'null') as { access_token?: string; refresh_token?: string } | null; } catch { return null; }
};

const getAccessToken = () => readSession()?.access_token || null;
const saveSession = (data: AuthResponse | null) => {
  if (data?.access_token) localStorage.setItem(tokenKey, JSON.stringify({ access_token: data.access_token, refresh_token: data.refresh_token }));
  else localStorage.removeItem(tokenKey);
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<{ data: T | null; error: Error | null }> {
  await loadRuntimeConfig();
  if (!useServerProxy && (!SUPABASE_URL || !SUPABASE_ANON_KEY)) {
    return { data: null, error: new Error('بيانات Supabase غير متاحة في بيئة التشغيل') };
  }
  const session = readSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (!useServerProxy) headers.apikey = SUPABASE_ANON_KEY;
  if (options.auth !== false && session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  try {
    const target = useServerProxy ? `/api/supabase${path}` : `${SUPABASE_URL}${path}`;
    const response = await fetch(target, {
      method: options.method || 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        payload?.msg ||
        payload?.message ||
        payload?.error_description ||
        payload?.error ||
        payload?.hint ||
        'تعذر إتمام الطلب';
      return { data: null, error: new Error(message) };
    }
    return { data: payload as T, error: null };
  } catch { return { data: null, error: new Error('تعذر الاتصال بالخدمة حالياً') }; }
}

export const supabase = {
  auth: {
    getAccessToken,
    async getUser() {
      const session = readSession();
      if (!session?.access_token) return { data: { user: null as User | null }, error: null };
      const result = await request<User>('/auth/v1/user');
      if (result.error) { saveSession(null); return { data: { user: null }, error: result.error }; }
      return { data: { user: result.data }, error: null };
    },
    async signInWithPassword(credentials: { email: string; password: string }) {
      const result = await request<AuthResponse>('/auth/v1/token?grant_type=password', { method: 'POST', body: credentials, auth: false });
      if (result.data) saveSession(result.data);
      return { data: result.data, error: result.error };
    },
    async signUp(credentials: { email: string; password: string; options?: { data?: Record<string, unknown> } }) {
      const result = await request<AuthResponse>('/auth/v1/signup', {
        method: 'POST',
        body: { email: credentials.email, password: credentials.password, data: credentials.options?.data || {} },
        auth: false,
      });
      if (result.data?.access_token) saveSession(result.data);
      return {
        data: result.data,
        error: result.error,
        needsEmailConfirmation: Boolean(!result.error && result.data && !result.data.access_token),
      };
    },
    async resetPasswordForEmail(email: string, redirectTo: string) {
      return request<unknown>('/auth/v1/recover', { method: 'POST', body: { email, redirect_to: redirectTo }, auth: false });
    },
    async signOut() { saveSession(null); return { error: null }; },
  },
  from<T extends Record<string, unknown> = Record<string, unknown>>(table: string) {
    const query = (params: URLSearchParams) => `/rest/v1/${table}?${params.toString()}`;
    return {
      async select(columns = '*', filters: Record<string, string | number | boolean | undefined> = {}) {
        const params = new URLSearchParams({ select: columns });
        Object.entries(filters).forEach(([key, value]) => { if (value !== undefined) params.set(key, `eq.${String(value)}`); });
        const result = await request<T[]>(query(params));
        return { data: result.data || [], error: result.error };
      },
      async single(columns = '*', filters: Record<string, string | number | boolean | undefined> = {}) {
        const result = await this.select(columns, { ...filters, limit: 1 });
        return { data: result.data?.[0] || null, error: result.error };
      },
      async insert(values: Partial<T> | Partial<T>[]) {
        return request<T[]>(`/rest/v1/${table}`, { method: 'POST', body: values });
      },
      async update(values: Partial<T>, filters: Record<string, string | number | boolean>) {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => params.set(key, `eq.${String(value)}`));
        return request<T[]>(`/rest/v1/${table}?${params.toString()}`, { method: 'PATCH', body: values });
      },
      async remove(filters: Record<string, string | number | boolean>) {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => params.set(key, `eq.${String(value)}`));
        return request<unknown>(`/rest/v1/${table}?${params.toString()}`, { method: 'DELETE' });
      },
    };
  },
};
