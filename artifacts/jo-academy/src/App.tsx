import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Link, Route, Switch, Router as WouterRouter, useLocation, useParams } from 'wouter';
import { ArrowDown, ArrowLeft, ArrowUp, Award, BarChart3, BookOpen, CalendarDays, Check, CheckCircle2, ChevronLeft, Clock3, Edit3, Eye, EyeOff, ExternalLink, File, FileBadge, FileText, Flame, GraduationCap, GripVertical, LayoutDashboard, Library, Link2, LogOut, Megaphone, Menu, MessageCircle, MoreHorizontal, Play, Plus, RotateCcw, Save, Search, Settings2, Shield, Sparkles, Target, Trash2, Trophy, UserRound, Users, Video, X, Zap } from 'lucide-react';
import { supabase, type User } from '@/lib/supabase';
import type { Camp, Exam, Lesson, LessonResource, Profile, Question, Subject, Task, Unit } from '@/types/jo';
import { setAuthTokenGetter, useDeleteExamQuestion, useGenerateQuestions, useGetExamQuestions, useReorderExamQuestions, useUpdateExamQuestion } from '@workspace/api-client-react';

const queryClient = new QueryClient();
setAuthTokenGetter(() => supabase.auth.getAccessToken());
const navItems = [
  { href: '/dashboard', label: 'الرئيسية', icon: LayoutDashboard },
  { href: '/subjects', label: 'المواد', icon: BookOpen },
  { href: '/exams', label: 'الامتحانات', icon: FileText },
  { href: '/camps', label: 'المعسكرات', icon: GraduationCap },
  { href: '/schedule', label: 'الجدول', icon: CalendarDays },
  { href: '/todo', label: 'المهام', icon: CheckCircle2 },
  { href: '/achievements', label: 'الإنجازات', icon: Trophy },
  { href: '/community', label: 'المجتمع', icon: MessageCircle },
];

function Logo() {
  return <Link href="/dashboard" className="flex items-center gap-3" data-testid="link-logo"><span className="grid size-10 place-items-center rounded-2xl bg-secondary text-lg font-extrabold text-secondary-foreground shadow-sm">JO</span><span className="hidden text-lg font-extrabold tracking-tight sm:inline">أكاديمية <b className="text-accent">JO</b></span></Link>;
}

function Skeleton({ className = '' }: { className?: string }) { return <div className={`skeleton rounded-2xl ${className}`} aria-label="جاري التحميل" data-testid="status-loading" />; }

function EmptyState({ icon: Icon = Library, title, text, action }: { icon?: typeof Library; title: string; text: string; action?: ReactNode }) {
  return <div className="flex min-h-56 flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-border bg-card/60 p-8 text-center" data-testid="status-empty"><span className="mb-4 grid size-14 place-items-center rounded-2xl bg-muted text-muted-foreground"><Icon className="size-6" /></span><h3 className="font-bold">{title}</h3><p className="mt-2 max-w-sm text-sm leading-7 text-muted-foreground">{text}</p>{action && <div className="mt-5">{action}</div>}</div>;
}

function dataErrorMessage(error?: Error | null) {
  const message = error?.message || '';
  const normalized = message.toLowerCase();
  if (normalized.includes('pgrst205') || normalized.includes('does not exist') || normalized.includes('relation') || normalized.includes('undefined table')) {
    return 'الجداول المطلوبة لم تُنشأ بعد. شغّل ملفي supabase/community-modes.sql و supabase/academy-admin.sql في Supabase SQL Editor ثم أعد المحاولة.';
  }
  if (normalized.includes('jwt') || normalized.includes('unauthorized') || normalized.includes('not authenticated')) {
    return 'انتهت جلسة الدخول. سجّل الخروج ثم ادخل إلى الحساب مرة أخرى.';
  }
  if (normalized.includes('permission') || normalized.includes('row-level security') || normalized.includes('rls')) {
    return 'صلاحيات قاعدة البيانات تمنع العملية. تأكد من تشغيل ملف سياسات المجتمع وتأكد من صلاحية الحساب.';
  }
  if (normalized.includes('network') || normalized.includes('fetch') || normalized.includes('connect')) {
    return 'تعذر الوصول إلى Supabase. افحص إعدادات الاتصال ثم أعد المحاولة.';
  }
  return message || 'تعذر تحميل البيانات حالياً.';
}

function isSafeHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function ErrorState({ retry, error }: { retry?: () => void; error?: Error | null }) {
  return <div className="rounded-[1.5rem] border border-destructive/20 bg-destructive/5 p-8 text-center" data-testid="status-error"><p className="font-bold text-destructive">حصلت مشكلة في تحميل البيانات</p><p className="mt-2 text-sm leading-7 text-muted-foreground">{dataErrorMessage(error)}</p>{retry && <button onClick={retry} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground" data-testid="button-retry"><RotateCcw className="size-4" /> إعادة المحاولة</button>}</div>;
}

function SectionHeading({ eyebrow, title, text, action }: { eyebrow?: string; title: string; text?: string; action?: ReactNode }) {
  return <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-xs font-bold tracking-[.16em] text-accent uppercase">{eyebrow && <span className="size-1.5 rounded-full bg-accent" />}{eyebrow}</div><h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>{text && <p className="mt-2 text-sm text-muted-foreground">{text}</p>}</div>{action}</div>;
}

function Sidebar({ profile, close }: { profile: Profile | null; close?: () => void }) {
  const [location] = useLocation();
  return <aside className="flex h-full w-72 flex-col border-l border-sidebar-border bg-sidebar px-4 py-5 text-sidebar-foreground"><div className="mb-8 flex items-center justify-between px-3"><Logo />{close && <button onClick={close} className="text-sidebar-foreground/60 lg:hidden" data-testid="button-close-menu"><X className="size-5" /></button>}</div><div className="mb-6 rounded-2xl bg-sidebar-accent p-4"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-sidebar-primary font-bold text-sidebar-primary-foreground">{(profile?.full_name || 'طالب').slice(0, 1)}</span><div className="min-w-0"><p className="truncate text-sm font-bold">{profile?.full_name || 'طالب جديد'}</p><p className="mt-0.5 text-xs text-sidebar-foreground/55">{profile?.xp || 0} نقطة خبرة</p></div></div><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-sidebar-foreground/10"><div className="h-full rounded-full bg-sidebar-primary" style={{ width: `${Math.min(((profile?.xp || 0) % 1000) / 10, 100)}%` }} /></div></div><p className="mb-2 px-3 text-[11px] font-bold tracking-[.18em] text-sidebar-foreground/40">مساحتي الدراسية</p><nav className="space-y-1">{navItems.map(({ href, label, icon: Icon }) => { const active = location === href || (href !== '/dashboard' && location.startsWith(`${href}/`)); return <Link key={href} href={href} onClick={close} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors ${active ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground'}`} data-testid={`link-nav-${label}`}><Icon className="size-[18px]" />{label}</Link>; })}</nav><div className="mt-auto space-y-1 border-t border-sidebar-border pt-4"><Link href="/plans" onClick={close} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-sidebar-foreground/65 hover:bg-sidebar-accent" data-testid="link-nav-plans"><Target className="size-[18px]" />خطتي الدراسية</Link><Link href="/profile" onClick={close} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-sidebar-foreground/65 hover:bg-sidebar-accent" data-testid="link-nav-profile"><UserRound className="size-[18px]" />الملف الشخصي</Link>{profile?.role === 'supervisor' && <Link href="/admin" onClick={close} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-secondary" data-testid="link-nav-admin"><Shield className="size-[18px]" />لوحة المشرف</Link>}</div></aside>;
}

function AppShell({ children, profile, user }: { children: ReactNode; profile: Profile | null; user: User | null }) {
  const [menu, setMenu] = useState(false);
  const [, setLocation] = useLocation();
  const logout = async () => { await supabase.auth.signOut(); setLocation('/'); };
  return <div className="min-h-[100dvh] bg-background"><div className="hidden lg:fixed lg:inset-y-0 lg:right-0 lg:flex"><Sidebar profile={profile} /></div>{menu && <div className="fixed inset-0 z-40 bg-primary/40 backdrop-blur-sm lg:hidden" onClick={() => setMenu(false)}><div className="h-full w-[min(19rem,88vw)]" onClick={(e) => e.stopPropagation()}><Sidebar profile={profile} close={() => setMenu(false)} /></div></div>}<div className="lg:pr-72"><header className="sticky top-0 z-30 flex h-[4.5rem] items-center justify-between border-b border-border/80 bg-background/90 px-4 backdrop-blur-md sm:px-8"><button onClick={() => setMenu(true)} className="rounded-xl p-2 text-muted-foreground hover:bg-muted lg:hidden" data-testid="button-open-menu"><Menu className="size-5" /></button><div className="hidden lg:block"><p className="text-xs text-muted-foreground">مساحة هادئة للتركيز</p><p className="text-sm font-bold">كل جلسة تقرّبك من هدفك</p></div><div className="mr-auto flex items-center gap-2 sm:gap-4"><a href="https://whatsapp.com/channel/0029VbBz2Zb8vd1Velf6gm35" target="_blank" rel="noreferrer" className="hidden items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-700 sm:flex" data-testid="link-whatsapp"><Users className="size-4" />قناة الطلاب</a><Link href="/profile" className="flex items-center gap-2 rounded-xl p-1.5 hover:bg-muted" data-testid="link-profile-header"><span className="grid size-9 place-items-center rounded-xl bg-accent text-sm font-extrabold text-accent-foreground">{(profile?.full_name || 'ط').slice(0, 1)}</span><span className="hidden text-right sm:block"><b className="block text-xs">{profile?.full_name || 'طالب'}</b><small className="text-muted-foreground">{user?.email || 'حسابك الدراسي'}</small></span></Link><button onClick={logout} className="rounded-xl p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="تسجيل الخروج" data-testid="button-logout"><LogOut className="size-4" /></button></div></header><main className="app-grid min-h-[calc(100dvh-4.5rem)] px-4 py-7 sm:px-8 lg:px-10">{children}</main></div></div>;
}

function authErrorMessage(error: Error | null) {
  const message = error?.message || 'تعذر إتمام العملية حالياً';
  const normalized = message.toLowerCase();
  if (normalized.includes('invalid login credentials') || normalized.includes('invalid email or password')) return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
  if (normalized.includes('email not confirmed')) return 'الحساب اتعمل، لكن لازم تؤكد البريد الإلكتروني أولاً أو تلغي تأكيد البريد من إعدادات Supabase.';
  if (normalized.includes('user already registered') || normalized.includes('already been registered')) return 'هذا البريد مسجل بالفعل. جرّب تسجيل الدخول بدلاً من إنشاء حساب جديد.';
  if (normalized.includes('password should be') || normalized.includes('password')) return 'كلمة المرور لا تستوفي الشروط المطلوبة.';
  if (normalized.includes('invalid email')) return 'اكتب بريدًا إلكترونيًا صحيحًا.';
  if (normalized.includes('rate limit') || normalized.includes('too many')) return 'المحاولات كثيرة حالياً. انتظر قليلاً ثم حاول مرة أخرى.';
  if (normalized.includes('network') || normalized.includes('connect')) return 'تعذر الاتصال بالخدمة حالياً. تحقق من الإنترنت وحاول مرة أخرى.';
  return message;
}

function Landing() {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(''); const [info, setInfo] = useState(''); const [loading, setLoading] = useState(false);
  const submit = async (e: FormEvent) => { e.preventDefault(); setLoading(true); setError(''); setInfo('');
    if (mode === 'register' && password.length < 8) { setError('كلمة المرور لازم تكون 8 حروف أو أرقام على الأقل'); setLoading(false); return; }
    const result = mode === 'forgot' ? await supabase.auth.resetPasswordForEmail(email, `${window.location.origin}/auth/callback?next=/dashboard`) : mode === 'login' ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
    if (result.error) setError(authErrorMessage(result.error));
    else if (mode === 'forgot') setInfo('اتبعنا لك رابط استعادة كلمة المرور على بريدك الإلكتروني');
    else if (mode === 'register' && 'needsEmailConfirmation' in result && result.needsEmailConfirmation) setInfo('تم إنشاء حسابك. افتح بريدك الإلكتروني واضغط رابط التأكيد، وبعدها ارجع وسجّل دخولك.');
    else setLocation('/dashboard');
    setLoading(false);
  };
  const features = [{ icon: BookOpen, title: 'منهجك في مكان واحد', text: 'دروس، مراجعات، وامتحانات لكل مادة.' }, { icon: Zap, title: 'تقدم تقدر تشوفه', text: 'نقاط وسلسلة أيام تحافظ على حماسك.' }, { icon: Users, title: 'مش لوحدك', text: 'مجتمع طلابي للمشاركة والسؤال.' }];
  return <div className="min-h-[100dvh] overflow-hidden bg-primary text-primary-foreground"><div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 70% 20%, hsl(var(--secondary)), transparent 32%), radial-gradient(circle at 10% 80%, hsl(var(--accent)), transparent 28%)' }} /><header className="relative mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-2xl bg-secondary font-extrabold text-primary">JO</span><span className="font-bold">أكاديمية JO</span></div><span className="rounded-full border border-primary-foreground/15 px-3 py-1.5 text-xs text-primary-foreground/65">طلاب الصف الأول الثانوي</span></header><main className="relative mx-auto grid max-w-7xl gap-12 px-5 pb-14 pt-8 sm:px-8 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:gap-20 lg:pt-16"><section className="fade-up max-w-2xl"><div className="mb-6 inline-flex items-center gap-2 rounded-full border border-secondary/35 bg-secondary/10 px-4 py-2 text-xs font-bold text-secondary"><Sparkles className="size-4" />منصة مذاكرة معمولة عشان تكمل</div><h1 className="text-4xl font-extrabold leading-[1.25] tracking-tight sm:text-6xl">ذاكر بتركيز.<br /><span className="text-secondary">اتقدم كل يوم.</span></h1><p className="mt-6 max-w-xl text-base leading-8 text-primary-foreground/65 sm:text-lg">كل اللي تحتاجه في سنة الصف الأول الثانوي، من أول درس لحد آخر امتحان. افتح حسابك وخلّي مذاكرتك أوضح.</p><div className="mt-10 grid gap-5 sm:grid-cols-3">{features.map(({ icon: Icon, title, text }, index) => <div className={`fade-up delay-${index + 1}`} key={title}><Icon className="mb-3 size-5 text-secondary" /><h3 className="text-sm font-bold">{title}</h3><p className="mt-1 text-xs leading-6 text-primary-foreground/50">{text}</p></div>)}</div></section><section className="fade-up delay-2 rounded-[2rem] border border-primary-foreground/10 bg-primary-foreground/[.07] p-5 shadow-2xl backdrop-blur-xl sm:p-8"><div className="mb-7"><p className="text-xs font-bold tracking-[.16em] text-secondary">ابدأ من هنا</p><h2 className="mt-2 text-2xl font-extrabold">{mode === 'forgot' ? 'استرجع حسابك' : mode === 'register' ? 'حساب جديد، بداية جديدة' : 'أهلاً بيك من جديد'}</h2><p className="mt-2 text-sm text-primary-foreground/55">{mode === 'forgot' ? 'هنبعتلك رابط آمن على بريدك.' : 'سجّل دخولك وكمل من آخر نقطة وقفت عندها.'}</p></div>{mode !== 'forgot' && <div className="mb-6 grid grid-cols-2 rounded-xl bg-primary-foreground/10 p-1"><button className={`rounded-lg py-2.5 text-sm font-bold ${mode === 'login' ? 'bg-secondary text-secondary-foreground' : 'text-primary-foreground/55'}`} onClick={() => setMode('login')} data-testid="button-mode-login">تسجيل الدخول</button><button className={`rounded-lg py-2.5 text-sm font-bold ${mode === 'register' ? 'bg-secondary text-secondary-foreground' : 'text-primary-foreground/55'}`} onClick={() => setMode('register')} data-testid="button-mode-register">حساب جديد</button></div>}<form onSubmit={submit} className="space-y-4">{mode === 'register' && <label className="block"><span className="mb-2 block text-xs font-bold text-primary-foreground/65">الاسم بالكامل</span><input value={name} onChange={(e) => setName(e.target.value)} required className="w-full rounded-xl border border-primary-foreground/10 bg-primary-foreground/10 px-4 py-3 text-sm outline-none placeholder:text-primary-foreground/30 focus:border-secondary" placeholder="اكتب اسمك" data-testid="input-name" /></label>}<label className="block"><span className="mb-2 block text-xs font-bold text-primary-foreground/65">البريد الإلكتروني</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full rounded-xl border border-primary-foreground/10 bg-primary-foreground/10 px-4 py-3 text-sm outline-none placeholder:text-primary-foreground/30 focus:border-secondary" placeholder="name@example.com" data-testid="input-email" /></label>{mode !== 'forgot' && <label className="block"><span className="mb-2 block text-xs font-bold text-primary-foreground/65">كلمة المرور</span><div className="relative"><input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={mode === 'register' ? 8 : undefined} className="w-full rounded-xl border border-primary-foreground/10 bg-primary-foreground/10 px-4 py-3 pl-12 text-sm outline-none placeholder:text-primary-foreground/30 focus:border-secondary" placeholder="••••••••" data-testid="input-password" /><button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute left-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-primary-foreground/55 hover:bg-primary-foreground/10 hover:text-primary-foreground" aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'} title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'} data-testid="button-toggle-password">{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div></label>}{mode === 'login' && <button type="button" onClick={() => setMode('forgot')} className="text-xs font-bold text-secondary" data-testid="button-forgot">نسيت كلمة المرور؟</button>}{error && <p className="rounded-xl bg-destructive/15 p-3 text-xs font-semibold text-red-200" data-testid="status-auth-error">{error}</p>}{info && <p className="rounded-xl bg-emerald-500/15 p-3 text-xs font-semibold text-emerald-200" data-testid="status-auth-info">{info}</p>}<button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-secondary py-3.5 text-sm font-extrabold text-secondary-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-60" type="submit" data-testid="button-submit-auth">{loading ? 'جاري التحميل...' : mode === 'login' ? 'دخول إلى حسابي' : mode === 'register' ? 'إنشاء الحساب' : 'إرسال رابط الاستعادة'}</button>{mode === 'forgot' && <button type="button" onClick={() => setMode('login')} className="w-full text-xs text-primary-foreground/50" data-testid="button-back-login">العودة لتسجيل الدخول</button>}</form></section></main></div>;
}

function useRows<T extends Record<string, unknown>>(table: string, filters: Record<string, string | number | boolean | undefined> = {}, select = '*') {
  const [rows, setRows] = useState<T[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState<Error | null>(null); const [tick, setTick] = useState(0);
  useEffect(() => { let active = true; setLoading(true); supabase.from<T>(table).select(select, filters).then((result) => { if (!active) return; setRows(result.data || []); setError(result.error); setLoading(false); }); return () => { active = false; }; }, [table, select, JSON.stringify(filters), tick]);
  return { rows, loading, error, retry: () => setTick((v) => v + 1), setRows };
}

function StatCard({ icon: Icon, label, value, accent = 'bg-secondary text-secondary-foreground' }: { icon: typeof Zap; label: string; value: string | number; accent?: string }) { return <div className="rounded-2xl border border-border bg-card p-4 shadow-xs"><div className="flex items-center justify-between"><span className={`grid size-10 place-items-center rounded-xl ${accent}`}><Icon className="size-5" /></span><MoreHorizontal className="size-4 text-muted-foreground/50" /></div><p className="mt-4 text-2xl font-extrabold" data-testid={`text-stat-${label}`}>{value}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></div>; }

function DashboardContent({ profile, user }: { profile: Profile | null; user: User }) {
  const tasks = useRows<Task>('tasks', { user_id: user.id }); const attempts = useRows<Record<string, unknown>>('exam_attempts', { user_id: user.id });
  const [title, setTitle] = useState('');
  const addTask = async (e: FormEvent) => { e.preventDefault(); if (!title.trim()) return; const result = await supabase.from<Task>('tasks').insert({ user_id: user.id, title: title.trim(), completed: false }); if (!result.error) { setTitle(''); tasks.retry(); } };
  const toggle = async (task: Task) => { await supabase.from<Task>('tasks').update({ completed: !task.completed }, { id: task.id }); tasks.retry(); };
  return <div className="mx-auto max-w-[1380px]"><div className="fade-up mb-8 flex flex-wrap items-end justify-between gap-5"><div><p className="mb-2 text-sm text-muted-foreground">صباح الخير، {profile?.full_name?.split(' ')[0] || 'يا بطل'} <span className="text-secondary">—</span></p><h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">خطوتك الجاية واضحة.</h1><p className="mt-2 text-sm text-muted-foreground">دي مساحتك اليومية، خلّي تركيزك على حاجة واحدة في كل مرة.</p></div><Link href="/schedule" className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90" data-testid="link-dashboard-schedule"><CalendarDays className="size-4" />شوف جدولك</Link></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><StatCard icon={Zap} label="نقطة خبرة" value={profile?.xp || 0} /><StatCard icon={Flame} label="أيام متتالية" value={profile?.streak || 0} accent="bg-accent text-accent-foreground" /><StatCard icon={BookOpen} label="ساعات مذاكرة" value={profile?.study_hours || 0} accent="bg-[hsl(var(--chart-3))] text-white" /><StatCard icon={FileText} label="امتحانات محلولة" value={attempts.rows.length} accent="bg-primary text-primary-foreground" /></div><div className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_.75fr]"><div className="space-y-6"><div className="relative overflow-hidden rounded-[1.75rem] bg-primary p-6 text-primary-foreground shadow-lg sm:p-8"><div className="absolute -left-16 -top-20 size-56 rounded-full border-[28px] border-secondary/15" /><div className="relative"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold tracking-[.16em] text-secondary">تقدمك هذا الشهر</p><h2 className="mt-3 text-2xl font-extrabold">كمّل بنفس الإيقاع</h2><p className="mt-2 max-w-md text-sm leading-7 text-primary-foreground/60">الاستمرارية مش معناها تذاكر كتير مرة واحدة، معناها ترجع كل يوم.</p></div><span className="grid size-14 place-items-center rounded-2xl bg-secondary font-mono text-xl font-bold text-secondary-foreground">{Math.min(((profile?.xp || 0) % 1000) / 10, 100).toFixed(0)}<small className="text-xs">%</small></span></div><div className="mt-8 h-2 overflow-hidden rounded-full bg-primary-foreground/10"><div className="h-full rounded-full bg-secondary transition-all" style={{ width: `${Math.min(((profile?.xp || 0) % 1000) / 10, 100)}%` }} /></div><div className="mt-3 flex justify-between text-xs text-primary-foreground/45"><span>{profile?.xp || 0} نقطة</span><span>المستوى التالي · {1000 - ((profile?.xp || 0) % 1000)} نقطة</span></div></div></div><div><div className="mb-4 flex items-center justify-between"><h2 className="font-extrabold">ابدأ من مكانك</h2><Link href="/subjects" className="text-xs font-bold text-accent" data-testid="link-dashboard-subjects">كل المواد <ChevronLeft className="mr-1 inline size-3" /></Link></div><div className="grid gap-3 sm:grid-cols-2"><QuickLink href="/subjects" icon={BookOpen} title="المواد الدراسية" text="شوف الدروس الجديدة" color="text-[hsl(var(--chart-3))]" /><QuickLink href="/exams" icon={FileText} title="الامتحانات" text="اختبر فهمك" color="text-accent" /><QuickLink href="/camps" icon={GraduationCap} title="معسكرات المذاكرة" text="التزم بخطة جماعية" color="text-secondary-foreground" /><QuickLink href="/community" icon={MessageCircle} title="مجتمع الطلاب" text="اسأل وشارك" color="text-primary" /></div></div><div className="rounded-2xl border border-border bg-card p-5 shadow-xs"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-extrabold">آخر المحاولات</h2><p className="mt-1 text-xs text-muted-foreground">نتائجك الأخيرة تظهر هنا</p></div><FileBadge className="size-5 text-muted-foreground" /></div>{attempts.loading ? <Skeleton className="h-14" /> : attempts.error ? <ErrorState retry={attempts.retry} /> : attempts.rows.length === 0 ? <EmptyState icon={FileText} title="لسه مفيش محاولات" text="حل أول امتحان ليك وشوف نتيجتك فوراً." action={<Link href="/exams" className="text-sm font-bold text-accent" data-testid="link-empty-exams">تصفح الامتحانات</Link>} /> : <div className="space-y-2">{attempts.rows.slice(0, 4).map((attempt, index) => <div className="flex items-center justify-between rounded-xl bg-muted/55 p-3" key={String(attempt.id || index)} data-testid={`row-attempt-${attempt.id || index}`}><span className="text-sm font-semibold">{String(attempt.title || 'محاولة امتحان')}</span><b className="font-mono text-sm text-[hsl(var(--chart-3))]">{String(attempt.percentage || attempt.score || 0)}%</b></div>)}</div>}</div></div><div className="space-y-6"><div className="rounded-2xl border border-border bg-card p-5 shadow-xs"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-extrabold">مهام اليوم</h2><p className="mt-1 text-xs text-muted-foreground">خطط صغيرة، إنجاز كبير</p></div><Link href="/todo" className="text-xs font-bold text-accent" data-testid="link-dashboard-todo">كل المهام</Link></div><form onSubmit={addTask} className="mb-4 flex gap-2"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="أضف مهمة جديدة..." className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2.5 text-xs outline-none focus:ring-2 focus:ring-ring" data-testid="input-task-dashboard" /><button className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground" type="submit" data-testid="button-add-task-dashboard"><Plus className="size-4" /></button></form>{tasks.loading ? <div className="space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div> : tasks.error ? <ErrorState retry={tasks.retry} /> : tasks.rows.slice(0, 5).map((task) => <button key={task.id} onClick={() => toggle(task)} className="flex w-full items-center gap-3 border-b border-border/70 py-3 text-right last:border-0" data-testid={`button-toggle-task-${task.id}`}><span className={`grid size-5 place-items-center rounded-md border ${task.completed ? 'border-[hsl(var(--chart-3))] bg-[hsl(var(--chart-3))] text-white' : 'border-border'}`}>{task.completed && <Check className="size-3" />}</span><span className={`flex-1 text-sm ${task.completed ? 'text-muted-foreground line-through' : 'font-semibold'}`}>{task.title}</span><ChevronLeft className="size-4 text-muted-foreground/50" /></button>)}{!tasks.loading && !tasks.error && tasks.rows.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">اكتب أول مهمة ليومك.</p>}</div><div className="rounded-2xl border border-border bg-card p-5 shadow-xs"><div className="flex items-center gap-4"><span className="grid size-12 place-items-center rounded-2xl bg-accent/15 text-accent"><Flame className="size-6" /></span><div><p className="text-xs text-muted-foreground">سلسلة المذاكرة</p><p className="mt-1 text-2xl font-extrabold">{profile?.streak || 0} <small className="text-sm font-bold text-muted-foreground">يوم</small></p></div></div><div className="mt-5 grid grid-cols-7 gap-1.5">{Array.from({ length: 7 }, (_, i) => <span key={i} className={`h-7 rounded-md ${i < Math.min(profile?.streak || 0, 7) ? 'bg-accent' : 'bg-muted'}`} />)}</div><p className="mt-3 text-xs text-muted-foreground">ارجع بكرة عشان تحافظ على السلسلة.</p></div></div></div></div>;
}

function Dashboard({ profile, user }: { profile: Profile | null; user: User }) {
  return <div className="mx-auto max-w-[1380px]">{profile?.role === 'supervisor' && <Link href="/admin" className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-secondary/30 bg-secondary/10 p-4 text-secondary-foreground shadow-xs transition hover:-translate-y-0.5 hover:bg-secondary/15" data-testid="link-dashboard-admin-announcement"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-secondary text-secondary-foreground"><Shield className="size-5" /></span><div><p className="text-xs font-bold">وضع المشرف مفعل</p><h2 className="mt-1 font-extrabold">افتح لوحة تحكم المشرف</h2><p className="mt-1 text-xs opacity-70">إدارة الطلاب والمحتوى والمجتمع من مكان واحد.</p></div></div><ArrowLeft className="size-5 shrink-0" /></Link>}<a href="https://whatsapp.com/channel/0029VbBz2Zb8vd1Velf6gm35" target="_blank" rel="noreferrer" className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-900 shadow-xs transition hover:-translate-y-0.5 hover:bg-emerald-500/15" data-testid="link-dashboard-whatsapp-announcement"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-emerald-500 text-white"><Megaphone className="size-5" /></span><div><p className="text-xs font-bold text-emerald-700">إعلان مهم للطلاب</p><h2 className="mt-1 font-extrabold">انضم إلى قناة الواتساب الرسمية</h2><p className="mt-1 text-xs text-emerald-800/70">تابع التنبيهات والمواعيد وآخر أخبار الأكاديمية.</p></div></div><ExternalLink className="size-5 shrink-0 text-emerald-700" /></a><DashboardContent profile={profile} user={user} /></div>;
}

function QuickLink({ href, icon: Icon, title, text, color }: { href: string; icon: typeof BookOpen; title: string; text: string; color: string }) { return <Link href={href} className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs transition-transform hover:-translate-y-0.5" data-testid={`link-quick-${title}`}><span className={`grid size-10 place-items-center rounded-xl bg-muted ${color}`}><Icon className="size-5" /></span><span><b className="block text-sm">{title}</b><small className="mt-1 block text-xs text-muted-foreground">{text}</small></span><ChevronLeft className="mr-auto size-4 text-muted-foreground/50 transition-transform group-hover:-translate-x-1" /></Link>; }

function Subjects() { const data = useRows<Subject>('subjects'); return <div className="mx-auto max-w-[1380px]"><SectionHeading eyebrow="مكتبة التعلم" title="المواد الدراسية" text="اختار مادة وابدأ من آخر درس وقفت عنده." /><div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><div className="rounded-2xl bg-primary p-5 text-primary-foreground sm:col-span-2"><Library className="mb-7 size-6 text-secondary" /><h2 className="text-xl font-extrabold">المعرفة بتتراكم</h2><p className="mt-2 max-w-md text-sm leading-7 text-primary-foreground/60">كل درس تخلصه بيقربك من الصورة الكبيرة. خليك فضولي، وإحنا نوفر لك الطريق.</p></div><StatCard icon={BookOpen} label="مواد متاحة" value={data.rows.length} /><StatCard icon={Target} label="دروس مستمرة" value="—" accent="bg-accent text-accent-foreground" /></div>{data.loading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><Skeleton className="h-44" /><Skeleton className="h-44" /><Skeleton className="h-44" /></div> : data.error ? <ErrorState retry={data.retry} /> : data.rows.length === 0 ? <EmptyState icon={BookOpen} title="المواد هتظهر هنا" text="مفيش مواد منشورة حالياً. ارجع قريباً أو تواصل مع المشرف." /> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{data.rows.map((subject, index) => <Link href={`/subjects/${subject.id}`} key={subject.id} className="group rounded-[1.5rem] border border-border bg-card p-5 shadow-xs transition-all hover:-translate-y-1 hover:border-accent/50 hover:shadow-md" data-testid={`card-subject-${subject.id}`}><div className="flex items-start justify-between"><span className={`grid size-12 place-items-center rounded-2xl ${index % 3 === 0 ? 'bg-secondary text-secondary-foreground' : index % 3 === 1 ? 'bg-accent/15 text-accent' : 'bg-[hsl(var(--chart-3))]/15 text-[hsl(var(--chart-3))]'}`}><BookOpen className="size-6" /></span><ChevronLeft className="size-5 text-muted-foreground/50 transition-transform group-hover:-translate-x-1" /></div><h2 className="mt-7 text-lg font-extrabold">{subject.name}</h2><p className="mt-2 line-clamp-2 text-sm leading-7 text-muted-foreground">{subject.description || 'استكشف الدروس والامتحانات الخاصة بالمادة.'}</p><div className="mt-6 flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground"><span>عرض المحتوى</span><span className="font-mono">0%</span></div></Link>)}</div>}</div>; }

function ResourceIcon({ type }: { type: LessonResource['resource_type'] }) {
  return type === 'video' ? <Video className="size-4" /> : type === 'file' ? <File className="size-4" /> : <Link2 className="size-4" />;
}

function SubjectDetail() {
  const { id } = useParams<{ id: string }>();
  const subject = useRows<Subject>('subjects', { id });
  const units = useRows<Unit>('units', { subject_id: id });
  const lessons = useRows<Lesson>('lessons');
  const resources = useRows<LessonResource>('lesson_resources');
  const subjectRow = subject.rows[0];
  const publishedLessons = lessons.rows.filter((lesson) => units.rows.some((unit) => unit.id === lesson.unit_id));
  const lessonResources = (lesson: Lesson) => [
    ...(lesson.video_url && isSafeHttpUrl(lesson.video_url) ? [{ id: `${lesson.id}-video`, title: 'الفيديو الرئيسي', resource_type: 'video' as const, url: lesson.video_url }] : []),
    ...(lesson.drive_url && isSafeHttpUrl(lesson.drive_url) ? [{ id: `${lesson.id}-drive`, title: 'ملف الدرس', resource_type: 'file' as const, url: lesson.drive_url }] : []),
    ...resources.rows.filter((resource) => resource.lesson_id === lesson.id && isSafeHttpUrl(resource.url)),
  ];

  return <div className="mx-auto max-w-[1100px]">
    <Link href="/subjects" className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground" data-testid="link-back-subjects"><ArrowLeft className="size-4" />كل المواد</Link>
    <div className="mb-8 rounded-[1.75rem] bg-primary p-6 text-primary-foreground sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-6"><div><span className="mb-4 inline-flex rounded-xl bg-secondary px-3 py-1.5 text-xs font-bold text-secondary-foreground">مسار المادة</span><h1 className="text-3xl font-extrabold">{subjectRow?.name || 'تفاصيل المادة'}</h1><p className="mt-3 max-w-xl text-sm leading-7 text-primary-foreground/60">{subjectRow?.description || 'ابدأ رحلة التعلم من الوحدات المتاحة.'}</p></div><div className="grid size-20 place-items-center rounded-[1.5rem] bg-primary-foreground/10"><BookOpen className="size-8 text-secondary" /></div></div>
    </div>
    <SectionHeading eyebrow="المحتوى" title="الوحدات والدروس" text="الفيديوهات والملفات والروابط المضافة من المشرف هتظهر هنا." />
    {units.loading || lessons.loading || resources.loading ? <div className="space-y-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></div> : units.error || lessons.error || resources.error ? <ErrorState retry={() => { units.retry(); lessons.retry(); resources.retry(); }} /> : units.rows.length === 0 ? <EmptyState icon={BookOpen} title="المحتوى قيد التجهيز" text="لم يتم نشر وحدات لهذه المادة بعد. سيظهر المحتوى هنا بمجرد اعتماده." /> : <div className="space-y-4">
      {units.rows.map((unit, index) => {
        const unitLessons = publishedLessons.filter((lesson) => lesson.unit_id === unit.id);
        return <div key={unit.id} className="rounded-2xl border border-border bg-card p-5 shadow-xs" data-testid={`unit-${unit.id}`}>
          <div className="flex items-center gap-4"><span className="font-mono text-sm text-accent">{String(index + 1).padStart(2, '0')}</span><div className="flex-1"><h2 className="font-bold">{unit.title}</h2><p className="mt-1 text-xs text-muted-foreground">{unitLessons.length} دروس</p></div></div>
          {unitLessons.length > 0 && <div className="mt-5 space-y-3 border-t border-border pt-4">{unitLessons.map((lesson) => <div key={lesson.id} className="rounded-xl bg-muted/45 p-4" data-testid={`lesson-${lesson.id}`}><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent"><Play className="size-4" /></span><div className="min-w-0 flex-1"><h3 className="font-bold">{lesson.title}</h3>{lessonResources(lesson).length > 0 && <div className="mt-3 flex flex-wrap gap-2">{lessonResources(lesson).map((resource) => <a key={resource.id} href={resource.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-bold text-accent hover:border-accent/50 hover:bg-accent/10"><ResourceIcon type={resource.resource_type} />{resource.title}<ExternalLink className="size-3" /></a>)}</div>}</div></div></div>)}</div>}
        </div>;
      })}
    </div>}
  </div>;
}

function Exams() { const data = useRows<Exam>('exams', { is_published: true }); return <div className="mx-auto max-w-[1380px]"><SectionHeading eyebrow="اختبر فهمك" title="الامتحانات" text="نتيجة فورية، وملاحظات تساعدك تعرف تراجع إيه." /><div className="mb-8 grid gap-4 md:grid-cols-3"><div className="rounded-2xl border border-border bg-card p-5 md:col-span-2"><div className="flex items-center gap-4"><span className="grid size-12 place-items-center rounded-2xl bg-accent/15 text-accent"><BarChart3 className="size-6" /></span><div><h2 className="font-extrabold">القياس مش حكم</h2><p className="mt-1 text-sm text-muted-foreground">كل محاولة بتقول لك إيه الخطوة اللي بعدها.</p></div></div></div><StatCard icon={FileText} label="امتحانات متاحة" value={data.rows.length} /></div>{data.loading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><Skeleton className="h-64" /><Skeleton className="h-64" /></div> : data.error ? <ErrorState retry={data.retry} /> : data.rows.length === 0 ? <EmptyState icon={FileText} title="مفيش امتحانات متاحة" text="الامتحانات المنشورة هتظهر هنا. استغل الوقت في مراجعة المواد." /> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{data.rows.map((exam) => <Link href={`/exams/${exam.id}`} key={exam.id} className="group rounded-[1.5rem] border border-border bg-card p-5 shadow-xs transition-all hover:-translate-y-1 hover:shadow-md" data-testid={`card-exam-${exam.id}`}><div className="flex items-start justify-between"><span className="grid size-11 place-items-center rounded-xl bg-accent/15 text-accent"><FileText className="size-5" /></span><span className="rounded-full bg-[hsl(var(--chart-3))]/10 px-2.5 py-1 text-[11px] font-bold text-[hsl(var(--chart-3))]">متاح</span></div><h2 className="mt-6 font-extrabold">{exam.title}</h2><p className="mt-2 line-clamp-2 text-sm leading-7 text-muted-foreground">{exam.description || 'امتحان قصير لقياس استيعابك.'}</p><div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground"><span className="flex items-center gap-1"><Clock3 className="size-3.5" />{exam.duration_minutes || 30} دقيقة</span><span className="font-bold text-accent group-hover:text-foreground">ابدأ <ChevronLeft className="mr-1 inline size-3" /></span></div></Link>)}</div>}</div>; }

function ExamDetail() { const { id } = useParams<{ id: string }>(); const exam = useRows<Exam>('exams', { id }); const questions = useRows<Question>('questions', { exam_id: id }); const [answers, setAnswers] = useState<Record<string, string>>({}); const [submitted, setSubmitted] = useState(false); const [user, setUser] = useState<User | null>(null); useEffect(() => { supabase.auth.getUser().then((r) => setUser(r.data.user)); }, []); const score = useMemo(() => questions.rows.reduce((total, q) => total + (answers[q.id] === q.correct_answer ? 1 : 0), 0), [answers, questions.rows]); const submit = async () => { if (!user || !id) return; await supabase.from('exam_attempts').insert({ user_id: user.id, exam_id: id, score, total: questions.rows.length, percentage: questions.rows.length ? Math.round((score / questions.rows.length) * 100) : 0, answers }); setSubmitted(true); }; const current = exam.rows[0]; return <div className="mx-auto max-w-[900px]"><Link href="/exams" className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-muted-foreground" data-testid="link-back-exams"><ArrowLeft className="size-4" />كل الامتحانات</Link><div className="mb-7"><p className="mb-2 text-xs font-bold tracking-[.16em] text-accent">محاولة جديدة</p><h1 className="text-3xl font-extrabold">{current?.title || 'الامتحان'}</h1><p className="mt-2 text-sm text-muted-foreground">{current?.description || 'اقرأ السؤال بهدوء واختار إجابتك.'}</p></div>{questions.loading || exam.loading ? <div className="space-y-4"><Skeleton className="h-48" /><Skeleton className="h-48" /></div> : questions.error ? <ErrorState retry={questions.retry} /> : questions.rows.length === 0 ? <EmptyState icon={FileText} title="الأسئلة قيد التجهيز" text="لم يتم إضافة أسئلة لهذا الامتحان بعد." /> : submitted ? <div className="rounded-[1.75rem] bg-primary p-8 text-center text-primary-foreground"><span className="mx-auto grid size-20 place-items-center rounded-full bg-secondary text-3xl font-extrabold text-secondary-foreground">{Math.round((score / questions.rows.length) * 100)}%</span><h2 className="mt-6 text-2xl font-extrabold">خلصت المحاولة</h2><p className="mt-2 text-primary-foreground/60">جاوبت صح على {score} من {questions.rows.length} أسئلة.</p><Link href="/exams" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-secondary px-5 py-3 text-sm font-bold text-secondary-foreground" data-testid="link-result-exams">ارجع للامتحانات <ArrowLeft className="size-4" /></Link></div> : <div className="space-y-4">{questions.rows.map((question, index) => <div className="rounded-[1.5rem] border border-border bg-card p-5 shadow-xs sm:p-7" key={question.id} data-testid={`question-${question.id}`}><div className="mb-5 flex items-start gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted font-mono text-xs font-bold">{String(index + 1).padStart(2, '0')}</span><h2 className="pt-1 text-base font-bold leading-7">{question.question_text}</h2></div><div className="grid gap-2 sm:grid-cols-2">{(question.options || []).map((option) => <button key={option} onClick={() => setAnswers((previous) => ({ ...previous, [question.id]: option }))} className={`rounded-xl border px-4 py-3 text-right text-sm transition-colors ${answers[question.id] === option ? 'border-accent bg-accent/10 font-bold text-accent' : 'border-border bg-background hover:border-accent/50'}`} data-testid={`button-answer-${question.id}-${option}`}>{option}</button>)}</div></div>)}<button onClick={submit} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 text-sm font-extrabold text-primary-foreground shadow-sm hover:opacity-90" data-testid="button-submit-exam"><CheckCircle2 className="size-5" />تسليم الامتحان وتصحيح الإجابات</button></div>}</div>; }

function Camps() { const data = useRows<Camp>('camps', { is_open: true }); return <div className="mx-auto max-w-[1380px]"><SectionHeading eyebrow="ذاكر مع المجموعة" title="معسكرات المذاكرة" text="التزام بسيط وسط ناس شبهك بيعمل فرق كبير." /><div className="mb-8 rounded-[1.75rem] bg-accent p-6 text-accent-foreground sm:p-8"><div className="flex flex-wrap items-center justify-between gap-5"><div><span className="text-xs font-bold tracking-[.16em]">جلسات مركزة</span><h2 className="mt-2 text-2xl font-extrabold">اختار معسكر وخلّي للمذاكرة موعد</h2><p className="mt-2 max-w-xl text-sm leading-7 opacity-75">تابع تقدمك، وارجع للمحتوى في أي وقت.</p></div><GraduationCap className="size-16 opacity-30" /></div></div>{data.loading ? <div className="grid gap-4 sm:grid-cols-2"><Skeleton className="h-48" /><Skeleton className="h-48" /></div> : data.error ? <ErrorState retry={data.retry} /> : data.rows.length === 0 ? <EmptyState icon={GraduationCap} title="المعسكرات هتبدأ قريباً" text="لسه مفيش معسكرات مفتوحة للتسجيل. راقب الصفحة باستمرار." /> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{data.rows.map((camp) => <Link href={`/camps/${camp.id}`} key={camp.id} className="group rounded-[1.5rem] border border-border bg-card p-5 shadow-xs hover:-translate-y-1 hover:shadow-md" data-testid={`card-camp-${camp.id}`}><div className="flex items-start justify-between"><span className="grid size-11 place-items-center rounded-xl bg-secondary text-secondary-foreground"><GraduationCap className="size-5" /></span><span className="rounded-full bg-[hsl(var(--chart-3))]/10 px-2.5 py-1 text-[11px] font-bold text-[hsl(var(--chart-3))]">مفتوح</span></div><h2 className="mt-6 font-extrabold">{camp.title}</h2><p className="mt-2 line-clamp-2 text-sm leading-7 text-muted-foreground">{camp.description || 'معسكر مذاكرة منظم.'}</p><span className="mt-5 block text-xs font-bold text-accent">اعرف التفاصيل <ChevronLeft className="mr-1 inline size-3" /></span></Link>)}</div>}</div>; }

function CampDetail() { const { id } = useParams<{ id: string }>(); const camp = useRows<Camp>('camps', { id }).rows[0]; const [user, setUser] = useState<User | null>(null); const [joined, setJoined] = useState(false); useEffect(() => { supabase.auth.getUser().then((r) => setUser(r.data.user)); }, []); const join = async () => { if (!user || !id) return; const result = await supabase.from('camp_enrollments').insert({ user_id: user.id, camp_id: id, progress: 0 }); if (!result.error) setJoined(true); }; return <div className="mx-auto max-w-[900px]"><Link href="/camps" className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-muted-foreground" data-testid="link-back-camps"><ArrowLeft className="size-4" />كل المعسكرات</Link><div className="rounded-[1.75rem] bg-primary p-7 text-primary-foreground sm:p-10"><span className="inline-flex rounded-xl bg-secondary px-3 py-1.5 text-xs font-bold text-secondary-foreground">معسكر مفتوح</span><h1 className="mt-6 text-3xl font-extrabold">{camp?.title || 'تفاصيل المعسكر'}</h1><p className="mt-3 max-w-2xl leading-8 text-primary-foreground/65">{camp?.description || 'انضم للمعسكر وابدأ خطة مذاكرة واضحة.'}</p><button onClick={join} disabled={joined} className="mt-8 inline-flex items-center gap-2 rounded-xl bg-secondary px-5 py-3 text-sm font-extrabold text-secondary-foreground disabled:opacity-60" data-testid="button-join-camp">{joined ? <><Check className="size-4" />تم التسجيل</> : <><Plus className="size-4" />سجّل في المعسكر</>}</button></div></div>; }

function TodoPage({ user }: { user: User }) { const data = useRows<Task>('tasks', { user_id: user.id }); const [title, setTitle] = useState(''); const add = async (e: FormEvent) => { e.preventDefault(); if (!title.trim()) return; await supabase.from<Task>('tasks').insert({ user_id: user.id, title: title.trim(), completed: false }); setTitle(''); data.retry(); }; const toggle = async (task: Task) => { await supabase.from<Task>('tasks').update({ completed: !task.completed }, { id: task.id }); data.retry(); }; const remove = async (task: Task) => { await supabase.from<Task>('tasks').remove({ id: task.id }); data.retry(); }; return <div className="mx-auto max-w-[900px]"><SectionHeading eyebrow="تنظيم اليوم" title="المهام" text="اكتبها، خلّصها، وشوف نفسك بتتحرك." /><form onSubmit={add} className="mb-6 flex gap-2 rounded-2xl border border-border bg-card p-3 shadow-xs"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: مراجعة الوحدة الأولى في الفيزياء" className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none" data-testid="input-task" /><button className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground" data-testid="button-add-task"><Plus className="size-4" />إضافة</button></form>{data.loading ? <div className="space-y-3"><Skeleton className="h-16" /><Skeleton className="h-16" /></div> : data.error ? <ErrorState retry={data.retry} /> : data.rows.length === 0 ? <EmptyState icon={CheckCircle2} title="قائمة هادية" text="مفيش مهام لسه. أضف خطوة واحدة صغيرة وابدأ." /> : <div className="space-y-2">{data.rows.map((task) => <div key={task.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs" data-testid={`row-task-${task.id}`}><button onClick={() => toggle(task)} className={`grid size-6 place-items-center rounded-lg border ${task.completed ? 'border-[hsl(var(--chart-3))] bg-[hsl(var(--chart-3))] text-white' : 'border-border'}`} data-testid={`button-toggle-task-page-${task.id}`}>{task.completed && <Check className="size-3.5" />}</button><span className={`flex-1 text-sm ${task.completed ? 'text-muted-foreground line-through' : 'font-semibold'}`}>{task.title}</span><button onClick={() => remove(task)} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" data-testid={`button-delete-task-${task.id}`}><X className="size-4" /></button></div>)}</div>}</div>; }

function SimpleResourcePage({ type, title, icon: Icon, table, user }: { type: string; title: string; icon: typeof Target; table: string; user: User }) {
  const data = useRows<Record<string, unknown>>(table, { user_id: user.id });
  const canCreate = table === 'study_schedule' || table === 'study_plans';
  const isSchedule = table === 'study_schedule';
  const [draft, setDraft] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState('0');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [formOpen, setFormOpen] = useState(false);
  const [actionError, setActionError] = useState<Error | null>(null);
  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    const values = isSchedule
      ? { user_id: user.id, title: draft.trim(), day_of_week: Number(dayOfWeek), start_time: startTime, end_time: endTime, completed: false }
      : { user_id: user.id, title: draft.trim() };
    const result = await supabase.from(table).insert(values);
    if (result.error) setActionError(result.error);
    else { setActionError(null); setDraft(''); setFormOpen(false); data.retry(); }
  };
  return <div className="mx-auto max-w-[1100px]"><SectionHeading eyebrow="مساحتي" title={title} text={`كل ما يخص ${type} في مكان واحد.`} action={canCreate ? <button className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-bold text-primary-foreground" onClick={() => setFormOpen((open) => !open)} data-testid={`button-add-${table}`}><Plus className="size-4" />إضافة جديد</button> : undefined} />{actionError && <div className="mb-5"><ErrorState error={actionError} /></div>}{formOpen && <form onSubmit={add} className="mb-5 space-y-3 rounded-2xl border border-border bg-card p-3 shadow-xs"><input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`اكتب ${type} جديد...`} className="w-full bg-transparent px-2 text-sm outline-none" data-testid={`input-add-${table}`} />{isSchedule && <div className="grid gap-3 sm:grid-cols-3"><label className="block"><span className="mb-1 block text-xs font-bold text-muted-foreground">اليوم</span><select value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" data-testid="select-schedule-day"><option value="0">الأحد</option><option value="1">الإثنين</option><option value="2">الثلاثاء</option><option value="3">الأربعاء</option><option value="4">الخميس</option><option value="5">الجمعة</option><option value="6">السبت</option></select></label><label className="block"><span className="mb-1 block text-xs font-bold text-muted-foreground">من</span><input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" data-testid="input-schedule-start" /></label><label className="block"><span className="mb-1 block text-xs font-bold text-muted-foreground">إلى</span><input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" data-testid="input-schedule-end" /></label></div>}<div className="flex justify-end"><button className="rounded-xl bg-secondary px-4 py-2 text-xs font-bold text-secondary-foreground" data-testid={`button-save-${table}`}>حفظ</button></div></form>}{data.loading ? <div className="space-y-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></div> : data.error ? <ErrorState retry={data.retry} error={data.error} /> : data.rows.length === 0 ? <EmptyState icon={Icon} title={`مفيش ${type} لسه`} text="لما تضيف محتوى هتلاقيه هنا مرتب وواضح." /> : <div className="grid gap-3">{data.rows.map((row, index) => <div className="rounded-2xl border border-border bg-card p-5 shadow-xs" key={String(row.id || index)}><div className="flex items-center gap-4"><span className="grid size-10 place-items-center rounded-xl bg-muted text-accent"><Icon className="size-5" /></span><div><h2 className="font-bold">{String(row.title || row.name || 'عنصر')}</h2><p className="mt-1 text-xs text-muted-foreground">{isSchedule ? `${String(row.start_time || '')} - ${String(row.end_time || '')}` : String(row.description || 'تفاصيل العنصر')}</p></div></div></div>)}</div>}</div>;
}

function Achievements({ user }: { user: User }) { const data = useRows<Record<string, unknown>>('user_badges', { user_id: user.id }); return <div className="mx-auto max-w-[1100px]"><SectionHeading eyebrow="احتفل بالتقدم" title="الإنجازات" text="كل خطوة تستاهل تتسجل." /><div className="mb-7 rounded-[1.75rem] border border-border bg-card p-6 shadow-xs"><div className="flex items-center gap-4"><span className="grid size-14 place-items-center rounded-2xl bg-secondary text-secondary-foreground"><Trophy className="size-7" /></span><div><p className="text-sm text-muted-foreground">الإنجازات المكتسبة</p><p className="mt-1 text-3xl font-extrabold">{data.rows.length}</p></div></div></div>{data.loading ? <Skeleton className="h-56" /> : data.error ? <ErrorState retry={data.retry} /> : data.rows.length === 0 ? <EmptyState icon={Trophy} title="أول إنجاز قريب" text="ابدأ درس أو حل امتحان، وأول شارة هتكون بداية المجموعة." /> : <div className="grid gap-4 sm:grid-cols-2">{data.rows.map((row, index) => <div className="rounded-2xl border border-border bg-card p-5" key={String(row.id || index)}><Award className="size-7 text-secondary-foreground" /><h2 className="mt-5 font-bold">{String(row.title || 'إنجاز')}</h2><p className="mt-1 text-sm text-muted-foreground">{String(row.description || 'إنجاز دراسي')}</p></div>)}</div>}</div>; }

function communityAuthor(value: unknown) {
  const author = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return { name: String(author.full_name || 'طالب من المجتمع'), isSupervisor: author.role === 'supervisor' };
}

function CommunityPostCard({ post, user, canModerate, onRemoved }: { post: Record<string, unknown>; user: User; canModerate: boolean; onRemoved?: () => void }) {
  const comments = useRows<Record<string, unknown>>('community_comments', { post_id: String(post.id) }, '*, author:profiles(full_name,role)');
  const author = communityAuthor(post.author);
  const [content, setContent] = useState('');
  const addComment = async (event: FormEvent) => {
    event.preventDefault();
    if (!content.trim()) return;
    const result = await supabase.from('community_comments').insert({ post_id: post.id, user_id: user.id, content: content.trim() });
    if (!result.error) { setContent(''); comments.retry(); }
  };
  const removePost = async () => {
    const result = await supabase.from('community_posts').remove({ id: String(post.id) });
    if (!result.error) onRemoved?.();
  };
  return <article className="rounded-2xl border border-border bg-card p-5 shadow-xs" data-testid={`post-${post.id}`}>
    <div className="flex items-start gap-3">
      <span className="grid size-10 place-items-center rounded-xl bg-accent/15 text-sm font-bold text-accent">ط</span>
       <div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><div><b className="text-sm">{author.name}</b>{author.isSupervisor && <span className="mr-2 rounded-full bg-secondary/20 px-2 py-1 text-[10px] font-bold text-secondary-foreground">مشرف</span>}<p className="text-[11px] text-muted-foreground">منشور جديد</p></div>{canModerate && <button type="button" onClick={removePost} className="rounded-lg px-2 py-1 text-xs text-destructive hover:bg-destructive/10" data-testid={`button-delete-post-${post.id}`}>حذف</button>}</div>
      <p className="mt-4 text-sm leading-8">{String(post.content || '')}</p>
       <div className="mt-5 border-t border-border pt-4"><p className="mb-3 text-xs font-bold text-muted-foreground">التعليقات ({comments.rows.length})</p>{comments.rows.length > 0 && <div className="mb-4 space-y-2">{comments.rows.map((comment, index) => { const commentAuthor = communityAuthor(comment.author); return <div key={String(comment.id || index)} className="rounded-xl bg-muted/55 px-3 py-2.5 text-sm"><b className="ml-2 text-xs">{commentAuthor.name}</b>{commentAuthor.isSupervisor && <span className="ml-2 rounded-full bg-secondary/20 px-2 py-0.5 text-[10px] font-bold text-secondary-foreground">مشرف</span>}{String(comment.content || '')}</div>; })}</div>}<form onSubmit={addComment} className="flex gap-2"><input value={content} onChange={(event) => setContent(event.target.value)} placeholder="اكتب تعليقًا..." className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2.5 text-xs outline-none focus:ring-2 focus:ring-ring" data-testid={`input-comment-${post.id}`} /><button className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground" data-testid={`button-comment-${post.id}`}>تعليق</button></form></div></div>
    </div>
  </article>;
}

function Community({ user }: { user: User }) {
  const settings = useRows<Record<string, unknown>>('community_settings');
  const posts = useRows<Record<string, unknown>>('community_posts', {}, '*, author:profiles(full_name,role)');
  const messages = useRows<Record<string, unknown>>('community_messages', {}, '*, author:profiles(full_name,role)');
  const profile = useRows<Profile>('profiles', { id: user.id });
  const [content, setContent] = useState('');
  const [actionError, setActionError] = useState<Error | null>(null);
  const setting = settings.rows[0];
  const mode = setting?.mode === 'chat' ? 'chat' : 'posts';
  const locked = setting?.is_locked === true || setting?.is_locked === 'true';
  const isSupervisor = profile.rows[0]?.role === 'supervisor';
  const canWrite = isSupervisor || !locked;
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (mode === 'chat') messages.retry();
      else posts.retry();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [mode]);
  const changeMode = async (nextMode: 'posts' | 'chat') => {
    if (!isSupervisor || !setting?.id) return;
    const result = await supabase.from('community_settings').update({ mode: nextMode }, { id: String(setting.id) });
    if (result.error) setActionError(result.error);
    else { setActionError(null); settings.retry(); }
  };
  const toggleLock = async () => {
    if (!isSupervisor || !setting?.id) return;
    const result = await supabase.from('community_settings').update({ is_locked: !locked }, { id: String(setting.id) });
    if (result.error) setActionError(result.error);
    else { setActionError(null); settings.retry(); }
  };
  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!content.trim() || !canWrite || Boolean(settings.error)) return;
    const table = mode === 'chat' ? 'community_messages' : 'community_posts';
    const result = await supabase.from(table).insert({ user_id: user.id, content: content.trim() });
    if (!result.error) { setContent(''); (mode === 'chat' ? messages : posts).retry(); }
  };
  const currentData = mode === 'chat' ? messages : posts;
  return <div className="mx-auto max-w-[900px]">
    <SectionHeading eyebrow="مع بعض نعرف أكتر" title="مجتمع الطلاب" text="المشرف يختار شكل المجتمع: منشورات بتعليقات أو جروب محادثة مباشر." />
    {settings.error && <ErrorState retry={settings.retry} error={settings.error} />}
    {actionError && <div className="mb-5"><ErrorState error={actionError} /></div>}
    <div className="mb-6 rounded-2xl border border-border bg-card p-3 shadow-xs">
      <div className="grid gap-2 sm:grid-cols-2">
         <button type="button" onClick={() => changeMode('posts')} disabled={!isSupervisor || Boolean(settings.error)} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-right ${mode === 'posts' ? 'bg-primary text-primary-foreground' : 'bg-muted/50'} disabled:cursor-default`} data-testid="button-community-posts"><MessageCircle className="size-5" /><span><b className="block text-sm">منشورات وتعليقات</b><small className="opacity-70">كل طالب ينشر والطلاب يعلّقوا</small></span></button>
         <button type="button" onClick={() => changeMode('chat')} disabled={!isSupervisor || Boolean(settings.error)} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-right ${mode === 'chat' ? 'bg-primary text-primary-foreground' : 'bg-muted/50'} disabled:cursor-default`} data-testid="button-community-chat"><Users className="size-5" /><span><b className="block text-sm">جروب المحادثة</b><small className="opacity-70">رسائل سريعة زي جروب واتساب</small></span></button>
      </div>
       {isSupervisor && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3"><span className="text-xs font-bold text-accent">أنت تتحكم في وضع المجتمع</span><button type="button" onClick={toggleLock} disabled={Boolean(settings.error)} className="rounded-xl border border-border px-3 py-2 text-xs font-bold disabled:opacity-50" data-testid="button-community-lock">{locked ? 'فتح الكتابة للطلاب' : 'قفل الكتابة'}</button></div>}
      {locked && <p className="mt-3 rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-700">المجتمع مقفول مؤقتًا من المشرف.</p>}
    </div>
    <form onSubmit={send} className="mb-6 rounded-2xl border border-border bg-card p-4 shadow-xs"><textarea value={content} onChange={(event) => setContent(event.target.value)} disabled={!canWrite || Boolean(settings.error)} rows={3} placeholder={settings.error ? 'الجداول غير جاهزة بعد' : locked && !isSupervisor ? 'المجتمع مقفول حاليًا' : mode === 'chat' ? 'اكتب رسالة للجروب...' : 'اكتب منشورًا أو سؤالًا...'} className="w-full resize-none bg-transparent text-sm leading-7 outline-none disabled:cursor-not-allowed disabled:opacity-50" data-testid="input-community-message" /><div className="flex justify-end border-t border-border pt-3"><button disabled={!canWrite || Boolean(settings.error)} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50" data-testid="button-send-message"><MessageCircle className="size-4" />{mode === 'chat' ? 'إرسال الرسالة' : 'نشر المشاركة'}</button></div></form>
    {currentData.loading ? <div className="space-y-3"><Skeleton className="h-28" /><Skeleton className="h-28" /></div> : currentData.error ? <ErrorState retry={currentData.retry} error={currentData.error} /> : currentData.rows.length === 0 ? <EmptyState icon={mode === 'chat' ? Users : MessageCircle} title={mode === 'chat' ? 'الجروب لسه هادي' : 'ابدأ أول منشور'} text={mode === 'chat' ? 'اكتب أول رسالة وابدأ الحوار.' : 'اكتب منشورًا، وبعدها الطلاب يقدروا يعلّقوا عليه.'} /> : mode === 'chat' ? <div className="space-y-3">{currentData.rows.map((row, index) => { const author = communityAuthor(row.author); return <article className="rounded-2xl border border-border bg-card p-5 shadow-xs" key={String(row.id || index)}><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-muted text-sm font-bold text-accent">ط</span><div><b className="text-sm">{author.name}</b>{author.isSupervisor && <span className="mr-2 rounded-full bg-secondary/20 px-2 py-1 text-[10px] font-bold text-secondary-foreground">مشرف</span>}<p className="text-[11px] text-muted-foreground">رسالة</p></div></div><p className="mt-4 text-sm leading-8">{String(row.content || '')}</p></article>; })}</div> : <div className="space-y-3">{currentData.rows.map((post, index) => <CommunityPostCard key={String(post.id || index)} post={post} user={user} canModerate={isSupervisor} onRemoved={posts.retry} />)}</div>}
  </div>;
}

function ProfilePage({ user, profile }: { user: User; profile: Profile | null }) { const [name, setName] = useState(profile?.full_name || ''); const [phone, setPhone] = useState(profile?.phone_number || ''); const [status, setStatus] = useState(''); const save = async (e: FormEvent) => { e.preventDefault(); const result = await supabase.from('profiles').update({ full_name: name, phone_number: phone }, { id: user.id }); setStatus(result.error ? result.error.message : 'اتحفظت التغييرات'); }; return <div className="mx-auto max-w-[800px]"><SectionHeading eyebrow="مساحتك الخاصة" title="الملف الشخصي" text="بياناتك الأساسية وتقدمك في مكان واحد." /><div className="rounded-[1.75rem] border border-border bg-card p-6 shadow-xs sm:p-8"><div className="mb-8 flex items-center gap-4 border-b border-border pb-7"><span className="grid size-16 place-items-center rounded-2xl bg-accent text-2xl font-extrabold text-accent-foreground">{(profile?.full_name || 'ط').slice(0, 1)}</span><div><h2 className="text-xl font-extrabold">{profile?.full_name || 'طالب'}</h2><p className="mt-1 text-sm text-muted-foreground">{user.email}</p></div></div><form onSubmit={save} className="space-y-5"><label className="block"><span className="mb-2 block text-sm font-bold">الاسم بالكامل</span><input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring" data-testid="input-profile-name" /></label><label className="block"><span className="mb-2 block text-sm font-bold">رقم الهاتف</span><input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="اختياري" data-testid="input-profile-phone" /></label>{status && <p className="text-sm font-bold text-[hsl(var(--chart-3))]" data-testid="status-profile">{status}</p>}<button className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground" data-testid="button-save-profile">حفظ التغييرات</button></form></div></div>; }

type QuestionDraft = { question_text: string; options: string[]; correct_answer: string; explanation: string | null };
type ContentKind = 'subjects' | 'units' | 'lessons' | 'resources' | 'exams' | 'camps';

function AdminContentManager() {
  const subjects = useRows<Subject>('subjects');
  const units = useRows<Unit>('units');
  const lessons = useRows<Lesson>('lessons');
  const resources = useRows<LessonResource>('lesson_resources');
  const exams = useRows<Exam>('exams');
  const camps = useRows<Camp>('camps');
  const [kind, setKind] = useState<ContentKind>('subjects');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string | boolean>>({ is_published: true, is_open: true, resource_type: 'link', duration_minutes: '30' });
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const collections = { subjects, units, lessons, resources, exams, camps };
  const rows = collections[kind].rows as Array<Record<string, unknown>>;
  const refresh = () => { collections[kind].retry(); if (kind === 'resources') lessons.retry(); };
  const setValue = (key: string, value: string | boolean) => setDraft((previous) => ({ ...previous, [key]: value }));
  const value = (key: string) => String(draft[key] ?? '');
  const reset = () => { setEditingId(null); setDraft({ is_published: true, is_open: true, resource_type: 'link', duration_minutes: '30' }); };
  const edit = (row: Record<string, unknown>) => { setEditingId(String(row.id)); setDraft({ ...row, is_published: row.is_published !== false, is_open: row.is_open !== false }); setStatus(null); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const values: Record<string, unknown> =
      kind === 'subjects' ? { name: value('name').trim(), description: value('description').trim() || null, order_index: Number(value('order_index') || 0) } :
      kind === 'units' ? { subject_id: value('subject_id'), title: value('title').trim(), order_index: Number(value('order_index') || 0) } :
      kind === 'lessons' ? { unit_id: value('unit_id'), title: value('title').trim(), description: value('description').trim() || null, video_url: value('video_url').trim() || null, drive_url: value('drive_url').trim() || null, order_index: Number(value('order_index') || 0), is_published: Boolean(draft.is_published) } :
      kind === 'resources' ? { lesson_id: value('lesson_id'), title: value('title').trim(), resource_type: value('resource_type') || 'link', url: value('url').trim(), description: value('description').trim() || null, order_index: Number(value('order_index') || 0), is_published: Boolean(draft.is_published) } :
      kind === 'exams' ? { subject_id: value('subject_id') || null, title: value('title').trim(), description: value('description').trim() || null, duration_minutes: Number(value('duration_minutes') || 30), is_published: Boolean(draft.is_published) } :
      { subject_id: value('subject_id') || null, title: value('title').trim(), description: value('description').trim() || null, is_open: Boolean(draft.is_open), start_date: value('start_date') || null, end_date: value('end_date') || null };
    const urlValues = [values.video_url, values.drive_url, values.url].filter((item): item is string => typeof item === 'string' && item.length > 0);
    if (urlValues.some((item) => !isSafeHttpUrl(item))) { setStatus({ type: 'error', message: 'استخدم روابط http أو https صحيحة فقط.' }); return; }
    const required = kind === 'subjects' ? Boolean(values.name) : kind === 'units' ? Boolean(values.subject_id && values.title) : kind === 'lessons' ? Boolean(values.unit_id && values.title) : kind === 'resources' ? Boolean(values.lesson_id && values.title && values.url) : Boolean(values.title);
    if (!required) { setStatus({ type: 'error', message: 'اكتب البيانات الأساسية المطلوبة قبل الحفظ.' }); return; }
    const result = editingId ? await supabase.from(kind === 'resources' ? 'lesson_resources' : kind).update(values, { id: editingId }) : await supabase.from(kind === 'resources' ? 'lesson_resources' : kind).insert(values);
    if (result.error) setStatus({ type: 'error', message: dataErrorMessage(result.error) });
    else { setStatus({ type: 'success', message: editingId ? 'تم تحديث المحتوى بنجاح.' : 'تمت إضافة المحتوى بنجاح.' }); reset(); refresh(); }
  };

  const remove = async (row: Record<string, unknown>) => {
    const consequence = kind === 'subjects' ? ' حذف المادة سيحذف وحداتها ودروسها التابعة.' : kind === 'units' ? ' حذف الوحدة سيحذف دروسها وروابطها التابعة.' : '';
    if (!window.confirm(`حذف العنصر نهائيًا؟${consequence}`)) return;
    const table = kind === 'resources' ? 'lesson_resources' : kind;
    const result = await supabase.from(table).remove({ id: String(row.id) });
    if (result.error) setStatus({ type: 'error', message: dataErrorMessage(result.error) });
    else { setStatus({ type: 'success', message: 'تم حذف العنصر.' }); refresh(); }
  };

  const title = { subjects: 'المواد', units: 'الوحدات', lessons: 'الدروس', resources: 'الروابط والملفات والفيديوهات', exams: 'الامتحانات', camps: 'المعسكرات' }[kind];
  const formTitle = editingId ? `تعديل ${title}` : `إضافة ${title}`;
  const inputClass = 'w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring';
  const subjectOptions = subjects.rows as Array<Record<string, unknown>>;
  const unitOptions = units.rows as Array<Record<string, unknown>>;
  const lessonOptions = lessons.rows as Array<Record<string, unknown>>;

  return <div className="mx-auto max-w-[1380px]">
    <SectionHeading eyebrow="صلاحيات كاملة" title="إدارة المحتوى" text="أضف وعدّل واحذف المواد والوحدات والدروس والروابط من لوحة واحدة." />
    <div className="mb-6 flex flex-wrap gap-2">{(Object.keys(title ? { subjects: 1, units: 1, lessons: 1, resources: 1, exams: 1, camps: 1 } : {}) as ContentKind[]).map((item) => <button key={item} onClick={() => { setKind(item); reset(); setStatus(null); }} className={`rounded-xl px-3 py-2 text-xs font-bold ${kind === item ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-muted-foreground'}`}>{({ subjects: 'المواد', units: 'الوحدات', lessons: 'الدروس', resources: 'روابط وملفات', exams: 'الامتحانات', camps: 'المعسكرات' }[item])}</button>)}</div>
    {status && <div className={`mb-5 rounded-2xl border p-4 text-sm font-bold ${status.type === 'success' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700' : 'border-destructive/20 bg-destructive/10 text-destructive'}`} role="status">{status.message}</div>}
    <form onSubmit={save} className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-xs">
      <div className="mb-4 flex items-center justify-between gap-3"><h2 className="font-extrabold">{formTitle}</h2>{editingId && <button type="button" onClick={reset} className="text-xs font-bold text-muted-foreground">إلغاء التعديل</button>}</div>
      <div className="grid gap-3 sm:grid-cols-2">
        {kind === 'subjects' && <><label className="sm:col-span-2"><span className="mb-1 block text-xs font-bold">اسم المادة</span><input className={inputClass} value={value('name')} onChange={(e) => setValue('name', e.target.value)} /></label><label className="sm:col-span-2"><span className="mb-1 block text-xs font-bold">الوصف</span><textarea className={inputClass} value={value('description')} onChange={(e) => setValue('description', e.target.value)} rows={2} /></label></>}
        {kind === 'units' && <><label><span className="mb-1 block text-xs font-bold">المادة</span><select className={inputClass} value={value('subject_id')} onChange={(e) => setValue('subject_id', e.target.value)}><option value="">اختر المادة</option>{subjectOptions.map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.name)}</option>)}</select></label><label><span className="mb-1 block text-xs font-bold">اسم الوحدة</span><input className={inputClass} value={value('title')} onChange={(e) => setValue('title', e.target.value)} /></label></>}
        {kind === 'lessons' && <><label><span className="mb-1 block text-xs font-bold">الوحدة</span><select className={inputClass} value={value('unit_id')} onChange={(e) => setValue('unit_id', e.target.value)}><option value="">اختر الوحدة</option>{unitOptions.map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.title)}</option>)}</select></label><label><span className="mb-1 block text-xs font-bold">عنوان الدرس</span><input className={inputClass} value={value('title')} onChange={(e) => setValue('title', e.target.value)} /></label><label className="sm:col-span-2"><span className="mb-1 block text-xs font-bold">وصف الدرس</span><textarea className={inputClass} value={value('description')} onChange={(e) => setValue('description', e.target.value)} rows={2} /></label><label><span className="mb-1 block text-xs font-bold">رابط الفيديو الرئيسي</span><input type="url" className={inputClass} value={value('video_url')} onChange={(e) => setValue('video_url', e.target.value)} placeholder="https://..." /></label><label><span className="mb-1 block text-xs font-bold">رابط الملف الرئيسي</span><input type="url" className={inputClass} value={value('drive_url')} onChange={(e) => setValue('drive_url', e.target.value)} placeholder="https://..." /></label></>}
        {kind === 'resources' && <><label><span className="mb-1 block text-xs font-bold">الدرس</span><select className={inputClass} value={value('lesson_id')} onChange={(e) => setValue('lesson_id', e.target.value)}><option value="">اختر الدرس</option>{lessonOptions.map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.title)}</option>)}</select></label><label><span className="mb-1 block text-xs font-bold">نوع المورد</span><select className={inputClass} value={value('resource_type') || 'link'} onChange={(e) => setValue('resource_type', e.target.value)}><option value="video">فيديو</option><option value="file">ملف</option><option value="link">رابط خارجي</option></select></label><label><span className="mb-1 block text-xs font-bold">اسم الرابط</span><input className={inputClass} value={value('title')} onChange={(e) => setValue('title', e.target.value)} placeholder="شرح إضافي / PDF / فيديو" /></label><label><span className="mb-1 block text-xs font-bold">الرابط</span><input type="url" className={inputClass} value={value('url')} onChange={(e) => setValue('url', e.target.value)} placeholder="https://..." /></label><label className="sm:col-span-2"><span className="mb-1 block text-xs font-bold">وصف مختصر</span><input className={inputClass} value={value('description')} onChange={(e) => setValue('description', e.target.value)} /></label></>}
        {(kind === 'exams' || kind === 'camps') && <><label><span className="mb-1 block text-xs font-bold">العنوان</span><input className={inputClass} value={value('title')} onChange={(e) => setValue('title', e.target.value)} /></label><label><span className="mb-1 block text-xs font-bold">المادة (اختياري)</span><select className={inputClass} value={value('subject_id')} onChange={(e) => setValue('subject_id', e.target.value)}><option value="">بدون مادة</option>{subjectOptions.map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.name)}</option>)}</select></label><label className="sm:col-span-2"><span className="mb-1 block text-xs font-bold">الوصف</span><textarea className={inputClass} value={value('description')} onChange={(e) => setValue('description', e.target.value)} rows={2} /></label></>}
        {kind === 'exams' && <label><span className="mb-1 block text-xs font-bold">المدة بالدقائق</span><input type="number" min="1" className={inputClass} value={value('duration_minutes') || '30'} onChange={(e) => setValue('duration_minutes', e.target.value)} /></label>}
        {kind === 'camps' && <><label><span className="mb-1 block text-xs font-bold">يبدأ في</span><input type="date" className={inputClass} value={value('start_date')} onChange={(e) => setValue('start_date', e.target.value)} /></label><label><span className="mb-1 block text-xs font-bold">ينتهي في</span><input type="date" className={inputClass} value={value('end_date')} onChange={(e) => setValue('end_date', e.target.value)} /></label></>}
      </div>
      {(['lessons', 'resources', 'exams'].includes(kind) || kind === 'camps') && <label className="mt-4 flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={kind === 'camps' ? Boolean(draft.is_open) : Boolean(draft.is_published)} onChange={(e) => setValue(kind === 'camps' ? 'is_open' : 'is_published', e.target.checked)} />{kind === 'camps' ? 'المعسكر مفتوح للتسجيل' : 'منشور للطلاب'}</label>}
      <div className="mt-5 flex justify-end"><button className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-extrabold text-primary-foreground"><Save className="size-4" />{editingId ? 'حفظ التعديل' : 'إضافة المحتوى'}</button></div>
    </form>
    <div className="rounded-2xl border border-border bg-card p-4 shadow-xs"><div className="mb-4 flex items-center justify-between"><h2 className="font-extrabold">{title}</h2><span className="text-xs text-muted-foreground">{rows.length} عنصر</span></div>{rows.length === 0 ? <EmptyState icon={Library} title={`لا توجد ${title} بعد`} text="أضف أول عنصر من النموذج الموجود بالأعلى." /> : <div className="space-y-2">{rows.map((row, index) => <div key={String(row.id || index)} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/50 p-3"><div className="min-w-0"><p className="truncate text-sm font-bold">{String(row.name || row.title || 'عنصر')}</p><p className="mt-1 text-xs text-muted-foreground">{kind === 'resources' ? `${String(row.resource_type)} · ${String(row.url)}` : kind === 'lessons' ? `${String(row.video_url || row.drive_url ? 'به روابط' : 'بدون روابط')}` : kind === 'exams' ? `${row.is_published === false ? 'مسودة' : 'منشور'}` : kind === 'camps' ? `${row.is_open === false ? 'مغلق' : 'مفتوح'}` : ''}</p></div><div className="flex items-center gap-2"><button onClick={() => edit(row)} className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-xs font-bold text-accent"><Edit3 className="size-3.5" />تعديل</button><button onClick={() => remove(row)} className="inline-flex items-center gap-1 rounded-lg border border-destructive/20 px-3 py-2 text-xs font-bold text-destructive"><Trash2 className="size-3.5" />حذف</button></div></div>)}</div>}</div>
  </div>;
}

function AdminUsersManager() {
  const profiles = useRows<Profile>('profiles');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const filtered = profiles.rows.filter((profile) => `${profile.full_name || ''} ${profile.id}`.toLowerCase().includes(search.toLowerCase()));
  const save = async (profile: Profile, patch: Partial<Profile>) => {
    const result = await supabase.from<Profile>('profiles').update(patch, { id: profile.id });
    setStatus(result.error ? dataErrorMessage(result.error) : 'تم تحديث صلاحيات الحساب.');
    if (!result.error) profiles.retry();
  };
  return <div className="mx-auto max-w-[1100px]"><SectionHeading eyebrow="إدارة الوصول" title="المستخدمون والصلاحيات" text="غيّر دور الحساب أو أوقفه بدون لمس بيانات التقدم." /><div className="mb-5 flex items-center gap-2 rounded-2xl border border-border bg-card p-3 shadow-xs"><Search className="size-4 text-muted-foreground" /><input value={search} onChange={(e) => setSearch(e.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="ابحث بالاسم أو المعرّف..." /></div>{status && <p className="mb-4 rounded-xl bg-emerald-500/10 p-3 text-sm font-bold text-emerald-700">{status}</p>}{profiles.loading ? <Skeleton className="h-64" /> : profiles.error ? <ErrorState retry={profiles.retry} /> : <div className="space-y-2">{filtered.map((profile) => <div key={profile.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 shadow-xs"><div><p className="font-bold">{profile.full_name || 'بدون اسم'}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{profile.id}</p></div><div className="flex flex-wrap items-center gap-3"><select value={profile.role} onChange={(e) => save(profile, { role: e.target.value as Profile['role'] })} className="rounded-lg border border-input bg-background px-3 py-2 text-xs font-bold"><option value="student">طالب</option><option value="supervisor">مشرف</option></select><label className="flex items-center gap-2 text-xs font-bold text-destructive"><input type="checkbox" checked={Boolean(profile.is_banned)} onChange={(e) => save(profile, { is_banned: e.target.checked })} />حظر الحساب</label></div></div>)}</div>}</div>;
}

function Admin({ section = 'overview' }: { section?: string }) {
  if (section === 'content') return <AdminContentManager />;
  if (section === 'users') return <AdminUsersManager />;
  return <AdminDashboard section={section} />;
}

function AdminDashboard({ section = 'overview' }: { section?: string }) {
  const [location] = useLocation();
  const profiles = useRows<Record<string, unknown>>('profiles');
  const subjects = useRows<Record<string, unknown>>('subjects');
  const exams = useRows<Record<string, unknown>>('exams');
  const camps = useRows<Record<string, unknown>>('camps');
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateExamId, setGenerateExamId] = useState('');
  const [generateCount, setGenerateCount] = useState('5');
  const [generateLevel, setGenerateLevel] = useState('الصف الأول الثانوي');
  const [generating, setGenerating] = useState(false);
  const [generateStatus, setGenerateStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const generateMutation = useGenerateQuestions();
  const selected = section === 'users' ? profiles : section === 'subjects' ? subjects : section === 'exams' ? exams : section === 'camps' ? camps : null;
  const label = section === 'users' ? 'المستخدمين' : section === 'subjects' ? 'المواد' : section === 'exams' ? 'الامتحانات' : section === 'camps' ? 'المعسكرات' : 'نظرة عامة';
  const getSubjectName = (exam: Record<string, unknown>) => {
    const subject = subjects.rows.find((item) => item.id === exam.subject_id);
    return String(subject?.name || 'مادة غير محددة');
  };
  const openGenerator = () => {
    setGenerateStatus(null);
    if (!generateExamId && exams.rows[0]?.id) setGenerateExamId(String(exams.rows[0].id));
    setGenerateOpen(true);
  };
  const generateQuestions = async (event: FormEvent) => {
    event.preventDefault();
    if (!generateExamId) {
      setGenerateStatus({ type: 'error', message: 'اختر امتحاناً أولاً.' });
      return;
    }
    setGenerating(true);
    setGenerateStatus(null);
    try {
      const response = await generateMutation.mutateAsync({
        data: { exam_id: generateExamId, count: Number(generateCount), level: generateLevel },
      });
      setGenerateOpen(false);
      setGenerateStatus({ type: 'success', message: `تم توليد وحفظ ${response.inserted_count} أسئلة بنجاح.` });
    } catch (error) {
      const apiError = error as { data?: { error?: string } };
      setGenerateStatus({ type: 'error', message: apiError.data?.error || (error instanceof Error ? error.message : 'تعذر توليد الأسئلة.') });
    } finally {
      setGenerating(false);
    }
  };
  return <div className="mx-auto max-w-[1380px]">
    <SectionHeading eyebrow="مساحة المشرف" title="لوحة التحكم" text="تابع المحتوى والمجتمع من مكان واحد." />
     <div className="mb-7 flex flex-wrap gap-2">{[['/admin', 'نظرة عامة'], ['/admin/content', 'إدارة المحتوى'], ['/admin/users', 'المستخدمين'], ['/admin/subjects', 'المواد'], ['/admin/exams', 'الامتحانات'], ['/admin/camps', 'المعسكرات']].map(([href, text]) => <Link className={`rounded-xl px-4 py-2.5 text-sm font-bold ${location === href ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-muted-foreground'}`} href={href} key={href} data-testid={`link-admin-${text}`}>{text}</Link>)}</div>
    {generateStatus && section === 'exams' && <div className={`mb-5 rounded-2xl border p-4 text-sm font-bold ${generateStatus.type === 'success' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700' : 'border-destructive/20 bg-destructive/10 text-destructive'}`} role="status" data-testid={`status-generate-${generateStatus.type}`}>{generateStatus.message}</div>}
    {section === 'overview' ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard icon={Users} label="المستخدمين" value={profiles.rows.length} /><StatCard icon={BookOpen} label="المواد" value={subjects.rows.length} accent="bg-accent text-accent-foreground" /><StatCard icon={FileText} label="الامتحانات" value={exams.rows.length} /><StatCard icon={GraduationCap} label="المعسكرات" value={camps.rows.length} accent="bg-[hsl(var(--chart-3))] text-white" /></div> : selected?.loading ? <Skeleton className="h-64" /> : selected?.error ? <ErrorState retry={selected.retry} /> : selected && selected.rows.length === 0 ? <EmptyState icon={Shield} title={`لا توجد ${label} بعد`} text="ستظهر البيانات هنا عند توفرها في قاعدة البيانات." /> : <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-extrabold">{label}</h2>{section === 'exams' && <button onClick={openGenerator} disabled={exams.rows.length === 0} className="inline-flex items-center gap-2 rounded-xl bg-secondary px-4 py-2.5 text-sm font-bold text-secondary-foreground disabled:cursor-not-allowed disabled:opacity-50" data-testid="button-open-question-generator"><Sparkles className="size-4" />توليد أسئلة بالذكاء الاصطناعي</button>}</div>
      <div className="space-y-2">{selected?.rows.map((row, index) => <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/50 p-3" key={String(row.id || index)} data-testid={`row-admin-${section}-${row.id || index}`}><div><span className="block text-sm font-bold">{String(row.full_name || row.title || row.name || 'عنصر')}</span>{section === 'exams' && <span className="mt-1 block text-xs text-muted-foreground">{getSubjectName(row)}</span>}</div>{section === 'exams' ? <Link href={`/admin/exams/${String(row.id)}/questions`} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-bold text-accent hover:bg-accent/10" data-testid={`link-review-exam-questions-${row.id}`}>مراجعة الأسئلة<ChevronLeft className="size-3.5" /></Link> : <span className="font-mono text-xs text-muted-foreground">{String(row.role || row.id || '').slice(0, 14)}</span>}</div>)}</div>
    </div>}
    {generateOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-primary/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="question-generator-title" data-testid="dialog-question-generator">
      <div className="w-full max-w-lg rounded-[1.75rem] border border-border bg-card p-6 shadow-2xl sm:p-8">
        <div className="mb-6 flex items-start justify-between gap-4"><div><p className="mb-2 text-xs font-bold tracking-[.16em] text-accent">مساعد المشرف</p><h2 id="question-generator-title" className="text-2xl font-extrabold">توليد أسئلة بالذكاء الاصطناعي</h2><p className="mt-2 text-sm leading-7 text-muted-foreground">سيتم إنشاء الأسئلة وحفظها مباشرة داخل الامتحان المختار.</p></div><button onClick={() => setGenerateOpen(false)} className="rounded-xl p-2 text-muted-foreground hover:bg-muted" aria-label="إغلاق" data-testid="button-close-question-generator"><X className="size-5" /></button></div>
        <form onSubmit={generateQuestions} className="space-y-5">
          <label className="block"><span className="mb-2 block text-sm font-bold">الامتحان</span><select value={generateExamId} onChange={(event) => setGenerateExamId(event.target.value)} className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring" required data-testid="select-question-exam"><option value="">اختر الامتحان</option>{exams.rows.map((exam) => <option key={String(exam.id)} value={String(exam.id)}>{String(exam.title || 'امتحان')} — {getSubjectName(exam)}</option>)}</select></label>
          <div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="mb-2 block text-sm font-bold">عدد الأسئلة</span><input type="number" min="1" max="20" value={generateCount} onChange={(event) => setGenerateCount(event.target.value)} className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring" required data-testid="input-question-count" /></label><label className="block"><span className="mb-2 block text-sm font-bold">المستوى الدراسي</span><input value={generateLevel} onChange={(event) => setGenerateLevel(event.target.value)} maxLength={80} className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring" required data-testid="input-question-level" /></label></div>
          <button type="submit" disabled={generating} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-extrabold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60" data-testid="button-generate-questions">{generating ? 'جاري التوليد والحفظ...' : 'توليد وحفظ الأسئلة'}</button>
        </form>
      </div>
    </div>}
  </div>;
}

function AdminGate({ profile, section, review = false }: { profile: Profile | null; section?: string; review?: boolean }) {
  if (profile?.role !== 'supervisor') return <div className="mx-auto max-w-[700px]"><EmptyState icon={Shield} title="المساحة دي للمشرفين فقط" text="حسابك الدراسي لا يملك صلاحية الوصول إلى لوحة التحكم." action={<Link href="/dashboard" className="inline-flex rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground" data-testid="link-admin-denied-home">العودة للرئيسية</Link>} /></div>;
  if (review) return <AdminQuestionReview />;
  return <Admin section={section} />;
}

function Verify() { const { code } = useParams<{ code: string }>(); const data = useRows<Record<string, unknown>>('certificates', { reference_code: code }); return <div className="flex min-h-[100dvh] items-center justify-center bg-primary px-4 py-10 text-primary-foreground"><div className="w-full max-w-lg rounded-[2rem] border border-primary-foreground/10 bg-primary-foreground/[.07] p-7 text-center backdrop-blur-xl sm:p-10">{data.loading ? <Skeleton className="h-56" /> : data.error ? <ErrorState retry={data.retry} /> : data.rows.length === 0 ? <><span className="mx-auto grid size-16 place-items-center rounded-2xl bg-destructive/20 text-destructive"><X className="size-8" /></span><h1 className="mt-6 text-2xl font-extrabold">الشهادة غير موجودة</h1><p className="mt-2 text-sm text-primary-foreground/55">راجع كود التحقق وتأكد أنه مكتوب بشكل صحيح.</p></> : <><span className="mx-auto grid size-16 place-items-center rounded-2xl bg-secondary text-secondary-foreground"><FileBadge className="size-8" /></span><p className="mt-6 text-xs font-bold tracking-[.16em] text-secondary">شهادة معتمدة من أكاديمية JO</p><h1 className="mt-3 text-2xl font-extrabold">{String(data.rows[0].title || 'شهادة إنجاز')}</h1><p className="mt-3 text-sm text-primary-foreground/60">كود التحقق: <span className="font-mono text-secondary">{code}</span></p><div className="mt-7 grid grid-cols-2 gap-3 text-right"><div className="rounded-xl bg-primary-foreground/10 p-3"><small className="block text-xs text-primary-foreground/50">النتيجة</small><b>{String(data.rows[0].score || '—')}</b></div><div className="rounded-xl bg-primary-foreground/10 p-3"><small className="block text-xs text-primary-foreground/50">تاريخ الإصدار</small><b>{String(data.rows[0].issued_at || '—')}</b></div></div></>}</div></div>; }

function NotFoundPage() { return <div className="grid min-h-[100dvh] place-items-center bg-background p-6 text-center"><div><span className="font-mono text-6xl font-bold text-accent">404</span><h1 className="mt-5 text-2xl font-extrabold">الصفحة مش موجودة</h1><p className="mt-2 text-sm text-muted-foreground">ممكن الرابط اتغير أو الصفحة لسه بتتجهز.</p><Link href="/dashboard" className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground" data-testid="link-404-home">العودة للرئيسية</Link></div></div>; }

function AuthenticatedRouter({ user, profile }: { user: User; profile: Profile | null }) {
  return <AppShell user={user} profile={profile}><Switch><Route path="/dashboard"><Dashboard profile={profile} user={user} /></Route><Route path="/subjects"><Subjects /></Route><Route path="/subjects/:id"><SubjectDetail /></Route><Route path="/exams"><Exams /></Route><Route path="/exams/:id"><ExamDetail /></Route><Route path="/camps"><Camps /></Route><Route path="/camps/:id"><CampDetail /></Route><Route path="/schedule"><SimpleResourcePage type="الجدول" title="الجدول الدراسي" icon={CalendarDays} table="study_schedule" user={user} /></Route><Route path="/todo"><TodoPage user={user} /></Route><Route path="/mistakes"><SimpleResourcePage type="الأخطاء" title="مراجعة الأخطاء" icon={RotateCcw} table="mistakes" user={user} /></Route><Route path="/achievements"><Achievements user={user} /></Route><Route path="/certificates"><SimpleResourcePage type="الشهادات" title="الشهادات" icon={FileBadge} table="certificates" user={user} /></Route><Route path="/community"><Community user={user} /></Route><Route path="/plans"><SimpleResourcePage type="الخطط" title="خطتي الدراسية" icon={Target} table="study_plans" user={user} /></Route><Route path="/profile"><ProfilePage user={user} profile={profile} /></Route><Route path="/admin/content"><AdminGate profile={profile} section="content" /></Route><Route path="/admin/users"><AdminGate profile={profile} section="users" /></Route><Route path="/admin/subjects"><AdminGate profile={profile} section="subjects" /></Route><Route path="/admin/exams/:id/questions"><AdminGate profile={profile} review /></Route><Route path="/admin/exams"><AdminGate profile={profile} section="exams" /></Route><Route path="/admin/camps"><AdminGate profile={profile} section="camps" /></Route><Route path="/admin"><AdminGate profile={profile} /></Route><Route path="/"><Dashboard profile={profile} user={user} /></Route><Route component={NotFoundPage} /></Switch></AppShell>;
}

function Router() { const [location] = useLocation(); const [user, setUser] = useState<User | null>(null); const [profile, setProfile] = useState<Profile | null>(null); const [loading, setLoading] = useState(true); useEffect(() => { let active = true; supabase.auth.getUser().then(async ({ data }) => { if (!active) return; setUser(data.user); if (data.user) { const result = await supabase.from<Profile>('profiles').select('*', { id: data.user.id }); setProfile(result.data?.[0] || null); } setLoading(false); }); return () => { active = false; }; }, [location]); if (location.startsWith('/verify/')) return <Verify />; if (loading) return <div className="grid min-h-[100dvh] place-items-center bg-background"><div className="w-72 space-y-3"><Skeleton className="h-12" /><Skeleton className="h-24" /><Skeleton className="h-12" /></div></div>; return user ? <AuthenticatedRouter user={user} profile={profile} /> : <Switch><Route path="/"><Landing /></Route><Route component={Landing} /></Switch>; }

function App() { return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><ErrorBoundary><Router /></ErrorBoundary></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>; }

export default App;

function AdminQuestionReview() {
  const { id = '' } = useParams<{ id: string }>();
  const review = useGetExamQuestions(id);
  const updateMutation = useUpdateExamQuestion();
  const deleteMutation = useDeleteExamQuestion();
  const reorderMutation = useReorderExamQuestions();
  const [drafts, setDrafts] = useState<Record<string, QuestionDraft>>({});
  const [orderIds, setOrderIds] = useState<string[]>([]);
  const [savingQuestionId, setSavingQuestionId] = useState<string | null>(null);
  const [deletingQuestionId, setDeletingQuestionId] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!review.data) return;
    const ordered = [...review.data.questions].sort((a, b) => a.order_index - b.order_index);
    setOrderIds(ordered.map((question) => question.id));
    setDrafts(Object.fromEntries(ordered.map((question) => [question.id, {
      question_text: question.question_text,
      options: [...question.options],
      correct_answer: question.correct_answer,
      explanation: question.explanation,
    }])));
  }, [review.data]);

  const questionById = new Map((review.data?.questions || []).map((question) => [question.id, question]));
  const orderedQuestions = orderIds
    .map((questionId) => questionById.get(questionId))
    .filter((question): question is NonNullable<typeof question> => Boolean(question));

  const updateDraft = (questionId: string, patch: Partial<QuestionDraft>) => {
    setDrafts((previous) => ({ ...previous, [questionId]: { ...previous[questionId], ...patch } }));
  };

  const saveQuestion = async (questionId: string) => {
    const draft = drafts[questionId];
    if (!draft || !draft.question_text.trim() || draft.options.some((option) => !option.trim()) || new Set(draft.options.map((option) => option.trim())).size !== draft.options.length || !draft.options.includes(draft.correct_answer)) {
      setStatus({ type: 'error', message: 'تأكد من كتابة السؤال والخيارات الأربعة واختيار إجابة صحيحة مختلفة.' });
      return;
    }
    setSavingQuestionId(questionId);
    setStatus(null);
    try {
      await updateMutation.mutateAsync({
        examId: id,
        questionId,
        data: {
          question_text: draft.question_text.trim(),
          options: draft.options.map((option) => option.trim()),
          correct_answer: draft.correct_answer,
          explanation: draft.explanation?.trim() || null,
        },
      });
      await queryClient.invalidateQueries({ queryKey: review.queryKey });
      setStatus({ type: 'success', message: 'تم حفظ تعديلات السؤال.' });
    } catch (error) {
      setStatus({ type: 'error', message: getApiErrorMessage(error, 'تعذر حفظ تعديلات السؤال.') });
    } finally {
      setSavingQuestionId(null);
    }
  };

  const deleteQuestion = async (questionId: string) => {
    if (!window.confirm('هل تريد حذف هذا السؤال نهائياً؟')) return;
    setDeletingQuestionId(questionId);
    setStatus(null);
    try {
      await deleteMutation.mutateAsync({ examId: id, questionId });
      setOrderIds((previous) => previous.filter((item) => item !== questionId));
      setDrafts((previous) => {
        const next = { ...previous };
        delete next[questionId];
        return next;
      });
      await queryClient.invalidateQueries({ queryKey: review.queryKey });
      setStatus({ type: 'success', message: 'تم حذف السؤال.' });
    } catch (error) {
      setStatus({ type: 'error', message: getApiErrorMessage(error, 'تعذر حذف السؤال.') });
    } finally {
      setDeletingQuestionId(null);
    }
  };

  const moveQuestion = (questionId: string, direction: -1 | 1) => {
    setOrderIds((previous) => {
      const currentIndex = previous.indexOf(questionId);
      const targetIndex = currentIndex + direction;
      if (currentIndex < 0 || targetIndex < 0 || targetIndex >= previous.length) return previous;
      const next = [...previous];
      [next[currentIndex], next[targetIndex]] = [next[targetIndex], next[currentIndex]];
      return next;
    });
    setStatus(null);
  };

  const saveOrder = async () => {
    if (!orderIds.length) return;
    setSavingOrder(true);
    setStatus(null);
    try {
      const response = await reorderMutation.mutateAsync({ examId: id, data: { question_ids: orderIds } });
      setOrderIds(response.questions.sort((a, b) => a.order_index - b.order_index).map((question) => question.id));
      await queryClient.invalidateQueries({ queryKey: review.queryKey });
      setStatus({ type: 'success', message: 'تم حفظ ترتيب الأسئلة.' });
    } catch (error) {
      setStatus({ type: 'error', message: getApiErrorMessage(error, 'تعذر حفظ ترتيب الأسئلة.') });
    } finally {
      setSavingOrder(false);
    }
  };

  if (review.isLoading) return <div className="mx-auto max-w-[1000px] space-y-4"><Skeleton className="h-32" /><Skeleton className="h-96" /><Skeleton className="h-96" /></div>;
  if (review.isError || !review.data) return <div className="mx-auto max-w-[900px]"><SectionHeading eyebrow="مساحة المشرف" title="مراجعة أسئلة الامتحان" /><ErrorState retry={() => review.refetch()} /></div>;

  return <div className="mx-auto max-w-[1000px]">
    <SectionHeading
      eyebrow="مساحة المشرف"
      title={review.data.exam_title}
      text={`${review.data.subject_name || 'مادة غير محددة'} · راجع الصياغة والإجابات قبل نشر الامتحان.`}
      action={<Link href="/admin/exams" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-bold text-muted-foreground hover:text-foreground" data-testid="link-back-admin-exams"><ArrowLeft className="size-4" />العودة للامتحانات</Link>}
    />
    <div className="mb-6 grid gap-3 sm:grid-cols-3">
      <div className="rounded-2xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">إجمالي الأسئلة</p><p className="mt-2 text-2xl font-extrabold" data-testid="text-review-question-count">{orderedQuestions.length}</p></div>
      <div className="rounded-2xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">حالة الامتحان</p><p className="mt-2 text-sm font-extrabold">{'مسودة للمراجعة'}</p></div>
      <button onClick={saveOrder} disabled={savingOrder || !orderIds.length} className="flex items-center justify-center gap-2 rounded-2xl bg-secondary p-4 text-sm font-extrabold text-secondary-foreground disabled:cursor-not-allowed disabled:opacity-50" data-testid="button-save-question-order"><Save className="size-4" />{savingOrder ? 'جاري حفظ الترتيب...' : 'حفظ ترتيب الأسئلة'}</button>
    </div>
    {status && <div className={`mb-5 rounded-2xl border p-4 text-sm font-bold ${status.type === 'success' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700' : 'border-destructive/20 bg-destructive/10 text-destructive'}`} role="status" data-testid={`status-question-review-${status.type}`}>{status.message}</div>}
    {orderedQuestions.length === 0 ? <EmptyState icon={FileText} title="لا توجد أسئلة للمراجعة" text="ولّد أسئلة من صفحة الامتحانات، وستظهر هنا لتعديلها قبل النشر." /> : <div className="space-y-5">
      {orderedQuestions.map((question, index) => {
        const draft = drafts[question.id];
        if (!draft) return null;
        return <article className="rounded-[1.5rem] border border-border bg-card p-5 shadow-xs sm:p-7" key={question.id} data-testid={`card-review-question-${question.id}`}>
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
            <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-primary font-mono text-sm font-bold text-primary-foreground" data-testid={`text-review-question-number-${question.id}`}>{String(index + 1).padStart(2, '0')}</span><div><p className="text-xs font-bold text-accent">سؤال {index + 1}</p><p className="mt-1 text-xs text-muted-foreground">عدّل ثم احفظ هذا السؤال بشكل مستقل</p></div></div>
            <div className="flex items-center gap-2">
              <GripVertical className="hidden size-4 text-muted-foreground/50 sm:block" aria-hidden="true" />
              <button onClick={() => moveQuestion(question.id, -1)} disabled={index === 0} className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30" aria-label="تحريك السؤال لأعلى" data-testid={`button-move-question-up-${question.id}`}><ArrowUp className="size-4" /></button>
              <button onClick={() => moveQuestion(question.id, 1)} disabled={index === orderedQuestions.length - 1} className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30" aria-label="تحريك السؤال لأسفل" data-testid={`button-move-question-down-${question.id}`}><ArrowDown className="size-4" /></button>
              <button onClick={() => deleteQuestion(question.id)} disabled={deletingQuestionId === question.id} className="rounded-lg border border-destructive/20 p-2 text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50" aria-label="حذف السؤال" data-testid={`button-delete-question-${question.id}`}><Trash2 className="size-4" /></button>
            </div>
          </div>
          <div className="space-y-5">
            <label className="block"><span className="mb-2 block text-sm font-bold">نص السؤال</span><textarea value={draft.question_text} onChange={(event) => updateDraft(question.id, { question_text: event.target.value })} rows={3} maxLength={2000} className="w-full resize-y rounded-xl border border-input bg-background px-4 py-3 text-sm leading-7 outline-none focus:ring-2 focus:ring-ring" data-testid={`textarea-question-text-${question.id}`} /></label>
            <div><span className="mb-2 block text-sm font-bold">الخيارات والإجابة الصحيحة</span><div className="grid gap-3 sm:grid-cols-2">{draft.options.map((option, optionIndex) => <label className="flex items-center gap-3 rounded-xl border border-input bg-background px-3 py-2.5 focus-within:ring-2 focus-within:ring-ring" key={`${question.id}-option-${optionIndex}`}><input type="radio" name={`correct-answer-${question.id}`} checked={draft.correct_answer === option} onChange={() => updateDraft(question.id, { correct_answer: option })} className="size-4 accent-[hsl(var(--accent))]" aria-label={`اختيار الإجابة الصحيحة ${optionIndex + 1}`} data-testid={`radio-correct-answer-${question.id}-${optionIndex}`} /><input value={option} onChange={(event) => { const options = [...draft.options]; const wasCorrect = draft.correct_answer === option; options[optionIndex] = event.target.value; updateDraft(question.id, { options, correct_answer: wasCorrect ? event.target.value : draft.correct_answer }); }} maxLength={500} className="min-w-0 flex-1 bg-transparent text-sm outline-none" aria-label={`الخيار ${optionIndex + 1}`} data-testid={`input-question-option-${question.id}-${optionIndex}`} /></label>)}</div><p className="mt-2 text-xs text-muted-foreground">اختر الدائرة بجانب الإجابة الصحيحة.</p></div>
            <label className="block"><span className="mb-2 block text-sm font-bold">التفسير <span className="font-normal text-muted-foreground">(اختياري)</span></span><textarea value={draft.explanation || ''} onChange={(event) => updateDraft(question.id, { explanation: event.target.value })} rows={3} maxLength={2000} placeholder="أضف تفسيراً يساعد الطالب على فهم الإجابة..." className="w-full resize-y rounded-xl border border-input bg-background px-4 py-3 text-sm leading-7 outline-none focus:ring-2 focus:ring-ring" data-testid={`textarea-question-explanation-${question.id}`} /></label>
            <div className="flex justify-end border-t border-border pt-5"><button onClick={() => saveQuestion(question.id)} disabled={savingQuestionId === question.id} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-extrabold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60" data-testid={`button-save-question-${question.id}`}><Save className="size-4" />{savingQuestionId === question.id ? 'جاري الحفظ...' : 'حفظ تعديلات السؤال'}</button></div>
          </div>
        </article>;
      })}
    </div>}
  </div>;
}

function getApiErrorMessage(error: unknown, fallback: string) {
  const apiError = error as { data?: { error?: string } };
  return apiError.data?.error || (error instanceof Error ? error.message : fallback);
}
