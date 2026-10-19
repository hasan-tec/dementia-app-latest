# Muzzamil — persistent data, faster face enrollment, and smoother AR

Prepared for Muzzamil Bukhari · 18 October 2026 · Planning only

## 1. Your assignment

Replace browser-only saving with account-scoped persistent storage. Reduce the wait when adding a face. Make AR start faster, run smoothly, and release the camera properly. Keep the existing Gemini conversation-summary feature working while moving its API key out of the browser.

Read `Muzzamil_02_Implementation.md` for the proposed schema, endpoint contracts, file map, migration process, test cases, and delivery sequence. This document explains the choices.

## 2. Reviewed baseline and sync limitation

Repository: `hasan-tec/dementia-app-latest`.

Reviewed commit: `d918557357281e989bfd83132b081640194d2ab7` — 8 February 2026 — “Fixed build errors: removed unused state variables.” An isolated checkout was reconstructed from the Desktop repository's Git objects. Its saved `origin/main` matches that hash. GitHub network access failed in this session; verify the live remote before starting work.

The Desktop working tree still contains October's `frontend/` and `backend/` files. They are not present in the restored February commit. Do not assume their NestJS server, Prisma schema, or auth implementation belongs to the current baseline. No application code was changed or packages installed during this planning task.

## 3. How the existing application works

| File | What is there now | Why it matters |
| --- | --- | --- |
| `src/db/database.ts` | Dexie database `DementiaARDatabase`, version 1 | People, image Blobs, descriptors, conversations all stay in one browser |
| `src/pages/People.tsx` | FileReader preview, model loading, face extraction, local insert | Save can run before extraction completes; selecting another image can race |
| `src/services/faceDetection.ts` | Tiny detector, tiny landmarks, recognition net; boolean model-loaded flag | No shared in-flight model promise; repeated calls can duplicate initialization |
| `src/pages/ARViewer.tsx` | Load all people, then models, then camera | Serial startup delays preview |
| Same AR file | Descriptor extraction on every recognition iteration; per-frame React position state | Needs measured scheduling and render-cost improvements |
| Same AR file | Timeout-driven loop and camera controls | Stop does not cancel every resource; no restart path |
| `src/services/gemini.ts` | Browser fetch using `VITE_GEMINI_API_KEY` | Secret must move to a server-only module |
| `src/pages/Dashboard.tsx` | Waits for Gemini health request together with counts/people | Remote provider delay can hold the whole dashboard |
| `src/pages/PersonDetail.tsx` | Gemini/manual summary then local save | Preserve manual/fallback workflows while adding persistence |

Recognition currently uses Euclidean distance converted to `max(0, 1-distance)`, with a similarity cutoff of 0.4. The displayed percentage is not a calibrated probability. Preserve the current metric initially and measure before changing matching thresholds.

## 4. Recommended storage choice

Use Supabase PostgreSQL for people/conversations, Supabase private Storage for images, and the same Supabase project for Nabeel's email/password accounts. This keeps one identity system and avoids provisioning a separate API server. Next.js route handlers provide our application endpoints.

Start with a validated descriptor array and model identifier stored alongside each person. Fetch only the signed-in user's compact recognition dataset at AR entry, then match locally. Do not send every camera frame across the network. This is a design choice for a small caregiver gallery, not a claim that a database alone will accelerate inference.

Do not introduce a standalone vector database at this stage. It will not fix image decoding, model download, or browser inference time. If a later benchmark shows that gallery matching is a bottleneck, consider PostgreSQL with pgvector, preserving the embedding model, dimension, distance metric, and account filter. Never mix Gemini text embeddings with face descriptors.

The model descriptor is expected to contain 128 values; verify the actual installed face-api output and enforce a matching schema before writing migration SQL. Record model/version so future model changes cannot silently compare incompatible vectors.

## 5. Account ownership and migration

For release one, one caregiver account owns its people and conversations. Nabeel owns account flows and shared SSR clients; you own row-level security, object policies, schema, and data endpoints. Use the validated authenticated account ID, never a client-supplied owner ID.

Every access path must enforce ownership, including direct database/storage calls, person ID URLs, conversation creation, import, deletion, and AR bootstrap. Foreign-key constraints must prevent attaching a conversation to another account's person.

Legacy IndexedDB data has no owner. Offer an explicit import after login, only from the same browser origin that holds it. Keep the original database until counts, photos, and relationships are verified. Use a stable local import identity and ID mapping so retries do not create duplicates. Never silently import the same browser dataset into a second account.

Important deployment detail: IndexedDB belongs to its browser origin. Changing Vite's localhost port to Next.js's default port will make the old database appear missing. Provide an export/import path or run the migration entry at the original origin. A new domain cannot read the old domain's IndexedDB.

## 6. Faster face enrollment

Measure cold model load, image decode/resize, inference, and upload separately. Then improve the stages that are slow:

- Share one pending model-loading promise and allow an explicit retry on failure.
- Load face code only on screens that need it; optionally warm it when the user intentionally opens Add Person.
- Resize large uploads while preserving orientation and usable face detail.
- Track photo-selection generations so results from image A cannot overwrite image B.
- Disable normal Save during inference. Offer an explicit save-without-recognition action only after a clear failure/retry choice.
- Distinguish zero faces, multiple faces, model failure, and invalid image. Do not store a descriptor without a clear one-face enrollment decision.
- Release preview URLs and transient buffers after use.

Set performance goals after collecting a baseline on a named phone and laptop. Do not promise a fixed speedup before testing.

## 7. Faster and safer AR behavior

Start preview preparation, account data loading, and model loading concurrently after user entry. Recognition waits for all required inputs; preview should not wait for model downloads.

Use one cancellable recognition loop with no overlapping inference. Separate frequent lightweight face position updates from less frequent descriptor extraction if benchmarks support it. Animate overlay positioning without rerendering the whole page every frame. Pause work while hidden. On Stop, logout, route exit, or failure, cancel timers/animation and stop all tracks—even a stream that resolves after unmount.

Clear old identity information when a face disappears or becomes unknown. Require stable consecutive observations before showing a name; handle ambiguous matches. Correct overlay positioning for mirrored video and `object-fit: cover` cropping. Rename the current Ray-Ban button to make clear it is a visual preview until real device integration exists.

## 8. Gemini and coordination

Gemini already summarizes conversations. It is not the face recognizer. Keep its existing user flow, but call it from an authenticated server endpoint with a server-only key, bounded input, timeout, and rate limiting. Keep manual summaries and clearly indicate fallback results. Do not log conversation text, face descriptors, or provider response bodies.

Nabeel will migrate Vite to Next.js. Land your storage SQL and specifications independently, then integrate route handlers into his agreed structure. He also owns tutorial presentation; provide readiness/save/camera events so his guide follows real successful actions.

Meta glasses research is led by Nabeel, with your review of camera frame delivery and performance feasibility. Current documentation separates Display web apps from mobile Device Access Toolkit integrations. Do not assume `getUserMedia` on our website receives the glasses' camera stream.

## 9. Completion criteria

Two independent devices using the same account see the same records. Different accounts see none of each other's data. Import retries do not duplicate records. Face enrollment has clear processing/error states. AR preview, model readiness, and recognition timings are documented before/after on the same devices. Repeated AR entry/exit leaves no active camera or duplicate loops. Gemini has no browser-exposed provider key.

Ship focused PRs in this order: schema/policies, data endpoints/import, Gemini boundary, face enrollment, AR optimization. Review with Nabeel before merging. Do not restore discarded commits or force-push `main`.

## Official references checked

- [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control)
- [Supabase password authentication](https://supabase.com/docs/guides/auth/passwords)
- [Face-api project and models](https://github.com/vladmandic/face-api)
- [Gemini API key guidance](https://ai.google.dev/gemini-api/docs/api-key)
- [Meta Wearables FAQ](https://developers.meta.com/wearables/faq/)
