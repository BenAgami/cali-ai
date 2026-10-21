# Phase 1: Infrastructure - Research

**Researched:** 2026-10-22
**Domain:** BullMQ async pipeline, Express 5 SSE, Prisma migration, Expo dev build with vision-camera + fast-tflite
**Confidence:** MEDIUM (API side HIGH; native frame-processor stack MEDIUM/LOW, which is exactly what the gate verifies)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Capture payload and storage**
- **D-01:** The phone sends keypoints as gzip-compressed JSON. The payload carries a `version` field so a binary format can replace it later without breaking clients.
- **D-02:** The server stores one `PoseCapture` row per capture, holding the whole set as a single compressed blob plus metadata (pose model name/version, fps, frame count, etc., per `docs/data-model.md`). No per-frame rows.
- **D-03:** Drop the obsolete video fields in a Phase 1 migration: `videoR2Key` and the other `video*` columns on `WorkoutSession`, and `r2Key` in `VideoAnalysisJobData`. Job data becomes `sessionId` + `captureId`. Update `apps/api/src/openapi/schemas.ts`, `queue.ts`, and affected tests together. Rename `videoAnalysisQueue` to match the new purpose (planner decides the name).
- **D-04:** `POST /api/sessions/:id/capture` enforces hard caps: a maximum compressed body size (about 1 MB) and plausible frame count/duration limits, validated by Zod in `packages/common`. Exact numbers are the planner's call. Success target remains 202 with a job ID in under 500 ms.

**SSE stream (`GET /api/sessions/:id/status`)**
- **D-05:** Auth uses the existing Bearer JWT middleware. The native client uses a fetch-based SSE client, because the built-in EventSource cannot send headers.
- **D-06:** Events carry `status` (QUEUED, PROCESSING, COMPLETED, FAILED), `stage_label` (e.g. "analyzing reps", "writing feedback") and `progress_percent`. Status and stage label are persisted on the job record and are the source of truth; they are the only states the state machine moves through.
- **D-07:** `progress_percent` is derived from the persisted stage via one stage-to-range table in a single place (e.g. QUEUED 0-5, analyzing reps 10-60, writing feedback 60-95, COMPLETED 100). Optional sub-progress (rep 3 of 10) interpolates within the stage's range; otherwise the stage's lower bound is used. Percent never decreases; FAILED keeps the last reached percent; only COMPLETED reports 100. A client reading after reconnect gets the same value as a live subscriber.
- **D-08:** Tests: unit-test the stage-to-percent mapping as a pure function (ranges, monotonicity, interpolation). Integration tests assert stage transitions, not exact percent values.
- **D-09:** On connect (including reconnect), the server reads the current state from Postgres and emits it first. If the state is terminal (COMPLETED or FAILED) it sends that and closes. No event history is stored and Last-Event-ID replay is not used.
- **D-10:** The worker publishes progress via Redis pub/sub per session, and the API instance holding the connection forwards it. This works with more than one API instance.

**Failure, retry and reaper**
- **D-11:** Jobs get 3 attempts with exponential backoff (BullMQ-native). The session becomes FAILED only after the last attempt. Non-retryable errors (e.g. keypoint confidence too low) skip retries.
- **D-12:** Each LLM attempt has a hard timeout (about 45 s as a starting point; planner confirms).
- **D-13:** The stuck-PROCESSING timeout is **3 minutes**, not the 10 minutes in the original roadmap, because a user will not wait 10 minutes. It is a config constant (via `apps/api/src/config/env.ts`), and must stay above the worst-case retry budget so a job isn't reaped while legitimately retrying.
- **D-14:** The reaper is a BullMQ repeatable job that marks PROCESSING sessions older than the timeout as FAILED. No separate cron or `setInterval`.
- **D-15:** The phone shows the stage label and percent while the user waits. Results are persisted, so the user can leave and see them later. No extra "taking longer than usual" client state.
- **D-16:** After a FAILED analysis, retry re-enqueues from the stored capture via a retry endpoint. The phone does not resend keypoints.
- **D-17:** A capture for a session that is not PENDING (i.e. already PROCESSING or COMPLETED) is rejected with 409 Conflict. FAILED sessions go through the retry path (D-16).

**Dev-build and pose-model gate**
- **D-18:** The developer is on Windows with no Apple developer account. iOS gate: add an iOS simulator profile (`ios.simulator: true`) in `apps/native/eas.json`; the EAS iOS simulator build must compile with vision-camera and fast-tflite. iOS runtime verification is deferred and recorded as an accepted risk. Roadmap success criterion 5 and the INFRA-05 wording must be updated to say this.
- **D-19:** Android gate: the app launches, the pose model loads, and the frame processor runs a pose pass on a test image or video. Camera quality is checked separately on a real Android phone if one is available.
- **D-20:** The developer films short clips of the four core exercises (push-up down position, pull-up top position, dip, squat) from realistic phone angles. The planner defines the shot list.
- **D-21:** MoveNet vs the 33-point model is decided by per-joint confidence and detection rate on those clips, for the joints each exercise depends on. The lighter model wins if good enough. Record the result in the decision log.

### Claude's Discretion
- Exact numeric caps for body size, frame count and duration (D-04)
- Exact LLM attempt timeout and backoff values (D-11, D-12)
- Exact stage names and percent ranges (D-07)
- Queue and job naming after the rename (D-03)
- Choice of fetch-based SSE client library for React Native (D-05)

### Deferred Ideas (OUT OF SCOPE)
- Quantized binary keypoint format - revisit if upload size or storage cost becomes a problem (version field in D-01 keeps the door open)
- Real iOS runtime verification - needs a Mac or iPhone; revisit before iOS release
- Client-side "taking longer than usual" state - add only if users report confusion
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFRA-01 | Redis + BullMQ queue for form-analysis processing | Existing `queue.ts`/`redis.ts` reused; add Worker with its own connection, rename queue, retries/backoff (Patterns 1, 4) |
| INFRA-02 | Keypoints submitted at set end; endpoint returns job ID, processes async | Capture endpoint with gzip body, Zod caps, PoseCapture row, 202 (Pattern 2); client gzip via fflate |
| INFRA-03 | SSE endpoint delivers progress/results | SSE controller + Redis pub/sub subscriber + `react-native-sse` client (Pattern 3) |
| INFRA-04 | `processingStatus` state machine | Guarded `updateMany` transitions, reaper job scheduler (Patterns 4, 5) |
| INFRA-05 | Custom dev build with vision-camera + fast-tflite | Android EAS build exists; add iOS simulator profile; worklets-core gap; pose-model gate protocol (Native section) |
</phase_requirements>

## Summary

The API side is a well-trodden path: BullMQ `Worker` in the same Node process (or a separate entrypoint), `attempts: 3` with built-in `exponential` backoff, `UnrecoverableError` for non-retryable failures, and `queue.upsertJobScheduler` for the reaper (replaces the deprecated `repeat` option). SSE is plain Express (`text/event-stream`, flush headers, heartbeat, `req.on("close")`) with one shared ioredis subscriber connection fanned out to per-session listeners. No new server libraries are needed beyond `fflate`-free gzip: Node's `zlib` for the stored blob and Express/body-parser's built-in `Content-Encoding: gzip` inflate for the request.

The risky parts are on the native side and in cross-cutting details. (1) The repo has `react-native-vision-camera@^4.7.3` and `react-native-fast-tflite@^2.0.0` but NOT `react-native-worklets-core`, which VisionCamera v4 frame processors require; Reanimated 4 ships its own `react-native-worklets`, which is a different package. Whether the two coexist under Expo SDK 54 / New Architecture is the main unknown the gate must answer. (2) Newer majors exist (vision-camera 5.x, fast-tflite 3.x, both Nitro Modules based); do not upgrade inside this phase unless the 4.x/2.x gate fails. (3) `redisConnection` is a single shared ioredis instance with `maxRetriesPerRequest: null`; pub/sub subscribers need dedicated connections (`.duplicate()`), and BullMQ workers need a blocking connection of their own.

Several planning-critical details: the unit-test env sync rule (new env vars must go in `unitEnv.ts`), the shutdown unit test mocks `queue`/`redis` modules so it must be updated when the worker/subscriber are added, Knip will flag unused exports/deps (`fflate` etc. must be declared where imported), and syncpack requires one version range across workspaces.

**Primary recommendation:** Build in this order: (a) Prisma migration + shared Zod schemas + stage/percent pure function, (b) capture endpoint + service state transition, (c) worker with stub processor + pub/sub + reaper, (d) SSE endpoint, (e) native client pieces and the dev-build/pose-model gate as a parallel track that does not block API work.

## Standard Stack

### Core (API)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| bullmq | ^5.71.1 installed (registry latest 6.4.0) | Queue, Worker, job schedulers | Already installed; stay on 5.x in this phase (no need for 6.x migration risk). Verify 6.x notes before bumping |
| ioredis | ^5.10.1 installed (registry shows 6.0.0) | Redis connection, pub/sub | Already installed and BullMQ-compatible; do not bump |
| Node `zlib` | built-in | gzip/gunzip of stored blob and (optional) body | No dependency |
| express | ^5.1.0 | SSE via raw `res` writes | No SSE library needed |
| zod | ^4.3.6 | Payload caps in `@repo/common` | Project convention |
| http-status-codes | ^2.3.0 | `StatusCodes.ACCEPTED` etc. | Project convention |

### Core (Native)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-native-vision-camera | ^4.7.3 (installed; registry latest 5.2.3) | Camera + frame processors | Installed and built on EAS Android already |
| react-native-fast-tflite | ^2.0.0 (installed; registry latest 3.0.1, Nitro migration Apr 2026) | TFLite inference | Installed |
| react-native-worklets-core | ^1.6.x (registry 1.6.3) | Required by VisionCamera v4 frame processors | MISSING from `apps/native/package.json`; verify in gate (see Pitfall 1) |
| vision-camera-resize-plugin | ^3.2.0 | Resize/convert frame to model input tensor | Standard companion for fast-tflite pose pipelines (MEDIUM confidence; verify compatibility in gate) |
| react-native-sse | 1.2.1 | EventSource polyfill with custom headers, POST-capable, reconnect | Satisfies D-05 (headers) with RN-friendly implementation |
| fflate | 0.8.3 | gzip on device (RN has no `CompressionStream`) | Small, pure JS, fast, typed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-native-sse | @microsoft/fetch-event-source 2.0.1 | Designed for browsers; relies on `fetch` streaming/`document` visibility APIs that RN's fetch (no response body streaming by default) does not support. Prefer react-native-sse (XHR-based) |
| fflate | pako 3.0.2 | Larger, slower; fflate is enough |
| Redis pub/sub | BullMQ `QueueEvents` | QueueEvents only sees job lifecycle, not custom stage progress; D-10 locks pub/sub |

**Installation:**
```bash
yarn workspace native add react-native-sse fflate        # check actual workspace name in apps/native/package.json
yarn workspace native add react-native-worklets-core vision-camera-resize-plugin   # only if gate confirms needed
```
No new API dependencies. Run `yarn deps:fix` afterwards; Knip needs each dep declared in the workspace that imports it.

**Version verification (npm view, 2026-10-22):** bullmq 6.4.0, ioredis 6.0.0, react-native-sse 1.2.1, fflate 0.8.3, react-native-fast-tflite 3.0.1 (modified 2026-04-21), react-native-vision-camera 5.2.3 (modified 2026-08-20), react-native-worklets-core 1.6.3, vision-camera-resize-plugin 3.2.0. Repo is on bullmq 5.71.1.

## Architecture Patterns

### Recommended Project Structure
```
packages/common/src/validations/
  poseCapture.ts        # capture payload schema + caps constants; ProcessingStatusEvent schema
  analysisProgress.ts   # stage enum + stage->range table + pure progressPercent() (shared by API and native)
apps/api/src/
  lib/queue.ts          # renamed queue + AnalysisJobData {sessionId, captureId}
  lib/redis.ts          # + createRedisSubscriber() helper (duplicate())
  lib/progressBus.ts    # publish(sessionId, event) / subscribe(sessionId, cb) over one shared subscriber
  workers/analysisWorker.ts   # Worker + processor (stub in Phase 1; Phase 5 fills LLM)
  workers/reaper.ts           # scheduler registration + processor
  services/poseCaptureService.ts / analysisJobService.ts
  controllers/workoutSession.ts  # + submitCapture, streamStatus, retryAnalysis
  routes/workoutSession.ts
apps/native/src/api/ + hooks/   # useAnalysisStatus (react-native-sse), gzip upload
```

### Pattern 1: Queue, Worker, retries (BullMQ 5.x)
**What:** Queue defaults `attempts: 3`, `backoff: { type: "exponential", delay: 2000 }` (waits 2s, 4s). Worker on its own connection; on final failure mark session FAILED in the `failed` event handler (check `job.attemptsMade >= job.opts.attempts` or `UnrecoverableError`).
**Example:**
```typescript
// Source: https://docs.bullmq.io/guide/retrying-failing-jobs , /patterns/stop-retrying-jobs
import { Worker, UnrecoverableError } from "bullmq";
const worker = new Worker<AnalysisJobData>(
  ANALYSIS_QUEUE,
  async (job) => {
    const log = logger.child({ jobId: job.id, sessionId: job.data.sessionId });
    // ... load capture, set stage, publish progress
    if (lowConfidence) throw new UnrecoverableError("LOW_KEYPOINT_CONFIDENCE");
  },
  { connection: workerConnection, concurrency: 2 },
);
worker.on("failed", (job, err) => {
  const final = job && (job.attemptsMade >= (job.opts.attempts ?? 1) || err instanceof UnrecoverableError);
  if (final) void failSession(job.data.sessionId, err); // guarded transition PROCESSING->FAILED
});
```
Notes: BullMQ's `UnrecoverableError` moves straight to failed, overriding attempts. Worker connection: pass `redisConnection.duplicate()` or connection options; Worker uses blocking commands and requires `maxRetriesPerRequest: null` (already set). Queue and Worker may share the existing connection but a dedicated one for the Worker is safer.

### Pattern 2: Capture endpoint (INFRA-02)
Flow: auth -> validate -> in one service call: verify session belongs to user, status PENDING else `ConflictError` (D-17); insert `PoseCapture`; guarded `updateMany({ where: { id, processingStatus: PENDING }, data: { processingStatus: PROCESSING, processingStartedAt: now } })` (count 0 -> 409, closes the double-submit race); `queue.add(name, {sessionId, captureId}, { jobId })`; respond 202 `{ jobId, ... }`. Do NOT do compression of the stored blob work beyond a single `zlib.gzipSync`/async `gzip` of already-validated JSON (or store the client's gzip bytes directly if validated; simplest: decompress by middleware, validate, re-gzip with `zlib.gzip` async to store as `Bytes`).
- Body parsing: `express.json({ limit: "10mb" })` in `app.ts` runs globally and body-parser 2.x already inflates `Content-Encoding: gzip` (`inflate: true` default); the `limit` applies to the inflated size. A 25-60 KB compressed set is likely a few hundred KB to ~1 MB of JSON. Enforce the ~1 MB COMPRESSED cap (D-04) with a small middleware before the parser that rejects `Content-Length` > cap with 413 (check header; chunked uploads without Content-Length are still bounded by the 10 MB inflated limit). Consider setting a lower inflated limit specifically for the capture route by mounting a route-level parser before the global one only if the planner wants tighter bounds. Note: a gzip bomb is bounded by the inflated limit.
- Set `processingStatus` to PROCESSING at enqueue vs when the worker picks the job: D-06 says status QUEUED/PROCESSING are job-record states while the state machine is PENDING -> PROCESSING -> COMPLETED|FAILED. Recommended: session goes PROCESSING at capture time (matches docs/architecture.md step 4); QUEUED is a job stage persisted on the job record (not a SessionStatus value). The reaper clock must then start at enqueue, so `processingStartedAt` is set at capture time. Flag this for the planner (Open Question 2).
- Persist job record: add columns to `WorkoutSession` (or a small `AnalysisJob` table): `stage`, `stageProgress`(optional sub-progress), `bullmqJobId` exists already, `failureReason` exists. Keeping them on `WorkoutSession` avoids a new table; D-06 says "persisted on the job record" so either works; choose one and say so in the plan.

### Pattern 3: SSE over Express 5 + Redis pub/sub
```typescript
// Source: standard SSE; Express 5 docs
res.status(200).set({
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
});
res.flushHeaders();
const send = (e: StatusEvent) => res.write(`event: status\ndata: ${JSON.stringify(e)}\n\n`);
const unsubscribe = progressBus.subscribe(sessionId, (e) => { send(e); if (isTerminal(e)) end(); });
send(await service.getCurrentStatusEvent(userUuid, sessionId)); // D-09: read AFTER subscribing to avoid a gap
const hb = setInterval(() => res.write(": ping\n\n"), 15_000);
req.on("close", () => { clearInterval(hb); unsubscribe(); });
```
- Subscribe first, then read DB state, then emit; dedupe/ignore events with lower percent (monotonic) to avoid the subscribe/read race.
- One shared subscriber connection (`redisConnection.duplicate()`), `subscribe` a channel `analysis:{sessionId}` on first listener, `unsubscribe` on last; a subscriber-mode connection cannot run normal commands, hence the duplicate. Publisher can use the main connection.
- Ownership: the status route must check the session belongs to `req.user` (404 for others) before streaming.
- Compression middleware (none present) would buffer SSE; do not add it, or exclude `text/event-stream`.
- `pino-http` is mounted; make sure the long-lived response does not break logging (fine).
- Client: `react-native-sse` `new EventSource(url, { headers: { Authorization: "Bearer ..." } })`; on `error` event refresh the token if 401 and reconnect; it reconnects by itself. Close on terminal event.

### Pattern 4: State machine
Single place (`workoutSessionService` or new `analysisJobService`) with guarded transitions using `updateMany` + `where: { processingStatus: <expected> }` and checking `count`. Allowed: PENDING->PROCESSING, PROCESSING->COMPLETED, PROCESSING->FAILED, FAILED->PROCESSING (retry endpoint, D-16). Everything else is rejected. Worker success path writes COMPLETED and the stage together in one transaction. Stage/percent: `progressPercent(stage, sub?)` pure function in `@repo/common` (D-07/D-08); percent is never stored, only `stage` (+ optional sub-progress) is. Monotonic guarantee: clamp via the table; FAILED returns percent of last persisted stage so keep `stage` untouched on failure and set `failureReason`.

### Pattern 5: Reaper (D-14, INFRA-04 criterion 4)
```typescript
// Source: https://docs.bullmq.io/guide/job-schedulers
await queue.upsertJobScheduler("reap-stuck-processing", { every: 30_000 }, { name: "reap", opts: { removeOnComplete: true, removeOnFail: 50 } });
// worker routes job.name === "reap" to the reaper:
await prisma.workoutSession.updateMany({
  where: { processingStatus: "PROCESSING", processingStartedAt: { lt: new Date(Date.now() - env.analysis.stuckTimeoutMs) } },
  data: { processingStatus: "FAILED", failureReason: "TIMEOUT", processingFinishedAt: new Date() },
});
```
Then publish a FAILED event for each reaped session (select ids first) so connected clients end. Also remove/ignore the BullMQ job (a late-finishing worker must not flip FAILED->COMPLETED: the worker's success write must be guarded `where: { processingStatus: PROCESSING }`; if count 0, discard the result).
Timing budget: 3 attempts x 45 s LLM timeout + backoff (2s + 4s) = 141 s of worst case plus compute, leaving < 40 s margin to 180 s. Recommend LLM timeout 40 s, backoff delay 2000 ms (waits 2s, 4s), so worst case ~126 s + metrics; enforce at env-parse time that `stuckTimeoutMs > attempts*llmTimeout + total backoff + margin` (a Zod `.refine`) so D-13 cannot be violated by config. Alternatively treat the stuck timeout as per-attempt-start (reset `processingStartedAt` on each attempt) - flag for planner; simpler is the refine.
Same worker process handles both queue job names, or use a separate small queue for maintenance (cleaner: `maintenanceQueue`). Either way a 30 s scheduler interval is fine.

### Anti-Patterns to Avoid
- Awaiting the LLM or metrics in the request handler.
- Storing progress percent in the DB (violates D-07).
- Reusing the shared `redisConnection` for `subscribe()` (it would enter subscriber mode and break BullMQ/publish).
- Using the deprecated `queue.add(..., { repeat })` for the reaper; use `upsertJobScheduler`.
- Using `setInterval` for the reaper or `console.log` in API code (project rules).
- Logging through bare `logger` inside the worker; use `logger.child({ jobId, sessionId })`.
- Declaring workers/queues at module top-level in a way that makes unit tests connect to Redis (`redisConnection` is created on import; unit tests must mock `lib/redis` and `lib/queue` as `shutdown.test.ts` does).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Retry/backoff | custom retry loop | BullMQ `attempts` + `backoff` + `UnrecoverableError` | Atomic, survives restarts |
| Repeating reaper | `setInterval`/cron | `upsertJobScheduler` | Idempotent across restarts/instances, D-14 |
| Multi-instance fan-out | in-memory emitter map | Redis pub/sub (D-10) | Works with >1 API instance |
| gzip on device | custom encoder | `fflate.gzipSync` | RN has no CompressionStream |
| Request gzip decode | manual zlib on body | body-parser `inflate` (default) | Already in `express.json` |
| SSE client with headers | custom XHR parser | `react-native-sse` | Reconnect, header support |
| Pagination/date parsing | new helpers | existing `lookAheadTake`/`paginate`, `parseOptionalDate` | Project rule |

## Runtime State Inventory

> This phase includes a migration (dropping `video*` columns, renaming the queue), so the inventory applies.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `workout_sessions.video_*` columns (duration, fps, width, height, size_bytes, r2_key) and `bullmq_job_id`; `createWorkoutSessionSchema.videoMeta` in `@repo/common`; `createSession` writes `videoMeta`. Existing dev/test rows may have values (likely null) | Prisma migration dropping columns (data loss acceptable: video path was never live; confirm no prod data). Code edit: remove `videoMeta` from schema, service, OpenAPI, tests |
| Live service config | Redis holds the BullMQ queue under name `video-analysis` (prefix `bull:video-analysis:*`). Any stale jobs with `r2Key` payload would be orphaned/mismatched after rename | Flush or drain old queue keys in dev; production has none (queue never had a worker). Document `redis-cli --scan --pattern 'bull:video-analysis:*'` cleanup |
| OS-registered state | None - verified: no pm2/Task Scheduler/launchd registrations in repo | None |
| Secrets/env vars | `R2_*` vars remain (avatars). New vars: `ANALYSIS_STUCK_TIMEOUT_MS`, `ANALYSIS_LLM_TIMEOUT_MS`, `ANALYSIS_MAX_ATTEMPTS`, capture caps | Add to `env.ts` AND `tests/unit/helpers/unitEnv.ts`; `tests/unit/config/env.test.ts` enforces sync; also CI workflow env block and `.env.example` |
| Build artifacts | Prisma generated client (`yarn workspace @repo/db db:generate`) must be rerun; `apps/native/android` prebuild folder exists (committed or generated - check) and will need `expo prebuild` regeneration if `app.json` plugins change; EAS builds cache native deps | Regenerate Prisma client; new EAS dev build after adding worklets-core / plugin changes |

## Common Pitfalls

### Pitfall 1: Frame processors need worklets-core (VisionCamera v4)
**What goes wrong:** `useFrameProcessor` fails or crashes at runtime/Babel. `package.json` has Reanimated 4's `react-native-worklets 0.5.1` but not `react-native-worklets-core`, and `babel.config.js` only has `babel-preset-expo`.
**Why:** VisionCamera 4 uses Margelo's worklets-core (own babel plugin `react-native-worklets-core/plugin`); Reanimated 4's worklets package is separate and both plugins may contend for the `"worklet"` directive.
**How to avoid:** Early gate task: add worklets-core + plugin, build on EAS Android, run a trivial frame processor; if plugin conflict appears, evaluate vision-camera 5.x/fast-tflite 3.x (Nitro based; peer deps are `react-native-nitro-modules`, plus `react-native-nitro-image` for camera) instead of fighting 4.x. LOW-MEDIUM confidence: I did not verify worklets compatibility details for v5 - check https://react-native-vision-camera.com docs at task time.
**Warning signs:** "Failed to create a worklet", `Frame Processors are disabled`, red screen on camera mount.

### Pitfall 2: expo-doctor flag on fast-tflite + New Architecture
STATE.md already notes it; `newArchEnabled: true` in app.json. fast-tflite 2.x claims New Arch support since 1.6; 3.x targets bridgeless explicitly. The gate resolves it.

### Pitfall 3: Express global `express.json({limit:"10mb"})` ordering
A route-level cap cannot loosen/tighten beyond the global parser because it runs first. Do the Content-Length check as an earlier middleware on that route path or accept the global limit.

### Pitfall 4: SSE through proxies/Android
Proxies buffer without `X-Accel-Buffering: no`; idle timeouts (e.g. 60 s on load balancers) need the heartbeat. Android `react-native-sse` is XHR-based and delivers events incrementally; verify on device, not just in unit tests.

### Pitfall 5: Race between subscribe and DB read (D-09)
Read-then-subscribe loses events emitted in between. Subscribe first, then read, then dedupe by non-decreasing percent/terminal state.

### Pitfall 6: Late worker write after reaper
Guard all terminal writes by expected prior status and treat count 0 as "discard".

### Pitfall 7: Unit test isolation
Importing `lib/queue` or `lib/redis` creates live ioredis connections (retry noise, hangs with Docker stopped). Mock them in unit tests; keep the worker's processor a pure-ish function with injected deps so it can be tested with `createPrismaMock()`. `shutdown.test.ts` must be extended for worker/subscriber close order: server -> worker.close() -> queue.close() -> subscriber.quit() -> redis.quit() -> prisma.

### Pitfall 8: Integration tests and Redis
Integration suite runs against Postgres :5433; CI has a Redis 7 service. For capture-endpoint integration tests, either use real Redis (available locally/CI) with queue cleanup in `beforeEach`, or mock only the queue `add` at the module boundary. Recommend: real Redis, obliterate queue in `afterAll`; and the worker tested separately by running a Worker in-process with a stub processor.

### Pitfall 9: Prisma migration with Prisma 7
Dropping columns + adding `PoseCapture` + `AnalysisResult` relation: use `prisma migrate dev --name ...` against :5434; `tests/globalSetup.ts` applies migrations to the test DB. `keypoints` is `Bytes` -> `Buffer`. `Decimal`/`BigInt` columns being removed also removes BigInt serialization issues in OpenAPI.

## Code Examples

### Shared progress mapping (pure, in `@repo/common`)
```typescript
export const STAGES = ["QUEUED", "ANALYZING_REPS", "WRITING_FEEDBACK", "COMPLETED"] as const;
const RANGES = { QUEUED: [0, 5], ANALYZING_REPS: [10, 60], WRITING_FEEDBACK: [60, 95], COMPLETED: [100, 100] } as const;
export const progressPercent = (stage: Stage, sub?: number): number => {
  const [lo, hi] = RANGES[stage];
  if (stage === "COMPLETED") return 100;
  const f = sub === undefined ? 0 : Math.min(1, Math.max(0, sub));
  return Math.min(Math.round(lo + (hi - lo) * f), 99);
};
```
Gap 5-10 should be avoided: make ranges contiguous (QUEUED 0-10) so FAILED/percent never jumps; planner finalizes.

### Capture payload schema (shape)
```typescript
export const CAPTURE_LIMITS = { maxCompressedBytes: 1_048_576, maxFrames: 3600, maxDurationSec: 180 } as const;
export const poseCaptureSchema = z.object({
  version: z.literal(1),
  poseModel: z.object({ name: z.string().max(40), version: z.string().max(20) }),
  fps: z.number().min(5).max(60),
  frameCount: z.number().int().min(1).max(CAPTURE_LIMITS.maxFrames),
  durationSec: z.number().positive().max(CAPTURE_LIMITS.maxDurationSec),
  cameraView: z.string().max(20).optional(),
  frames: z.array(z.object({ t: z.number().min(0), kp: z.array(z.tuple([z.number(), z.number(), z.number()])).min(17).max(33) })).max(CAPTURE_LIMITS.maxFrames),
}).refine((v) => v.frames.length === v.frameCount);
```
Numbers are suggestions (a 60 s set at 15 fps = 900 frames x 17 kp). Reasonable: 20-60 s typical; cap 180 s, 3600 frames. Compare against the 500 ms target: Zod validation of ~900x17 tuples is a few ms-tens of ms; `gzip` async of < 1 MB is ~10-30 ms; fine. Use `z.array(...)` over `.strict()` objects for speed if profiling shows need.

### Dev build gate: eas.json iOS simulator profile
```json
"development-simulator": {
  "extends": "development",
  "ios": { "simulator": true }
}
```
Build with `eas build --profile development-simulator --platform ios` from `apps/native` (builds on EAS macOS workers, no Apple account needed for simulator builds; verify no credentials prompt). Camera does not exist in the simulator; compile success is the only gate (D-18). Note the existing `development` profile already declares `android.buildType: apk`.

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `queue.add(name, data, { repeat })` | `upsertJobScheduler` (BullMQ >= 5.16) | Use for reaper |
| fast-tflite 2.x / vision-camera 4.x (JSI/worklets-core) | fast-tflite 3.x / vision-camera 5.x (Nitro Modules) | Possible fallback/upgrade path if gate fails; not default |
| Browser EventSource | `react-native-sse` | Headers needed (D-05) |

## Open Questions

1. **Does worklets-core coexist with Reanimated 4 / react-native-worklets 0.5.1 on SDK 54 New Arch?**
   - Known: worklets-core absent today; Android build succeeded without exercising frame processors.
   - Unclear: plugin conflict; whether vision-camera 5 removes the need.
   - Recommendation: first native task; timebox; fall back to 5.x/3.x upgrade evaluation.
2. **When does `processingStatus` become PROCESSING: at capture accept or when the worker starts?**
   - Recommendation: at capture accept (matches architecture doc, reaper covers queue-stall), with QUEUED as a persisted stage. Planner to confirm; D-17 (409 unless PENDING) assumes this.
3. **Where to persist stage/sub-progress (columns on WorkoutSession vs `AnalysisJob` table)?** Recommend columns on `WorkoutSession` (`analysisStage`, `analysisStageProgress`) for Phase 1 simplicity.
4. **Retry endpoint shape (D-16):** suggest `POST /api/sessions/:id/analysis/retry` returning 202; only from FAILED; reuses latest PoseCapture; resets stage to QUEUED.
5. **Should worker run in the API process or separate entrypoint?** Recommend separate exportable `startWorker()` invoked from `index.ts` for now (one deploy unit), structured so a `worker.ts` entrypoint can split later. Hosting for production Redis still unconfirmed (STATE.md).
6. **Pose-model gate protocol:** shot list (planner): push-up bottom (side view, ~45 deg front-side), pull-up top (front/back + side), dip (side), squat (side + 45 deg), each 3 clips x 5 reps, indoor lighting + one dim. Metrics: per-joint mean confidence and detection rate (confidence >= 0.3) for the exercise's key joints (push-up: shoulders, elbows, wrists, hips, ankles; pull-up: wrists, elbows, shoulders, nose/chin proxy; dip: shoulders, elbows, wrists, hips; squat: hips, knees, ankles, shoulders). Run offline (Python/TFLite on desktop with both models) for speed, then confirm the winner on device. Threshold suggestion: key-joint detection rate >= 90% and mean confidence >= 0.5 -> MoveNet (lighter) wins. The 33-point candidate (BlazePose) has no official fast-tflite recipe - confirm model file source and license at task time (LOW confidence).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4 (two projects: unit, integration) + Supertest |
| Config file | `apps/api/vitest.config.ts` |
| Quick run command | `yarn workspace api test:unit` |
| Full suite command | `yarn workspace api test` (needs Postgres :5433 and Redis) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-01 | Worker processes job, retries then fails, UnrecoverableError skips retry | unit (processor with mocks) + integration (real Redis) | `yarn workspace api test:unit -t worker` | Wave 0 |
| INFRA-02 | 202 + jobId, Zod caps (413/400), 409 when not PENDING, ownership 404 | integration | `yarn workspace api test:integration capture` | Wave 0 |
| INFRA-02 | Capture service exact Prisma call shapes, guarded updateMany | unit | `yarn workspace api test:unit -t poseCaptureService` | Wave 0 |
| INFRA-03 | SSE emits current state first, terminal closes, 401 without token, transitions QUEUED->PROCESSING->COMPLETED | integration (supertest stream or http client) | `yarn workspace api test:integration status` | Wave 0 |
| INFRA-03 | progressPercent monotonic/ranges/interpolation (D-08) | unit (`@repo/common` or api) | `yarn workspace api test:unit -t progress` | Wave 0 |
| INFRA-04 | Valid/invalid transitions; reaper fails sessions older than timeout (fake timers); late worker write discarded | unit + integration | `yarn workspace api test:unit -t reaper` | Wave 0 |
| INFRA-04 | env refine: stuck timeout > retry budget | unit | `yarn workspace api test:unit -t env` | exists (extend) |
| INFRA-05 | Android: app launches, model loads, pose pass on test image; iOS simulator build compiles | manual (device/EAS) | `eas build --profile development-simulator --platform ios` | manual-only: needs hardware/EAS |
| Gate | MoveNet vs 33-pt decision logged | manual + offline script | n/a | manual-only |

### Sampling Rate
- Per task commit: `yarn workspace api test:unit`, `yarn lint`, `yarn check-types`
- Per wave merge: `yarn workspace api test`, `yarn format:check`, `yarn knip`, `yarn deps:lint`
- Phase gate: full suite green plus recorded Android gate evidence before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/helpers/` - fake BullMQ `Job` factory; progress bus mock
- [ ] `tests/integration/helpers` - Redis queue cleanup; SSE reader helper (http.get with streaming)
- [ ] Update `tests/unit/lib/shutdown.test.ts` and `unitEnv.ts` for new modules/vars
- [ ] Update existing `createWorkoutSession` integration tests and OpenAPI after removing `videoMeta`

## Sources

### Primary (HIGH confidence)
- Context7 `/websites/bullmq_io` - job schedulers (`upsertJobScheduler`), `UnrecoverableError`, exponential backoff
- Repo files: `apps/api/src/lib/{queue,redis,shutdown}.ts`, `app.ts`, `workoutSession` route/service, `workout-session.prisma`, `eas.json`, `app.json`, `apps/native/package.json`, CI workflow, `docs/architecture.md`, `docs/data-model.md`
- npm registry (`npm view`) for versions listed above

### Secondary (MEDIUM confidence)
- GitHub releases page for react-native-fast-tflite (v3.0.0/3.0.1 Nitro migration, New Arch/bridgeless)
- react-native-sse README (header support confirmed via npm readme)

### Tertiary (LOW confidence)
- VisionCamera v4 requirement for react-native-worklets-core and its coexistence with Reanimated 4 worklets (from training knowledge; not verified this session)
- vision-camera-resize-plugin 3.2.0 compatibility with vision-camera 4.7.3
- 33-point model sourcing for TFLite
- body-parser applying `limit` to the inflated stream (training knowledge; verify with a quick integration test of an oversized gzip body)

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM - API HIGH, native frame processor stack LOW-MEDIUM
- Architecture: HIGH - follows locked decisions and existing conventions
- Pitfalls: MEDIUM - worklets and body-parser limit behavior need confirmation

**Research date:** 2026-10-22
**Valid until:** 2026-11-05 for native stack (fast-moving); 2026-11-22 for API patterns
