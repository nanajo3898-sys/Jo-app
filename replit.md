# JO Academy

منصة مذاكرة عربية لإدارة المواد والدروس والامتحانات والمعسكرات ومتابعة تقدم الطلاب.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Supabase is connected through the Replit connector and proxied by `/api/supabase`; direct `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` values remain supported as an optional local-development override.
- Before using the supervisor content area, run `supabase/community-modes.sql` and `supabase/academy-admin.sql` in Supabase SQL Editor.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/jo-academy/src/App.tsx` — student experience and supervisor dashboard.
- `artifacts/jo-academy/src/types/jo.ts` — frontend content types.
- `artifacts/api-server/src/routes/admin.ts` — authenticated exam-question APIs.
- `artifacts/api-server/src/routes/supabase.ts` — server-side Supabase connector proxy used when browser credentials are not configured.
- `supabase/academy-admin.sql` — content tables, link/file/video resources, indexes, RLS, and supervisor policies.
- `supabase/community-modes.sql` — community tables and community moderation policies.

## Architecture decisions

- Supabase remains the source of truth for users and learning content; the browser uses the existing lightweight REST client.
- Supervisor CRUD is protected twice: the UI hides the area for students, and Supabase RLS requires `public.is_supervisor()` for every content write.
- Lesson links are stored in `lesson_resources` with a typed resource kind (`video`, `file`, or `link`) so a lesson can have multiple attachments without changing the lesson row.
- Only published lessons, exams, camps, and resources are visible to students; supervisors can still review drafts.
- The connected database currently contains the subject catalog and supervisor profiles; units, lessons, resources, exams, and camps are ready but empty until curriculum content is entered.

## Product

- Students can browse subjects, units, lessons, exams, camps, community content, tasks, schedules, achievements, and certificates.
- Supervisors can manage users, subjects, units, lessons, lesson resources, exams, camps, and exam questions from the dashboard.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
