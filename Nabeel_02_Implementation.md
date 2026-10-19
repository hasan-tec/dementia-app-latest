# Nabeel — implementation playbook for the existing Vite app

Revised 18 October 2026 · Planning only · Baseline `d918557`

## 1. Start from the restored branch

Keep React, TypeScript, Vite, React Router, and existing styling. No Next.js migration.

In PowerShell inside the Desktop repository:

```powershell
git status --short
git fetch origin
git rev-parse origin/main
git log -3 origin/main --oneline
```

Stop if fetch fails or the remote hash differs unexpectedly. Expected baseline is `d918557357281e989bfd83132b081640194d2ab7`, unless a newer shared integration commit was agreed. Preserve uncommitted work, then create an isolated worktree:

```powershell
git worktree add -b feature/nabeel-auth-guide ../dementia-nabeel origin/main
Set-Location ../dementia-nabeel
```

Install from the lockfile, run the existing build/lint, and record baseline failures. Do not merge the removed October commits. This planning session did not run application tests or configure Supabase.

## 2. Proposed structure

```text
src/
  App.tsx
  main.tsx
  lib/
    supabase.ts
    contracts.ts
    safe-return-path.ts
  context/
    AuthContext.tsx
  components/
    auth/ProtectedRoute.tsx
    auth/AuthForm.tsx
    Layout/Sidebar.tsx
    tour/TourProvider.tsx
    tour/TourCallout.tsx
    tour/TourSpotlight.tsx
    tour/TourControls.tsx
  pages/
    Login.tsx
    Signup.tsx
    AuthCallback.tsx
    ForgotPassword.tsx
    ResetPassword.tsx
    Guide.tsx
    Dashboard.tsx
    People.tsx
    PersonDetail.tsx
    ARViewer.tsx
  features/onboarding/
    steps.ts
    events.ts
    progress.ts
  services/
    api.ts
    faceDetection.ts
    gemini.ts
  db/legacy-database.ts
supabase/                         # Muzzamil owns server functions/migrations
vite.config.ts                    # retain
.env.example
```

Preserve existing CSS imports. Do not relocate the application into October's `frontend/` folder. Add compatible stable `@supabase/supabase-js`, commit the lockfile, and document versions. Coordinate shared types with Muzzamil.

## 3. Supabase setup and environment

Use one Supabase project for auth, data, and private photos. Users enter their own email/password in our UI. Enable email/password; do not enable Google/social providers or anonymous sign-in.

| Setting | Where it belongs |
| --- | --- |
| `VITE_SUPABASE_URL` | Public browser environment |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Public browser environment; permissions depend on RLS |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Supabase Edge Function secrets, Muzzamil owns |
| Supabase privileged/secret key | Server-only if narrowly needed; never `VITE_*` |

Use current publishable-key setup supported by the SDK/project. An existing project may use its supported anon-key equivalent; agree the exact variable names rather than mixing them. Commit `.env.example` containing names and descriptions only. Vite-prefixed values appear in browser assets and cannot hold secrets.

Configure Site URL and explicit local/preview/production confirmation/recovery redirect URLs. Configure and test a production email sender. Use provider password policy and rate limits; frontend validation is not sufficient enforcement. Never create an application password column.

## 4. Auth client and state

Create one browser Supabase client in `lib/supabase.ts` using supported session persistence/refresh settings. Do not store a separate copy of credentials or tokens. Never accept a browser user ID as proof of identity on the backend.

AuthProvider should expose auth status, current user, sign-in/sign-up/sign-out actions, and recovery context. On startup restore the session and subscribe to auth changes; unsubscribe on unmount. Keep the event callback lightweight and handle follow-up async work outside it. Ignore stale requests after logout/account change.

Three startup states: `initializing`, `signedOut`, `signedIn`. ProtectedRoute renders loading while initializing, redirects signed-out visitors to `/login`, and otherwise renders the existing route outlet. Preserve a return path only from an internal allowlist. Reject external, protocol-relative, and auth callback loops.

Do not describe this browser session as a server-only HttpOnly-cookie design. Supabase SPA sessions are browser-managed; avoid unsafe HTML rendering, use a restrictive compatible CSP, and never persist photos/descriptors/transcripts as a new generic offline cache.

### Route map

| Route | Access / behavior |
| --- | --- |
| `/login`, `/signup`, `/forgot-password` | Public credential forms |
| `/auth/callback` | Confirmation result and session exchange/handling |
| `/reset-password` | Show reset form only with valid recovery context |
| `/` | Protected dashboard with existing Layout |
| `/people`, `/people/:id` | Protected People and Person Detail |
| `/help` | Protected How to Use / Replay Guide |
| `/ar` | Protected full-screen AR outside sidebar Layout |

Keep BrowserRouter. Configure SPA hosting rewrites to `index.html` so refreshing a deep link or opening an email callback works. Test deployed URLs, not only Vite's dev server.

## 5. Implement account flows

| Flow | SDK behavior / acceptance |
| --- | --- |
| Signup | `signUp` with email/password and allowlisted redirect; show confirmation instructions if no session is returned |
| Login | `signInWithPassword`; generic invalid-credentials message, loading state, safe return navigation |
| Confirmation | Handle the configured provider flow consistently; show expired/reused-link failure and retry path |
| Recovery request | `resetPasswordForEmail` with configured reset URL; consistent response for existing/non-existing accounts |
| Reset | Require recovery state; validate matching new passwords; `updateUser`; handle expired link |
| Logout | `signOut` with documented scope; clear state and private caches, stop camera, navigate away |

Choose the documented browser flow once. If using PKCE, process its code exchange exactly once and account for verifier availability in the initiating browser; do not combine implicit token handling and PKCE snippets. Email template links and callback code must agree. Test opened links, refresh, expired links, recovery errors, and user-friendly retry behavior.

Disable duplicate submits and show errors beside fields/actions. Check password confirmation, email formatting, and provider password guidance. Do not log passwords, session tokens, or full auth callback URLs. Authentication failures must not be converted into an apparently successful empty dashboard.

On logout or account change, invalidate pending data loads, clear cached records/signed photo URLs/descriptors/tour context, stop all camera tracks and inference, and reset any selected person. Browser Back must not reveal the old account's private UI. Muzzamil's RLS tests verify the actual data boundary.

## 6. Data API agreement with Muzzamil

The existing `/api/...` names in shared notes are logical application paths, not Next.js routes. `services/api.ts` calls a Supabase Edge Function named `app-api`: its deployed base is `<supabase-url>/functions/v1/app-api`, with suffixes such as `/people` and `/ar/bootstrap`. There is no implicit Vite server API. Muzzamil must configure the function router and authenticated CORS handling.

The browser SDK obtains/refreshed access token is sent as Bearer authorization; use supported SDK headers/client helpers with the publishable key. The function verifies identity server-side and uses a user-scoped database client. Never pass `owner_id` as authoritative input.

| Logical operation | Result |
| --- | --- |
| List/add/read/delete people | Owned records with UUID IDs and temporary private photo URLs |
| List/add/delete conversations | Owned person's conversations, newest first; AI/manual/fallback source |
| Dashboard | Counts and compact previews; does not wait for a billable Gemini health request |
| AR bootstrap | Owned descriptors/model IDs and latest summaries, without raw transcripts/photos |
| Legacy import | Explicit, retry-safe import with old-to-new ID mappings |
| Read/write onboarding | Account-scoped, versioned tour progress |

Use the endpoint tables in Muzzamil's implementation file as the shared payload specification. Keep one `contracts.ts`. IDs change from numeric Dexie keys to UUID strings: remove `parseInt(id)` from PersonDetail and update all person/conversation refs. Dates are ISO strings at the API boundary. Signed URLs expire; refresh them without making the bucket public.

Standard errors: `{ error: { code, message, fieldErrors? } }` with 400 validation, 401 signed out, 404 inaccessible/not found, 409 import conflict, 413 oversized body, 422 unsupported image/descriptor, 429 throttled, 503 dependency failure. Handle real errors; do not advance the tour on a failed request.

Before remote data integration, avoid exposing the legacy unowned IndexedDB records on authenticated pages. Muzzamil's explicit import UI handles ownership. Browser storage belongs to its origin: preserve the old origin or export before changing domain/port. Keeping Vite removes the need for a framework-related port migration, but deployment-origin changes still matter.

## 7. Build the arrow guide

Implement anchored callouts/arrow and optional spotlight, not a tutorial modal or full-screen focus trap. Keep existing add-person/conversation forms. Use stable `data-tour` attributes and real successful action events.

| Target | Advance only when |
| --- | --- |
| `nav-people` | People route mounted |
| `people-add` | Add form mounted |
| `person-photo` | Valid photo selected; processing state explained |
| `person-name`, `person-relation` | Each required field valid |
| `person-save` | Enrollment ready and server save succeeds |
| `person-view` | Newly saved person's route mounted |
| `conversation-add`, `conversation-text` | Form open and text valid |
| `conversation-mode` | AI/manual selection made |
| `conversation-summary` | Manual mode only; valid summary |
| `conversation-save` | Server confirms save |
| `nav-ar`, `ar-status` | AR mounted; explain permission/preparing/denied state |
| `ar-camera-toggle`, `ar-home` | Explain stop/start and return navigation |
| `help-replay` | User finishes |

Events include `person:save-success {id}`, `enrollment:status`, `conversation:save-success`, `camera:state`, and `route:ready`. Store the created UUID in tour context to target the correct card. Never advance simply because the user clicked Save.

State: idle, active, paused, skipped, completed. Progress: `tourId`, `version`, `stepId`, `status`, `updatedAt`. Persist through the account-scoped onboarding endpoint. Handle refresh, navigation, missing target, interrupted photo processing, server error, and account change. Unknown targets pause with a clear recovery action. Never silently mark a tour complete after failure.

Position through a DOM portal and target measurements; observe resize and scroll, clamp to viewport, scroll the actual target into view, and release observers/listeners on cleanup. Coordinate layering with existing form modals. Support keyboard, Escape-to-pause, visible focus, readable announcements, reduced motion, 200% zoom, and narrow screens.

Add `/help` with clear instructions and Replay Guide. Optional management tours explain search and deletion without performing destructive actions. Do not create fake people, grant permissions, or send conversations automatically. Explain the current glasses preview as visual-only.

## 8. Meta research handoff

Research only; no hardware integration in this feature branch. Produce a dated matrix covering exact model, Display web-app versus native toolkit route, camera access evidence, display/input support, auth behavior, region/account availability, acceptable-use requirements, and simulator/device tests. Ask Hasan for the device model before hardware-dependent work.

The existing React frontend/backend can be reused selectively, but opening the site on glasses does not prove live camera support. Muzzamil reviews the frame-processing path. Keep unknown capabilities labeled unknown.

References: [Meta FAQ](https://developers.meta.com/wearables/faq/), [web-app starter](https://github.com/facebook/meta-wearables-webapp), [Device Access Toolkit](https://developers.meta.com/wearables/device-access-toolkit/).

## 9. Completion and PRs

- [ ] Vite and React Router retained; existing visual routes still work.
- [ ] Signup, confirmation, login, refresh, recovery, logout work with delivered emails.
- [ ] Signed-out deep links redirect; API/database/storage enforce authorization independently.
- [ ] Account B cannot see account A's records or cached recognition data.
- [ ] Tour completes through real actions; skip/resume/replay/error recovery work.
- [ ] Mobile, keyboard, reduced motion, and deployed email deep links checked.
- [ ] No provider/privileged key in browser bundle.
- [ ] Meta findings distinguish verified documentation from inference and untested hardware.

Suggested PRs: auth setup/routes; account-scoped data integration with Muzzamil; guide/help; Meta findings. Run the existing build/lint plus meaningful auth/tour integration tests and manual flows. Record actual results and blockers. No force-push to main.

Official setup references: [React auth](https://supabase.com/docs/guides/auth/quickstarts/react), [password auth](https://supabase.com/docs/guides/auth/passwords), [Edge Functions](https://supabase.com/docs/guides/functions).
