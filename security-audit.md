# Security Audit - Polling App (Next.js + Supabase)

Date: 2025-09-04
Scope: Full audit of authentication, authorization, data access, and business logic. Focus on misuse scenarios, exposed data, and unauthorized actions.

## Executive Summary
Multiple authorization gaps exist in server actions and route components that allow authenticated or unauthenticated users to access or modify resources they do not own. Middleware provides coarse login gating but does not enforce ownership. Supabase anon key is used server-side; absence of RLS review implies security depends entirely on application checks. Several client components expose actions without server-side revalidation. Logging of user/session data on clients introduces privacy risk.

High-risk issues:
- Missing ownership checks on `deletePoll` and `getPollById` enable IDOR and mass deletion.
- Voting endpoint allows unauthenticated, unlimited voting (no rate limiting, dedupe, or per-user constraint).
- Edit pages fetch polls by ID without ownership verification, enabling unauthorized editing attempts.
- Middleware and client layouts rely on client redirects for access control.

Medium/low-risk issues:
- Client console logging of auth state and user data.
- Sharing component constructs share URLs client-side; no tokenization or visibility controls.
- Potential CSRF for form-based server actions if Supabase auth cookies are ambient and no CSRF token is used.

The impact includes unauthorized read/write of polls, vote manipulation, and potential account enumeration via error messages.

---

## Findings and Impact

### 1) Missing authorization in deletePoll (IDOR → unauthorized deletion)
- Location: `app/lib/actions/poll-actions.ts` (`deletePoll`)
- Code:
```startLine:endLine:app/lib/actions/poll-actions.ts
98:143
```
- Issue: `deletePoll(id)` deletes by `id` only, with no verification that the current user owns the poll. Any authenticated user (and possibly unauthenticated if RLS allows) could delete arbitrary polls by ID.
- Potential impact: Attackers can delete other users' polls en masse. Data loss and denial-of-service for victims.
- Exploit path: Obtain/guess a poll `id` and trigger `deletePoll(id)` from the client or by crafting a POST to the server action.
- Recommended fix: Require session, fetch poll owner, or constrain delete query: `.eq("user_id", user.id)`. Enforce Supabase RLS with owner check.

### 2) getPollById exposes any poll to any user (IDOR → unauthorized read)
- Location: `app/lib/actions/poll-actions.ts` (`getPollById`)
- Code:
```startLine:endLine:app/lib/actions/poll-actions.ts
63:74
```
- Issue: Reads by `id` with `.single()` and returns the entire record to any caller; no authentication or ownership check. Used by edit page.
- Potential impact: Confidential poll content (question/options/metadata) is exposed to other users. If private polls existed, they would be readable by ID.
- Exploit path: Call `getPollById` with another user's poll ID; SSR page will render the data.
- Recommended fix: Require authenticated user, add `.eq("user_id", user.id)`; or split into public vs private read endpoints with explicit access rules. Enforce RLS.

### 3) Edit page lacks server-side authorization enforcement
- Location: `app/(dashboard)/polls/[id]/edit/page.tsx`
- Code:
```startLine:endLine:app/(dashboard)/polls/[id]/edit/page.tsx
6:17
```
- Issue: Fetches poll via `getPollById` and renders edit form if found. No verification that the logged-in user owns the poll. Client-side `EditPollForm` relies on `updatePoll` to enforce ownership, but the page itself leaks the poll to unauthorized users if `getPollById` is permissive.
- Potential impact: Unauthorized read of poll data and potential UX for unauthorized edit attempts.
- Recommended fix: Server component must verify ownership before rendering. If unauthorized, return `notFound()` or redirect.

### 4) Voting endpoint allows unauthenticated, unlimited voting
- Location: `app/lib/actions/poll-actions.ts` (`submitVote`)
- Code:
```startLine:endLine:app/lib/actions/poll-actions.ts
76:96
```
- Issue: Login is optional (commented). No deduplication per user/session/IP, no rate limiting, and no validation that `option_index` exists in the poll.
- Potential impact: Vote inflation, poll manipulation, denial of integrity of results.
- Exploit path: Script repeated calls to `submitVote(pollId, optionIndex)`.
- Recommended fix: Enforce authenticated votes or implement per-poll, per-user unique constraint; validate `option_index` bounds; add server-side throttling or external rate limit; enforce RLS on `votes` table.

### 5) Client-side delete button triggers insecure server action
- Location: `app/(dashboard)/polls/PollActions.tsx`
- Code:
```startLine:endLine:app/(dashboard)/polls/PollActions.tsx
19:53
```
- Issue: Client UI checks `user.id === poll.user_id` before showing Delete, but the server action lacks enforcement. Attackers can call the action directly.
- Potential impact: Coupled with Finding 1, enables arbitrary deletions.
- Recommended fix: Same as Finding 1; do not rely on client checks.

### 6) Middleware and layouts rely on client redirects; server-side is permissive
- Location: `middleware.ts`, `lib/supabase/middleware.ts`, `app/(dashboard)/layout.tsx`, `app/(auth)/layout.tsx`
- Code refs:
```startLine:endLine:lib/supabase/middleware.ts
30:45
```
```startLine:endLine:app/(dashboard)/layout.tsx
18:43
```
```startLine:endLine:app/(auth)/layout.tsx
7:23
```
- Issue: Middleware redirects unauthenticated users away from most routes, but server actions do their own checks inconsistently. Dashboard/auth layouts enforce redirects client-side after hydration, which may briefly flash content and is not authoritative.
- Potential impact: Inconsistent protection; potential SSR leaks if server actions/pages don’t properly gate data.
- Recommended fix: Enforce access checks in server actions and server components. Keep middleware for session refresh, not as sole gate.

### 7) Supabase anon key used server-side; RLS posture unknown
- Location: `lib/supabase/server.ts`, `lib/supabase/middleware.ts`
- Issue: Uses `NEXT_PUBLIC_SUPABASE_ANON_KEY` server-side. This is standard, but if RLS is disabled or policies are lax, application checks are the only barrier. No RLS policies are shown in repo.
- Potential impact: If RLS is off, malicious clients can bypass app and write directly via Supabase client if exposed. Even with RLS on, misconfigured policies could allow cross-tenant reads/writes.
- Recommended fix: Ensure RLS enabled with strict owner-based policies for `polls` and `votes`. For server-side elevated operations, use service role key only within server and never client.

### 8) Client logs expose user data in the browser console
- Location: `app/lib/context/auth-context.tsx`
- Code:
```startLine:endLine:app/lib/context/auth-context.tsx
25:47
```
```startLine:endLine:app/lib/context/auth-context.tsx
59:64
```
- Issue: Logs auth user/session details to console.
- Potential impact: Sensitive metadata revealed to shared device users or browser extensions; aids attackers during recon.
- Recommended fix: Remove console logging in production.

### 9) Share component exposes raw poll IDs, no access tokenization
- Location: `app/(dashboard)/polls/vulnerable-share.tsx`
- Issue: Share URL is `/{base}/polls/{pollId}` without signed tokens, no visibility flags. If polls are intended private to owner, sharing leaks ID and enables unauthenticated access to the poll page if server renders it.
- Potential impact: Unauthorized access if public page exists or if server action serves data without checks (see Finding 2 and 3).
- Recommended fix: Use signed, expiring share tokens stored in DB; gate reads by token or ownership; optionally add QR code with token.

### 10) Possible CSRF on server actions
- Location: Forms using `action={serverAction}` (e.g., create/update)
- Issue: Next.js server actions are susceptible to CSRF when authenticated via cookies and actions are not protected by CSRF tokens or same-site strict policies.
- Potential impact: Cross-site form POST could create or modify polls for an authenticated victim.
- Recommended fix: Enable `SameSite=Lax/Strict` for auth cookies (Supabase uses `lax` by default), and add CSRF token validation to mutating server actions. Alternatively, require re-auth or use double submit cookie strategy.

### 11) Edit page mock poll (in `[id]/page.tsx`) — risk of desync with real security
- Location: `app/(dashboard)/polls/[id]/page.tsx`
- Issue: Uses mock data and links to edit/delete without real authorization. When wired to real data, ensure it does not expose unauthorized actions.
- Potential impact: If later connected to real actions without server-side checks, same IDOR risks propagate.
- Recommended fix: When implementing, adopt ownership gating and safe rendering.

---

## Recommendations

- Implement server-side ownership checks everywhere:
  - `deletePoll`: require user, `.eq('user_id', user.id)`.
  - `getPollById`: return only if owned or intended public; otherwise 404.
  - `updatePoll`: already checks owner; keep it.
- Enforce Supabase RLS:
  - `polls`: owner can CRUD; other users read only if poll `is_public` or `shared_token` matches.
  - `votes`: users can insert one vote per `(poll_id, user_id)`; anonymous votes only if allowed and rate-limited; validate option bounds via database constraint if possible.
- Add database constraints:
  - Unique constraint on `votes(poll_id, user_id)` or `(poll_id, session_id)` for anonymous.
  - Check constraint to ensure `option_index` is within array bounds.
- Harden server actions against CSRF:
  - Add CSRF token to forms, validate in actions.
  - Ensure cookies are `SameSite=Lax` or `Strict` and secure.
- Remove client console logs of sensitive data.
- Tokenize sharing:
  - Generate `share_token` (UUID) and `expires_at`. Share URL like `/s/{token}`; server validates token and returns limited, public-safe data.
- Rate limiting:
  - Introduce middleware or edge rate limiting on vote submits; or implement counters per IP/user.
- Error handling hygiene:
  - Avoid echoing raw Supabase error messages to users; map to generic user-safe messages.

---

## Verification Checklist
- Next.js App Router and Server Components used for data fetch: Yes, but ensure secure gating in server actions.
- Server Actions used for mutations: Yes.
- Supabase client used for DB interactions: Yes.
- shadcn/ui components for UI: Yes.
- Secrets from env: Yes; no hardcoded keys observed.

---

## Prioritized Fix Plan
1. Patch `deletePoll` and `getPollById` with ownership checks; deploy.
2. Add RLS policies for `polls` and `votes`; add unique and check constraints.
3. Enforce authenticated voting or introduce per-user/session uniqueness and rate limiting.
4. Remove client console logs; add CSRF token validation for mutating server actions.
5. Implement tokenized sharing with optional expiry.

---

## Remediation Implemented (This Audit)

- Ownership enforcement added in server actions
  - `getPollById(id)` now requires an authenticated user and filters by `.eq('user_id', user.id)` to prevent IDOR reads.
  - `deletePoll(id)` now requires an authenticated user and deletes with `.eq('user_id', user.id)` to prevent IDOR deletes.

- Voting hardened
  - Voting now requires authentication.
  - Validates `optionIndex` bounds by fetching poll options before insert.
  - Prevents duplicate votes by checking for an existing `(poll_id, user_id)` record before inserting.

- CSRF protection added to mutating actions
  - Middleware sets a `csrfToken` cookie (SameSite=Lax, Secure).
  - Forms append the `csrfToken` hidden field; server actions validate double-submit token.

- Client-side sensitive logging removed
  - Removed console logging of user/session data in `auth-context`.

- Unsafe sharing disabled pending tokenized flow
  - `vulnerable-share.tsx` no longer exposes raw poll URLs; messaging indicates tokenized sharing will replace it.

Note: These changes are application-level safeguards. You must still enable and enforce database-level protections (RLS and constraints) to achieve defense-in-depth.

---

## Environment Configuration Issue Observed at Runtime

During a local run, the app failed due to missing Supabase environment variables, which can break auth and session management:

- Errors:
  - `Your project's URL and Key are required to create a Supabase client!`
  - Emitted from `lib/supabase/middleware.ts` and `lib/supabase/client.ts`.

- Required environment variables (add to `.env.local`):
  - `NEXT_PUBLIC_SUPABASE_URL="https://YOUR-PROJECT-ref.supabase.co"`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY="YOUR-ANON-PUBLIC-KEY"`

- Steps to remedy:
  1) In Supabase Dashboard → Settings → API, copy the Project URL and anon public key.
  2) Create `.env.local` at the repo root with the two variables above.
  3) Restart the dev server so Next.js picks up new env vars.
  4) Proceed to configure RLS policies as outlined below.

Security note: Never commit keys; `.env.local` should be gitignored by default in Next.js apps.

---

## Database Hardening To-Do (Follow-up Required)

Implement the following in Supabase (Security › Policies and SQL editor):

- Enable RLS on `polls` and `votes`.
- `polls` policies:
  - Insert: `auth.uid() = user_id`.
  - Select: owner-only, or allow public via `is_public = true` or valid `share_token`.
  - Update/Delete: `auth.uid() = user_id`.

- `votes` policies:
  - Insert: `auth.uid() = user_id` (if authenticated voting) and deny duplicates.
  - Optionally allow anonymous with strict rate-limiting and per-session dedupe.

- Constraints:
  - Unique: `unique (poll_id, user_id)` for authenticated voting.
  - Check: ensure `option_index` is within valid bounds (or enforce in application/DB trigger).

---

## Residual Risk and Next Steps

- Tokenized sharing: Introduce a `share_token` and optional `expires_at`; serve limited, public-safe views via `/s/{token}`.
- Rate limiting: Add per-IP/user rate limits (Edge runtime/middleware or external WAF) for voting endpoints.
- Error messaging: Sanitize database error messages before returning to the client.
- Monitoring: Add audit logs for poll modification and vote insertion events.

