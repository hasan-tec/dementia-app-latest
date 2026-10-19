# Nabeel — email/password authentication and the guided tour

Revised 18 October 2026 · Planning only · Read this before the implementation playbook

## Scope

Keep the current React + TypeScript + Vite application and React Router. Add email/password signup, login, password recovery, and logout inside this application. Then add an arrow-based guide that teaches new users by pointing at the real controls. No framework migration and no Google/social login.

Use Supabase Auth for accounts and sessions, alongside the Supabase PostgreSQL database and private image storage planned for Muzzamil. This is an architecture proposal, not a service already configured. Authentication data is managed by Supabase Auth; do not create a separate public passwords table or implement password hashing in the browser.

## Reviewed code

Repository: `hasan-tec/dementia-app-latest`.

Baseline: `d918557357281e989bfd83132b081640194d2ab7`, 8 February 2026, “Fixed build errors: removed unused state variables.” An isolated checkout was reconstructed from the Desktop repo. Its saved `origin/main` points at this commit; live GitHub fetching failed in this session. Verify the remote before coding. The Desktop working tree's October `frontend/` and `backend/` folders are not part of this restored baseline.

| Existing file | Responsibility | Planned change |
| --- | --- | --- |
| `src/App.tsx` | BrowserRouter and dashboard/people/AR routes | Add auth routes and a protected route wrapper |
| `src/main.tsx` | Vite React entry | Mount AuthProvider and TourProvider |
| `src/components/Layout/Sidebar.tsx` | Portal navigation | Add Help, Replay Guide, and Logout |
| `src/pages/Dashboard.tsx` | Counts and quick actions | Use owned data; avoid blocking on Gemini health |
| `src/pages/People.tsx` | Add/list/search/delete people | Add stable tutorial targets and success events |
| `src/pages/PersonDetail.tsx` | Conversations and summary flow | Add tutorial targets and server result handling |
| `src/pages/ARViewer.tsx` | Browser camera recognition | Keep existing route; Muzzamil optimizes lifecycle |
| `src/db/database.ts` | Unowned local IndexedDB | Muzzamil handles persistent storage/import |
| `src/services/gemini.ts` | Browser provider request | Muzzamil moves provider access to an Edge Function |

There is no auth at the February baseline. Keep Vite configuration, existing CSS, and React Router. Do not reintroduce discarded October commits.

## Shared architecture and responsibilities

Vite serves the browser application. Supabase Auth verifies email/password accounts. PostgreSQL RLS and private Storage policies enforce ownership. Supabase Edge Functions perform server-side tasks such as Gemini calls, validated multipart operations, and legacy import. There is no Next.js server.

| Work | Owner |
| --- | --- |
| Browser Supabase client, AuthProvider, route guard | Nabeel |
| Signup/login/confirmation/recovery/logout screens | Nabeel |
| Arrow guide, Help page, UI accessibility | Nabeel |
| Tables, RLS, image policies, data endpoints/import | Muzzamil |
| Face enrollment and AR performance | Muzzamil |
| Gemini Edge Function and provider secret | Muzzamil |
| Meta feasibility research | Nabeel leads; Muzzamil reviews camera/data path |

Release one assumes one caregiver account owns its people and conversations. Sharing patients between multiple accounts is future scope. Use one project and one identity system; Muzzamil's records refer to Supabase Auth user UUIDs.

## Authentication behavior

Provide login, signup, confirmation outcome, forgot-password, reset-password, and logout. All forms need pending states, clear errors, validation, and duplicate-submit protection. Test confirmation and recovery with delivered emails and configured redirect URLs.

AuthProvider exposes `initializing`, `signedOut`, or `signedIn`. While initializing, render a neutral loading screen rather than briefly showing private pages. Protect dashboard, People, Person Detail, and AR. Preserve a safe internal return path for login.

The React route guard is a UX feature. The real security boundary is verified server identity plus RLS/storage policies. A user bypassing the guard must still be unable to access another account's data.

Logout and account switching clear cached records, photos, descriptors, guide context, and camera work. Existing IndexedDB data has no owner; import it only after explicit confirmation and never silently attach it to each account that logs in.

Supabase's browser SDK handles its session persistence and refresh. Do not write another password/token store or claim this SPA uses server-only HttpOnly sessions. Avoid storing sensitive records in new persistent browser caches. Use a strong Content Security Policy and prevent unsafe HTML injection.

## Arrow-based guide

The guide is an anchored instruction with an arrow and a step number. It is not a modal or slideshow. Users perform actual actions; the guide waits for successful completion.

Core journey:

1. Open People.
2. Click Add Person.
3. Upload a clear photo containing one face.
4. Enter name and relationship, in separate steps.
5. Explain processing; wait until enrollment is ready before guiding Save.
6. After server save, open that person's View page.
7. Add a conversation, choose AI/manual summary, and save successfully.
8. Enter AR after explaining camera permission.
9. Explain recognition status, Stop/Start Camera, and Home.
10. Point out Help and Replay Guide.

Allow Skip, Pause, Resume, Back, and Replay. Add short optional tours for search and record management. Never click Delete or create fake patient data for the user. Existing add-person/conversation forms may remain modals; the tutorial itself must not become a separate modal.

Use account-scoped, versioned progress so completion persists across devices. The guide must survive navigation, missing targets, slow processing, form errors, and camera denial. Include keyboard support, reduced motion, visible focus, readable text, and mobile positioning.

## Meta research

The current Ray-Ban button is CSS-only. Research real integration separately from auth/tour delivery. Meta documents Display-only standalone web apps and a mobile Device Access Toolkit route. Do not promise live glasses-camera input simply because a website can open on Display glasses.

Produce a dated matrix: exact glasses model, execution surface, documented camera access, display/input support, account/region availability, authentication behavior, simulator limits, acceptable-use requirements, and real-device test status. Mark unverified capabilities as unknown. Ask for hardware details when testing depends on them; continue documentation work meanwhile.

## Delivery order

First agree the shared Supabase setup with Muzzamil. Add browser auth and protected routes without changing the framework. Integrate account-scoped data. Then build the guide against stable UI targets and real success events. Deliver Meta findings separately.

Done means signup/recovery work end to end, sessions restore correctly, account switching leaks no data, protected operations enforce ownership, and a user can complete/skip/replay the guide on mobile and desktop. The detailed file gives structure, contracts, and checks.

## Official references

- [Supabase password authentication](https://supabase.com/docs/guides/auth/passwords)
- [Supabase React setup](https://supabase.com/docs/guides/auth/quickstarts/react)
- [Row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Edge Functions](https://supabase.com/docs/guides/functions)
- [Meta Wearables FAQ](https://developers.meta.com/wearables/faq/)

No implementation was performed during this planning task.
