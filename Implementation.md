# Muzzamil — implementation playbook

Companion: `Muzzamil_01_Overview.md` · Baseline `d918557` · Planning only

## 1. Prepare a clean feature branch

Use the restored February commit, not the October monorepo currently visible in the Desktop working folder. Fetch first, verify `origin/main` is `d918557357281e989bfd83132b081640194d2ab7` or an agreed newer integration commit, and preserve local changes. These checks require working GitHub access on your machine.

```powershell
git status --short
git fetch origin
git rev-parse origin/main
git worktree add -b feature/muzzamil-data-ar ../dementia-muzzamil origin/main
Set-Location ../dementia-muzzamil
```

If fetch fails or the hash differs unexpectedly, investigate before creating the branch. Do not merge the removed October commits. Coordinate Nabeel's Next.js skeleton before writing route handlers; schema and standalone performance changes can start from the original `src/` structure.

## 2. Proposed files and ownership

```text
supabase/
  migrations/001_people_conversations.sql
  migrations/002_storage_policies.sql
  migrations/003_import_onboarding.sql
  tests/ownership.sql
src/
  app/api/
    people/route.ts
    people/[id]/route.ts
    people/[id]/conversations/route.ts
    conversations/[id]/route.ts
    dashboard/route.ts
    ar/bootstrap/route.ts
    import/route.ts
    onboarding/route.ts
  lib/
    contracts.ts
    data/people.ts
    data/conversations.ts
    data/storage.ts
    data/recognition.ts
    ai/gemini.server.ts
    validation.ts
    rate-limit.ts
  features/
    people/enrollment.ts
    people/image-processing.ts
    ar/useARSession.ts
    ar/recognition-loop.ts
    ar/overlay-position.ts
    import/legacy-export.ts
    import/legacy-import.ts
  services/faceDetection.ts
  db/legacy-database.ts
tests/
  integration/ownership.test.ts
  integration/import.test.ts
  integration/conversations.test.ts
  browser/enrollment.spec.ts
  browser/ar-lifecycle.spec.ts
```

Nabeel owns `lib/supabase/*`, `lib/auth/require-user.ts`, the app layout/routes, auth pages, and tutorial UI. You use his validated per-request auth/client helpers. Create one shared `contracts.ts`; review it together before either UI/API changes land.

## 3. Database design for release one

Supabase is a proposed new dependency/project. Do not provision paid resources or apply production migrations during this planning handoff. During implementation, create a development project first and commit repeatable SQL migrations.

| Table | Fields and constraints |
| --- | --- |
| `people` | `id uuid PK`, `owner_id uuid NOT NULL → auth.users`, `name text`, `relation text`, `photo_path text`, `face_descriptor real[] NULL`, `descriptor_model text NULL`, `recognition_status text`, `created_at timestamptz`, `updated_at timestamptz` |
| `conversations` | `id uuid PK`, `owner_id uuid NOT NULL`, `person_id uuid NOT NULL`, `raw_text text`, `summary text`, `summary_source text`, `date timestamptz`, `created_at timestamptz` |
| `onboarding_progress` | Composite PK `(owner_id,tour_id)`, `version integer`, `step_id text`, `status text`, `updated_at timestamptz` |
| `legacy_imports` | Composite unique `(owner_id,source_id,entity_type,legacy_id)`; server entity UUID, payload hash, import status, timestamp |

Enforce a unique `(id,owner_id)` pair on `people` and composite foreign key `(person_id,owner_id)` from conversations to people, with cascade delete for conversation rows. This prevents cross-account relationships even if endpoint validation is missed. Restrict deletion of auth users until the corresponding private objects are cleaned through a controlled workflow; deleting database rows alone does not delete Storage objects.

Check name/relation non-empty and maximum lengths; recommended initial limits are 120 and 80 characters. Bound conversation raw text at 10,000 characters and manual summary at 300. These are project defaults to review, not provider limits. Check descriptors have the expected 128 finite numeric values and compatible model ID; verify that dimension against a real extraction before finalizing SQL. Enforce model/status/descriptor consistency. Set timestamps server-side.

Indexes: `people(owner_id,created_at DESC)`; `conversations(owner_id,person_id,date DESC,created_at DESC,id DESC)`; import uniqueness; progress composite primary key. Define “latest conversation” by `date DESC`, then `created_at DESC`, then `id DESC`. Test the current Dexie ordering against seeded data rather than copying its `reverse().sortBy()` expression into the backend.

Do not add pgvector initially. Our release-one matching stays in the browser over a small owned gallery. Store versioned numeric face descriptors; use exact Euclidean matching. Revisit vector indexing only when measured dataset sizes and matching latency justify it.

## 4. Authorization and private images

Enable RLS on all application tables. Configure grants deliberately. For SELECT/DELETE, require `auth.uid() = owner_id`; INSERT needs matching owner in `WITH CHECK`; UPDATE needs both existing and new ownership checks. Do not permit changing `owner_id` through public update routes. Keep ordinary requests on user-scoped clients so RLS remains active.

Create private bucket `person-photos`. Object keys: `{ownerUuid}/{personUuid}/{randomFileUuid}.jpg` (or validated output format). Policies for read/write/delete must enforce the authenticated account prefix and bucket; application validation must also bind the object to the owned person. Keep names, email addresses, and relationship labels out of keys. Use short-lived signed URLs, e.g. five minutes as an initial project default. Lists return signed photo URLs, not public permanent URLs or photo Blobs.

Upload policy defaults: at most 5 MiB per processed image; validate content type, byte size, successful image decode, dimensions/pixel budget, and output format. Resize/re-encode to remove unnecessary metadata. Client validation improves UX; server validation is still required.

Creation spans Storage and PostgreSQL, so it is not one transaction: reserve a UUID, validate, upload to a unique path, then insert the row. If insert fails, remove the staged object. Track/retry failed cleanup using a durable cleanup mechanism, with narrow privileged access if needed. Return a recoverable failure rather than orphaning silently.

Deletion: authorize record; remove its private object; delete the person row and cascade conversations. If object deletion fails, retain the row and return a retryable failure. If row deletion fails after object removal, retry row deletion idempotently; the UI must tolerate a missing image. Define retry behavior and cleanup logs without personal content. Never claim all photos were deleted because a SQL cascade succeeded.

## 5. Shared endpoint contract

Every endpoint authenticates on the server; never accept `owner_id` from request JSON. Same-origin mutation checks, bounded request bodies, validation, and rate limits apply before expensive work. Private responses must not enter shared/public caches.

| Route | Contract |
| --- | --- |
| `GET /api/people` | `{ people: PersonListItem[] }` |
| `POST /api/people` | Multipart name/relation/image and optional descriptor/model metadata; `{ person }`, 201 |
| `GET /api/people/[id]` | `{ person }`; inaccessible IDs return 404 |
| `DELETE /api/people/[id]` | `{ deleted: true }` after deletion sequence |
| `GET /api/people/[id]/conversations` | `{ conversations: ConversationRecord[] }`, newest first |
| `POST /api/people/[id]/conversations` | `{ rawText, mode: 'ai'|'manual', manualSummary? }` → `{ conversation, summarySource }`, 201 |
| `DELETE /api/conversations/[id]` | `{ deleted: true }` |
| `GET /api/dashboard` | Counts, recent conversations, people preview; no live Gemini generation needed |
| `GET /api/ar/bootstrap` | `{ people: RecognitionPerson[], datasetVersion }` |
| `POST /api/import` | Versioned multipart import, ID map and per-record results |
| `GET/PUT /api/onboarding` | Account-scoped versioned tour progress |

`PersonListItem`: UUID `id`, name, relation, signed `photoUrl`, `recognitionStatus`, ISO `createdAt`/`updatedAt`.

`ConversationRecord`: UUID `id`/`personId`, `rawText`, `summary`, `summarySource`, ISO `date`/`createdAt`.

`RecognitionPerson`: UUID `id`, name, relation, descriptor, descriptorModel, `latestSummary: string|null`. No full images or raw conversations in AR bootstrap. Generate `datasetVersion` from both people and conversation changes so summaries invalidate correctly. Use a bounded bulk query rather than one conversation request per camera frame or person. If using a SQL function/view, verify its invoker privileges and RLS behavior.

Errors: `{ error: { code, message, fieldErrors? } }`, with 400 invalid input, 401 signed out, 404 inaccessible/not found, 409 import conflict, 413 body too large, 422 unsupported image/descriptor, 429 throttled, 503 temporary dependency failure. Gemini fallback can succeed with `summarySource: 'fallback'`; do not label it AI-generated success.

Validate hosting body limits before accepting the 5 MiB upload design. If deployment limits are smaller, switch to authenticated staged direct-to-storage uploads and a finalization endpoint, updating this contract with Nabeel. Do not silently ship uploads that only work locally.

## 6. Legacy IndexedDB migration

Keep `DementiaARDatabase` version 1 readable through a browser-only legacy module. Its records use numeric IDs, image Blobs, date objects, and no account identity.

1. After sign-in, detect legacy data on the current origin. Ask the user explicitly whether to import it into the displayed account. This is an implementation feature, not an extra permission step for this planning task.
2. Create/persist a random `sourceId` for this local dataset. Export an optional backup archive: manifest plus photo files. Do not replace photos with transient `blob:` URLs.
3. Manifest v1: `sourceId`, `schemaVersion`, `people[] {legacyId,name,relation,photoFile,descriptor?,descriptorModel?}`, `conversations[] {legacyId,personLegacyId,rawText,summary,date,createdAt}`. Normalize timestamps to ISO and reject malformed/cross-linked records. Multipart upload includes the manifest and referenced binary photo parts. Chunk one person and its related records at a time to respect request limits; keep chunk retries idempotent.
4. Server import mapping keys are `(ownerId,sourceId,entityType,legacyId)`. Same key/same hash returns the existing UUID. Same key/changed payload returns conflict rather than overwriting silently. Preserve person mapping before importing conversations.
5. Infer unknown legacy descriptor provenance cautiously: mark unverified and re-extract from the stored photo before recognizing with a new model; preserve the original backup.
6. Return per-record status, person/conversation ID map, and expected/actual counts. Resume failed chunks; never report completion after a partial failure.
7. Record the local dataset's claimed account after the first confirmed import and block automatic reassignment. A different account requires explicit ownership review; do not silently copy it again.
8. Verify image accessibility and newest summaries from another device. Keep original IndexedDB until a separate user action requests cleanup.

Origin trap: `localhost:5173`, `localhost:3000`, HTTP versus HTTPS, and different domains have separate IndexedDB stores. Next.js cannot discover the old database from a different origin. Use an export screen on the old origin before migration, or temporarily serve a compatible migration entry at that origin. The backup/import fallback is necessary for domain changes. Do not copy database browser profile files.

## 7. Face enrollment performance work

### Instrument before optimizing

Measure model load, decode/resize, inference, upload, and total readiness independently with browser performance marks. Capture cold and warm runs, device/browser, image dimensions, gallery size, network, and model version. Use consented test images; performance reports contain timings, not face data.

### Implementation steps

1. Change model loader from a boolean-only guard to a shared promise. Concurrent callers await one initialization. On rejection, clear the pending promise so Retry works; show which stage failed.
2. Pin model artifacts to the chosen package/model version, preferably serve verified assets under `public/models/face-api/<version>/`. Inspect upstream licensing before redistribution. Do not trust the existing comment that CDN is always faster. Choose caching from measured network behavior.
3. Dynamically import face code at the browser feature boundary. Optionally preload on Add Person intent, not on login or every route.
4. Decode once, honor orientation, resize to a bounded inference canvas (start by benchmarking a longest edge around 1024 pixels), preserve a useful stored-photo resolution, and re-encode within upload limits. Small faces may require a larger input; test before lowering detector settings.
5. Track a monotonically increasing request generation. On new file, close, reset, or unmount, invalidate previous work. Ignore late completions; release object URLs, canvases, and intermediate buffers. Add image decode error handling.
6. Detect zero/one/multiple faces; require one clear enrollment face. Store a descriptor only with compatible model ID and dimensions. Block normal Save while extracting; permit an explicit metadata-only save after clear failure/retry choice.
7. Emit enrollment state events for Nabeel's guide. Success means the server saved the record, not that inference started.

Use a worker only after profiling shows main-thread blocking and after proving the chosen face-api backend/input types work in that worker. Do not move DOM-only video APIs into it blindly. Do not add a second recognition library without a model compatibility/migration plan.

## 8. AR startup, inference, and rendering

Extract session lifecycle from `ARViewer.tsx` into `useARSession.ts`. Model states explicitly: idle, preparing, camera-denied, loading-models, ready, paused, stopped, error. Expose Start/Stop and Retry controls.

On user entry, run camera preparation, model load, and authenticated bootstrap concurrently. Start preview once the stream plays; start recognition only when video dimensions, models, and dataset are ready. A rejected data fetch must not become “no people registered.”

One session owns an AbortController, generation ID, timeout handle, animation handle, stream reference, and inference-busy flag. Each awaited stage checks generation before committing results. Late `getUserMedia` results after Stop/unmount must have all tracks stopped immediately. Cleanup stops tracks, clears video `srcObject`, cancels scheduling/animation, clears matched identity, and releases cached account data. Verify under React Strict Mode and repeated route entry.

Recognition scheduling: only one inference in flight. Begin with the current 320 detector input as baseline; benchmark a lightweight position pass around 8–10 Hz and descriptor pass around 2 Hz, adapting to measured inference duration and device load. These are trial settings, not promised device rates. Pause on hidden documents and stop/resume appropriately on page lifecycle changes. Do not upload frames for routine matching.

Precompute compatible typed descriptors once per dataset update. Keep the existing Euclidean metric initially. Require repeat observations and a sensible gap between the top two candidates before committing a match; calibrate cutoff/stability against consented known/unknown-face tests. Replace “Recognized (60%)” with neutral status or an explicitly labeled uncalibrated match score. Clear name/summary after a short documented no-face timeout (initial proposal: one second), and immediately invalidate on unknown/ambiguous identity. Never retain the last person's card indefinitely.

Update overlay transforms through a small isolated element/ref instead of page-wide React state on every animation frame. Convert video coordinates to rendered coordinates using intrinsic size, container size, cover crop offsets, and mirror state; clamp the card to visible bounds. Test portrait/landscape and front/rear cameras. Avoid logging every recognition frame or comparing record.

Bootstrap refreshes on AR entry and relevant data-change events. After session expiry/logout, stop recognition and discard the dataset. Temporary offline behavior must be explicit; do not silently persist unencrypted descriptors across accounts as a new offline cache. Release any cached image URLs when leaving their views.

## 9. Gemini migration

Move the provider call from `src/services/gemini.ts` to server-only `lib/ai/gemini.server.ts`. Keep `GEMINI_API_KEY` and configurable `GEMINI_MODEL` server-side. Verify currently supported model availability before selecting the model; the baseline hardcodes a preview model and this plan does not assume it will remain available.

Conversation endpoint sequence: validate session → validate owned person → validate input/mode → apply per-user request limit → generate bounded summary with timeout if AI chosen → validate/normalize response → insert conversation. Manual mode never calls Gemini. Provider 429/timeouts/malformed output can use the existing local-style fallback with `summarySource: 'fallback'`; display that distinction. Do not invent missing details. Preserve raw text and allow correction.

Use an initial ten-second provider timeout and a conservative per-user generation limit as project defaults, tuned after testing. Rate limiting must work across deployed instances; an in-memory Map alone is not a production limit. Do not place a live billable generateContent request in dashboard loading. Log request IDs/status/duration only, not transcripts, keys, descriptor arrays, or provider bodies. Rotate any previously exposed key before production rollout.

## 10. Verification and PR evidence

| Area | Required check |
| --- | --- |
| Ownership | Accounts A/B cannot list/read/change/delete each other's people, conversations, objects, imports, or progress; anonymous requests denied |
| Relational safety | Reject conversation linked to another owner's person, including direct database attempt |
| Photos | Private URL expires; unauthorized path access denied; failed create cleans up; interrupted deletion retries safely |
| Import | Retry same chunk produces no duplicates; partial retry preserves mappings; origin-change backup restores data |
| Enrollment | Large/rotated image, no face, two faces, corrupt file, model failure, image A→B race, close mid-inference |
| AR lifecycle | Denied camera, no device, late stream, ten entry/exit cycles, Strict Mode, background/resume, expired session |
| Matching | Known/unknown/ambiguous faces; stale card disappears; latest conversation selection is correct |
| Gemini | Manual mode, provider success, 429, timeout, malformed response, fallback source and saved text |
| Builds | Typecheck, lint, production build, server/browser boundaries and secret scan |

Performance acceptance report: same device/browser/network/image set before and after; at least ten cold/warm runs where practical; report median and tail timing with sample size, preview latency, model readiness, enrollment latency, inference latency, render responsiveness, and loop/tensor resource trends. Agree speed goals from that baseline before optimizing; no numeric improvement is claimed yet.

Suggested PRs: schema/policies; endpoints/private storage/import; server Gemini; enrollment; AR lifecycle/performance. Include migrations, rollback notes, real test outputs, and failures. Deploy additive schema first and preserve legacy data during rollout. If reverting the UI, do not drop imported database records or photos. Nabeel reviews auth/data/guide events; Hasan reviews ownership assumptions and the final behavior.

## Official references

- [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Storage policies](https://supabase.com/docs/guides/storage/security/access-control)
- [SSR client integration](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Face-api upstream](https://github.com/vladmandic/face-api)
- [Gemini API key handling](https://ai.google.dev/gemini-api/docs/api-key)
- [Meta toolkit overview](https://developers.meta.com/wearables/device-access-toolkit/)

Meta hardware integration is research-only in this assignment. Nabeel leads the feasibility matrix; you verify camera frame input and processing constraints. Do not equate the current CSS Ray-Ban preview with SDK support.
