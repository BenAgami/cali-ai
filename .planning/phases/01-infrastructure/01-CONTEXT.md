# Phase 1: Infrastructure - Context

**Gathered:** 2026-10-22
**Status:** Ready for planning

<domain>
## Phase Boundary

The async analysis pipeline (on-device keypoints in, no video), the session state machine, and the custom Expo dev build are in place, so every AI feature that follows sits on a correct, non-blocking foundation. Covers INFRA-01 to INFRA-05. Form scoring, LLM prompts and the camera UI belong to Phase 5.

Already built (see STATE.md): `processingStatus` enum, BullMQ `videoAnalysisQueue`, Redis connection, R2 client (avatars only), Android EAS dev build with vision-camera + fast-tflite plugins.

</domain>

<decisions>
## Implementation Decisions

### Capture payload and storage
- **D-01:** The phone sends keypoints as gzip-compressed JSON. The payload carries a `version` field so a binary format can replace it later without breaking clients.
- **D-02:** The server stores one `PoseCapture` row per capture, holding the whole set as a single compressed blob plus metadata (pose model name/version, fps, frame count, etc., per `docs/data-model.md`). No per-frame rows.
- **D-03:** Drop the obsolete video fields in a Phase 1 migration: `videoR2Key` and the other `video*` columns on `WorkoutSession`, and `r2Key` in `VideoAnalysisJobData`. Job data becomes `sessionId` + `captureId`. Update `apps/api/src/openapi/schemas.ts`, `queue.ts`, and affected tests together. Rename `videoAnalysisQueue` to match the new purpose (planner decides the name).
- **D-04:** `POST /api/sessions/:id/capture` enforces hard caps: a maximum compressed body size (about 1 MB) and plausible frame count/duration limits, validated by Zod in `packages/common`. Exact numbers are the planner's call. Success target remains 202 with a job ID in under 500 ms.

### SSE stream (`GET /api/sessions/:id/status`)
- **D-05:** Auth uses the existing Bearer JWT middleware. The native client uses a fetch-based SSE client, because the built-in EventSource cannot send headers.
- **D-06:** Events carry `status` (QUEUED, PROCESSING, COMPLETED, FAILED), `stage_label` (e.g. "analyzing reps", "writing feedback") and `progress_percent`. Status and stage label are persisted on the job record and are the source of truth; they are the only states the state machine moves through.
- **D-07:** `progress_percent` is derived from the persisted stage via one stage-to-range table in a single place (e.g. QUEUED 0-5, analyzing reps 10-60, writing feedback 60-95, COMPLETED 100). Optional sub-progress (rep 3 of 10) interpolates within the stage's range; otherwise the stage's lower bound is used. Percent never decreases; FAILED keeps the last reached percent; only COMPLETED reports 100. A client reading after reconnect gets the same value as a live subscriber.
- **D-08:** Tests: unit-test the stage-to-percent mapping as a pure function (ranges, monotonicity, interpolation). Integration tests assert stage transitions, not exact percent values.
- **D-09:** On connect (including reconnect), the server reads the current state from Postgres and emits it first. If the state is terminal (COMPLETED or FAILED) it sends that and closes. No event history is stored and Last-Event-ID replay is not used.
- **D-10:** The worker publishes progress via Redis pub/sub per session, and the API instance holding the connection forwards it. This works with more than one API instance.

### Failure, retry and reaper
- **D-11:** Jobs get 3 attempts with exponential backoff (BullMQ-native). The session becomes FAILED only after the last attempt. Non-retryable errors (e.g. keypoint confidence too low) skip retries.
- **D-12:** Each LLM attempt has a hard timeout (about 45 s as a starting point; planner confirms).
- **D-13:** The stuck-PROCESSING timeout is **3 minutes**, not the 10 minutes in the original roadmap, because a user will not wait 10 minutes. It is a config constant (via `apps/api/src/config/env.ts`), and must stay above the worst-case retry budget so a job isn't reaped while legitimately retrying.
- **D-14:** The reaper is a BullMQ repeatable job that marks PROCESSING sessions older than the timeout as FAILED. No separate cron or `setInterval`.
- **D-15:** The phone shows the stage label and percent while the user waits. Results are persisted, so the user can leave and see them later. No extra "taking longer than usual" client state.
- **D-16:** After a FAILED analysis, retry re-enqueues from the stored capture via a retry endpoint. The phone does not resend keypoints.
- **D-17:** A capture for a session that is not PENDING (i.e. already PROCESSING or COMPLETED) is rejected with 409 Conflict. FAILED sessions go through the retry path (D-16).

### Dev-build and pose-model gate
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

</decisions>

<specifics>
## Specific Ideas

- "10 minutes is way too long for the user waiting for a response" drove the 3-minute timeout.
- Keep the percent derived from persisted state, never stored independently.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture and data
- `docs/architecture.md` - Pipeline design, request flow, worker steps, open decisions (payload format now settled by D-01)
- `docs/data-model.md` - `PoseCapture`, `AnalysisResult` and related entities
- `docs/features.md` - Feature scope
- `docs/vision.md` - Product vision

### Planning
- `.planning/ROADMAP.md` - Phase 1 goal and success criteria (criterion 4 timeout and criterion 5 iOS wording need updating per D-13, D-18)
- `.planning/REQUIREMENTS.md` - INFRA-01 to INFRA-05
- `.planning/STATE.md` - What is already built, blockers, open decisions
- `.planning/codebase/ARCHITECTURE.md`, `CONVENTIONS.md`, `STACK.md`, `STRUCTURE.md`, `TESTING.md`, `CONCERNS.md` - Existing code patterns
- `CLAUDE.md` - API conventions (three-tier, Zod at boundaries, pino child logger per job, env via Zod, unit-test layout)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/api/src/lib/queue.ts`: existing BullMQ queue; `VideoAnalysisJobData` still has `r2Key` and must change (D-03)
- `apps/api/src/lib/shutdown.ts`: closes the queue on shutdown; extend for the worker and subscriber connections
- `apps/api/src/services/workoutSessionService.ts`: creates sessions as PENDING; home for state transitions
- `apps/api/src/openapi/schemas.ts`: `videoR2Key` at line ~303 to remove
- `packages/database/prisma/models/workout-session.prisma`: `processingStatus` and `videoR2Key` columns
- `apps/api/src/lib/logger.ts` and `utils/toError.ts`: required for job logging via `logger.child({ jobId, sessionId })`

### Established Patterns
- Route -> controller -> service -> Prisma; Zod schemas in `packages/common/src/validations/`; shared response shapes defined once in `@repo/common`
- Env vars validated in `apps/api/src/config/env.ts`; add new ones (timeouts, caps) there and to `tests/unit/helpers/unitEnv.ts`
- Unit tests need no DB; integration tests use Postgres on :5433

### Integration Points
- New `POST /api/sessions/:id/capture` and `GET /api/sessions/:id/status` routes on the sessions router
- Prisma migration for `PoseCapture` and removal of video columns
- `apps/native/eas.json` for the iOS simulator profile

</code_context>

<deferred>
## Deferred Ideas

- Quantized binary keypoint format - revisit if upload size or storage cost becomes a problem (version field in D-01 keeps the door open)
- Real iOS runtime verification - needs a Mac or iPhone; revisit before iOS release
- Client-side "taking longer than usual" state - add only if users report confusion

</deferred>

---

*Phase: 01-infrastructure*
*Context gathered: 2026-10-22*
