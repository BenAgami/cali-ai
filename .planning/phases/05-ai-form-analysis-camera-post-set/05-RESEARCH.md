# Phase 5: AI Form Analysis (Camera + Post-Set) - Research

**Researched:** 2026-11-08
**Domain:** On-device BlazePose capture (vision-camera), deterministic rep/form metrics from 2D keypoints, structured LLM coaching text, in-app result/notification UX
**Confidence:** MEDIUM overall (stack and pipeline integration HIGH; rubric thresholds LOW-MEDIUM, they are starting values to calibrate; on-device BlazePose wiring MEDIUM until the Wave 0 spike passes)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** The "record this set?" offer appears per set, at the start of each set of a supported exercise (push-up, pull-up, dip, squat), next to the normal Done action in `workout-execute.tsx`. Declining logs the set normally with no analysis.
- **D-02:** A recorded set ends when the user taps Stop (also auto-stops at the Phase 1 duration cap). Keypoints are submitted immediately on stop. Auto-detect end of motion is deferred.
- **D-03:** Before recording, the user sees the camera preview with a framing guide and a countdown (about 5-10 s; planner sets exact length) so they can get into position.
- **D-04:** Start is blocked until the live pose pass detects the body with enough confident keypoints; the user is told what is wrong (out of frame, too dark). Exact thresholds are the planner's call.
- **D-05:** The band is a labeled badge with a color scale (Excellent / Good / Fair / Needs work / Poor, green to red). Color is always paired with the text label.
- **D-06:** The 3 dimensions (range of motion, core stability, symmetry) show as three rows, each with its own band chip in the same 5-level vocabulary. No numeric scores shown.
- **D-07:** Feedback text is a "What went well" block followed by up to 2 "Fix this" cards, each citing specific reps with a short cue.
- **D-08:** Results live on the set inside that workout's detail, plus a deep link from the notification. No new tab; history and trends stay in Phase 7.
- **D-09:** After Stop, the user returns to the workout. The set shows an "Analysing..." row with stage label and percent (reuses `useAnalysisStatus`); rest timer and next set continue.
- **D-10:** On completion an in-app banner/toast with a "View feedback" action appears wherever the user is, plus a badge on the set (NOTF-02). OS push for a backgrounded app is not part of this phase.
- **D-11:** A failed analysis shows inline on the set with a plain message and a Retry button that calls the existing retry endpoint (stored capture, no resend).
- **D-12:** When the body cannot be tracked (FORM-09), no band is shown; the user gets specific tips derived from the cause (framing, light, per-exercise angle hint) and a "Record again" action. This is not treated as a failed analysis.
- **D-13:** Per-exercise rubrics (error tags, thresholds, detectability) are drafted by phase research from biomechanics sources and reviewed by the user in the plan before execution. Resolves the STATE.md open decision.
- **D-14:** Coaching tone is encouraging, concise, second person ("Your depth was solid..."); one actionable cue per correction; no joint-angle jargon or medical claims.
- **D-15:** Bands are level-agnostic: the same bar for everyone, so the stored 0-100 score stays comparable over time. Feedback wording may adapt to fitness level.
- **D-16:** Consent reuses the Phase 4 AI consent gate (`assertAiPrerequisites`, 428) and notice, with form-analysis wording added: pose keypoints and height/weight go to the LLM provider; no video leaves the phone (PROF-07).

Roadmap-fixed (not re-asked): 5-level band; 0-100 score stored but never shown per set; positives before corrections; max 2 corrections per set; failure shows retry; untrackable body shows camera advice.

### Claude's Discretion
- Countdown length, confidence thresholds for the live setup check, framing-guide visuals
- Exact banner/toast mechanics and badge styling
- Exact band color values (within the green-to-red scale, accessible contrast)
- Component structure for result, analysing and advice states

### Deferred Ideas (OUT OF SCOPE)
- Auto-detect end of motion (stop recording when movement ceases for a few seconds) - backlog
- OS push notification when the app is backgrounded - future
- Form history / trends view - Phase 7
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FORM-01 | User selects an exercise before recording | Workout run already fixes the exercise per set; offer only for `push_up`, `pull_up`, `dip`, `squat` (Architecture: record offer; Pitfall 9) |
| FORM-02 | Offered option to record; camera only on accept; pose starts when recording starts | Recording state machine, pose source abstraction, setup check (Patterns 1, 2; On-device section) |
| FORM-03 | Keypoints auto-submitted at set end, job ID returned | Existing `POST /sessions/:id/capture` + gzip path; quantize payload, client retry buffer (Pitfalls 3, 8) |
| FORM-04 | 5-level band; 0-100 stored not shown | Deterministic scoring + band mapping in `@repo/common` (Metrics section); do not leak `formScore` to client |
| FORM-05 | Dimension breakdown | Dimension scoring + assessability matrix (Rubrics; Open Question 1) |
| FORM-06 | Actionable text referencing reps | Per-rep metrics feed LLM; validator checks rep numbers (LLM section) |
| FORM-07 | Positives first, max 2 corrections | Server selects <=2 corrections; schema + validator enforce (LLM section) |
| FORM-08 | Notified on completion (SSE -> result) | Global analysis tracker + toast; result fetch on COMPLETED (Native section) |
| FORM-09 | Untrackable body -> camera advice | Preflight gate in worker, `UNTRACKABLE` outcome, no LLM call (Metrics section) |
| PROF-07 | Latest height/weight in LLM context; notice states it | `assertAiPrerequisites` already returns `heightCm/weightKg`; prompt + consent version bump (LLM section, Pitfall 10) |
| NOTF-02 | In-app notification on completion | `AnalysisNotificationProvider` + toast + set badge (Native section) |
</phase_requirements>

## Summary

The server pipeline from Phase 1 (capture endpoint, BullMQ worker, SSE, retry, reaper) and the Phase 4 `LlmProvider` are reusable almost as is. Phase 5 fills three seams: (1) the worker's `summarizeCapture` stub becomes a pure, versioned **metrics engine** (smoothing, rep segmentation, per-rep angles, dimension scores, band, trackability gate); (2) the `feedbackService` stub becomes a **structured-output LLM call** that only phrases coaching text for corrections the server already chose; (3) the native app gets a recording flow, an "Analysing" row, a result view, an advice view and an in-app notification tracker. The score and band are computed deterministically, never by the LLM. That keeps D-15 comparability, makes the 0-100 stable for Phase 7, and makes nearly all of the phase unit-testable with Vitest on synthetic and real skeleton fixtures.

Three findings change the plan's shape. First, **the data model has no link from a recorded set to a workout** (`WorkoutSession` has user + exercise only, `WorkoutLog` is created at the end of the run), so D-08 needs a schema change. Second, **symmetry cannot be judged from the side-on view required for push-up, dip and squat** (Phase 1 decision), so with the recommended camera views only pull-up can assess all three dimensions; this needs a user decision (Open Question 1). Third, the **on-device BlazePose pipeline** is two models (detector + landmark) with a rotated-ROI crop; `vision-camera-resize-plugin` cannot rotate, so a hand-rolled fast-tflite pipeline will not match the evaluated MediaPipe `PoseLandmarker` behaviour on horizontal poses. A time-boxed Wave 0 spike must pick between a native MediaPipe Tasks frame-processor plugin (same pipeline the Phase 1 evaluation used) and a custom fast-tflite pipeline.

**Primary recommendation:** Build the metrics engine and rubric config as pure TypeScript in the API (fixtures from the 16 evaluation clips give ground-truth rep counts), have the LLM phrase only server-selected findings, add a `workoutId`/`setNumber` link to `WorkoutSession`, and run a Wave 0 on-device spike (MediaPipe Tasks plugin first, fast-tflite two-stage as fallback) before any recording UI is built.

## Standard Stack

### Core (all already installed; versions verified in `node_modules` / npm registry 2026-11-08)

| Library | Installed | Registry latest | Purpose | Note |
|---------|-----------|-----------------|---------|------|
| react-native-vision-camera | 4.7.3 | 5.2.4 (2026-10-29, Nitro rewrite) | Camera + frame processors | Stay on v4. v5 changes the native module model; upgrading is out of scope |
| react-native-fast-tflite | 2.0.0 | 3.0.1 (2026-04-21, Nitro) | TFLite runtime in worklets | Stay on 2.x (pairs with VC4). Only needed if the fallback pose path is chosen |
| vision-camera-resize-plugin | 3.2.0 | 3.2.0 | Frame resize/crop to tensor | Supports `scale`, `crop`, `pixelFormat`, `dataType` (uint8/float32 0..1). **No arbitrary rotation** |
| react-native-worklets-core | 1.6.3 | 1.6.3 | Worklets + `Worklets.createRunOnJS` | Already used by `usePoseCheck` |
| react-native-sse | ^1.2.1 | - | SSE client | Already wrapped by `useAnalysisStatus` |
| fflate | ^0.8.2 | - | gzip of capture body | `client.ts` already does `gzipSync(strToU8(JSON.stringify(body)))` |
| @anthropic-ai/sdk | 1.4.0 | 1.6.0 (2026-11-05) | LLM calls, `messages.parse` + `zodOutputFormat` | Already used by `AnthropicProvider`; no upgrade needed |
| zod | ^4.3.6 | - | Schemas incl. structured output | Shared in `@repo/common` |
| BullMQ + Vitest 4 | existing | - | Worker + tests | Existing infra |

### Pose runtime options (decision needed in Wave 0)

| Option | What | Pros | Cons |
|--------|------|------|------|
| **B (recommended first): MediaPipe Tasks PoseLandmarker frame-processor plugin** (`react-native-mediapipe-posedetection` 0.4.0, 2026-01-20, MIT, 29 stars; or a small in-repo VC4 frame-processor plugin wrapping the official Kotlin/Swift Tasks API) | Uses the same `pose_landmarker_full.task` and the same `PoseLandmarker` VIDEO/tracking behaviour the Phase 1 evaluation (`scripts/pose-eval/evaluate.py`) measured; handles detector, rotated ROI, tracking, GPU delegate; 33 landmarks with `visibility` | Young community package; New Architecture required (app already has `newArchEnabled: true`); model passed as a bundled filename via its Expo config plugin `assetsPaths`; iOS runtime unverifiable (accepted risk); fast-tflite becomes unused for pose (INFRA-05 wording mentions it) | 
| **A (fallback): custom two-stage BlazePose on fast-tflite** | Detector (224x224, float32 in [-1,1], out `[1,2254,12]` + `[1,2254,1]`) then landmark model (256x256 float32 in [0,1], out `[1,195]` = 39 landmarks x 5 (x,y,z,visibility,presence), `[1,1]` pose flag). Tensor shapes verified locally from the bundled `.task` (zip with `pose_detector.tflite` + `pose_landmarks_detector.tflite`) | Keeps the INFRA-05 stack | Must hand-write SSD anchor decoding, NMS, ROI math, crop, and tracking; resize plugin cannot rotate the crop, so horizontal push-up/dip poses will not match the evaluated accuracy; GPU delegate op support unverified; a Google Group thread reports a React Native attempt with wrong landmarks |

**Do not** build option A unless the B spike fails on Android. If B passes, the phase should remove nothing yet (MoveNet dev screens stay until Phase 8 cleanup) but the planner must note that `react-native-fast-tflite` is then only used by the dev screen (Knip will flag nothing as long as `usePoseCheck` still imports it).

Both options must expose the same internal contract so the rest of the app is independent of the choice:

```ts
// apps/native/src/pose/types.ts
export type PoseFrame = { timestampSec: number; keypoints: [x: number, y: number, v: number][] }; // 33 entries, normalized 0..1, y down, un-mirrored
```

### Supporting (new, to add only if a task needs them)

| Library | Purpose | When |
|---------|---------|------|
| expo-keep-awake | Keep screen on while recording | Yes, recording screen (sets can exceed screen timeout). Declare in `apps/native/package.json` (Knip/syncpack) |
| expo-haptics | Countdown/start/stop feedback | Optional |
| expo-screen-orientation | Lock orientation per exercise | Only if the spike shows orientation handling needs it |

**Version verification:** run `npm view <pkg> version` before adding; use `npx expo install <pkg>` from `apps/native` so SDK 54 ranges are picked.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| LLM produces the score | Deterministic score from metrics | LLM scoring is unstable run-to-run and breaks Phase 7 trends; deterministic is testable. Chosen: deterministic |
| Toast library | Own `AnalysisNotificationProvider` + Reanimated | A banner is ~60 lines; no new dependency (reanimated 4.1 installed) |
| Peak-finding dependency | Small in-repo `findRepCycles` | No maintained TS peak-prominence library worth adding; the function is ~60 lines and is pinned by fixture tests |

## Architecture Patterns

### Recommended structure

```
packages/common/src/validations/
  formAnalysis.ts          # FORM_BANDS, bandFromScore(), FormAnalysisResponse, dimension + finding shapes, UNTRACKABLE reasons
  poseCapture.ts           # (edit) optional aspectRatio, quantizeCapture helper OR in native/api util
apps/api/src/
  metrics/
    landmarks.ts           # BlazePose index map (L_SHOULDER=11 ...)
    preprocess.ts          # confidence mask, gap fill, smoothing
    angles.ts              # 2D angle, point-line distance (isotropic coords)
    segmentReps.ts         # prominence-based cycle detection
    trackability.ts        # FORM-09 preflight
    rubrics/               # one file per exercise + index (RUBRIC_VERSION)
    computeFormMetrics.ts  # capture payload -> FormMetrics (METRICS_VERSION)
    scoring.ts             # ramps -> dimension scores -> overall -> band
  prompts/formFeedbackPrompt.ts   # FORM_FEEDBACK_PROMPT_VERSION
  services/feedbackService.ts     # orchestrates LLM call + output validation (replaces stub)
  services/formAnalysisResultService.ts   # persist/read AnalysisResult + findings
apps/native/src/
  pose/                    # PoseSource contract + chosen implementation + setupCheck.ts
  hooks/useRecordedSet.ts  # state machine
  context/AnalysisTrackerContext.tsx      # pending sessions, SSE watchers, toast
  components/form/         # BandBadge, DimensionRow, FeedbackBlocks, AnalysingRow, CameraAdvice, FramingGuide
  app/(main)/record-set.tsx
```

### Pattern 1: Recorded-set state machine (native)

`idle -> checkingPrereqs -> permission -> setupCheck -> countdown -> recording -> finalizing -> uploading -> submitted | uploadError`.
- Prerequisites are pre-checked client-side from the profile with `getMissingAiPrerequisites` (same as the generate screen), with the server's 428 from `assertAiPrerequisites` as the source of truth.
- `setupCheck` blocks "Start" until the body check passes for a continuous ~1 s (D-04). `countdown` is 8 s (inside D-03's 5-10 s); the countdown pauses and shows "Step back into frame" if the body is lost, and recording starts only when the check passes at the end.
- Frames are appended to a ref array via `Worklets.createRunOnJS` (as `usePoseCheck` does); never `setState` per frame.
- On Stop (or the auto-stop at the duration cap): build the payload, `sessionsApi.create` then `sessionsApi.submitCapture` in one chain, then call `execution.completeSet()` (starts rest) and `router.back()`. Create the `WorkoutSession` at Stop, not at record-accept, so abandoned recordings leave no PENDING rows.
- Keep the gzip bytes in memory until the upload succeeds so a network failure can show "Retry upload" without re-recording (roadmap criterion 5, D-11 only covers server-side failures).

### Pattern 2: Setup check (D-04), proposed thresholds

Over the last ~1 s (about 15 frames at 15 fps), pass when: all key joints of the exercise's visible side (see rubric) have `visibility >= 0.5` in >= 80% of frames; the landmark bounding box lies inside [0.02, 0.98] on both axes; the body's long axis spans >= 40% of the frame. Failure messages: not detected + low luma -> "Too dark, add light"; not detected + normal luma -> "Step back so your whole body is in frame"; partly clipped -> name the edge; wrong angle (shoulder-width projection large relative to torso for a side-on exercise) -> "Turn so the camera sees your side". Luma: resize the frame to 16x16 with the resize plugin and average; no new dependency.

### Pattern 3: Metrics engine (API, pure functions, versioned)

```
decodeCapture -> toIsotropic(x*aspect, y) -> maskLowConfidence(v<0.5) -> fillGaps(<=3 frames)
-> smooth(median3 then moving average 5) -> trackability gate
-> choose side (higher mean visibility of the chain) for side-on exercises
-> primary signal -> findRepCycles -> per-rep features -> rubric tags -> dimension scores -> overall -> band
```

- `METRICS_VERSION`, `RUBRIC_VERSION` constants stored in `AnalysisResult.rawFeedback` now (Phase 5.1 DATA-03 will promote them to columns).
- Coordinates: BlazePose x,y are normalized by image width/height, so angles on a non-square frame are distorted. Multiply x by `width/height` before any angle math. The capture schema has no field for this: add optional `aspectRatio` (width/height of the oriented image) to `poseCapturePayloadSchema` (`version` stays 1, optional field is backward compatible) and default to 9/16 or 16/9 from `cameraView` orientation only as a fallback. Also un-mirror front-camera frames on the client before storing.
- Rep segmentation: smooth the primary signal, compute its 5th-95th percentile amplitude, require amplitude >= a per-exercise minimum (e.g. 0.12 x torso length), then detect alternating extrema with hysteresis (prominence >= 40% of amplitude, min rep duration 0.8 s, min plateau separation 0.3 s). A rep = top -> bottom -> top. Reps with `<` 60% valid frames are dropped and counted.
- Per-rep scoring uses piecewise-linear ramps: `ramp(value, good, poor)` returns 100 at `good`, 0 at `poor`, linear between. Dimension score = mean of per-rep sub-scores (min with a 0.15 weight on the worst rep is optional). Overall = weighted mean of the assessed dimensions only (ROM 0.4, core 0.4, symmetry 0.2, renormalized when a dimension is not assessed).
- Proposed band map (single pure function `bandFromScore` in `@repo/common`, used by API and native): `>= 90 Excellent`, `75-89 Good`, `60-74 Fair`, `40-59 Needs work`, `< 40 Poor`. These are starting values; calibrate against the 16 evaluation clips plus deliberately bad takes, then adjust during the Phase 5.1 spot-check.
- FORM-09 preflight (`trackability.ts`), any of: fewer than 15 frames or duration < 3 s; mean visibility of the exercise's key joints < 0.5; key joints visible in < 70% of frames; > 10% of key-joint coordinates outside [0,1]; torso length < 12% of frame height; wrong view for the exercise; fewer than 2 reps segmented (reason `NO_REPS_DETECTED`, same advice screen). Output `{ outcome: "UNTRACKABLE", reasons: UntrackableReason[] }`, **no LLM call**, session still ends `COMPLETED` (D-12). Reasons map 1:1 to advice strings in `@repo/common`.

### Pattern 4: Worker flow replacing the stub (`analysisProcessor.ts`)

1. Existing: load capture, `advanceStage ANALYZING_REPS 0`, decode (already maps invalid to `CAPTURE_INVALID`).
2. `computeFormMetrics(payload, exercise)` (pure, CPU only, tens of ms for 3600 frames); advance `ANALYZING_REPS 1`.
3. If `UNTRACKABLE`: persist result (outcome UNTRACKABLE, no score) and `completeRun`; skip stage `WRITING_FEEDBACK`.
4. Else `advanceStage WRITING_FEEDBACK`, call `feedbackService.generateFeedback(metrics, context, signal)`, validate, persist `AnalysisResult` + `AnalysisFinding` rows in one transaction, then `completeRun` (guarded by jobId as today).
5. Retries: result writes are an upsert on `sessionId` (unique) with findings deleted and recreated, so BullMQ attempts and the D-11 retry endpoint are idempotent.
6. Load exercise code and the AI user context inside the job (`assertAiPrerequisites` at job time is wrong, consent was checked at capture; just read `heightCm/weightKg` via `bodyMetricService.getLatest`).

### Pattern 5: LLM call with AbortSignal (resolves the STATE.md `withTimeout` concern)

The Phase 4 provider already takes `signal` + `timeoutMs` with `maxRetries: 0`. For the worker: create an `AbortController` per attempt, `setTimeout(() => controller.abort(), env.analysis.llmTimeoutMs)`, clear in `finally`, pass `signal` and `timeoutMs` to `generateFormFeedback`. Map `LlmError("TIMEOUT")` to failure reason `LLM_TIMEOUT` in `toFailureReason` (today it only recognises `TimeoutError`). Keep `withTimeout` only for the enqueue in `captureService` (a BullMQ `add` cannot be cancelled), and type `TimeoutError.code` as `"ENQUEUE_TIMEOUT" | "LLM_TIMEOUT"` so a typo cannot silently never match. Keep the guarded writes regardless. `RATE_LIMITED`/`UNAVAILABLE` -> rethrow so BullMQ retries; `INVALID_OUTPUT`/`REFUSAL` -> one in-attempt repair retry, then `UnrecoverableError("ANALYSIS_ERROR")`.

### Anti-patterns to avoid
- **Letting the LLM pick the band or score.** Unstable, untestable, breaks D-15.
- **Sending raw keypoints to the LLM.** Large, costly, no better coaching. Send derived metrics only (see Open Question 4 for consent wording).
- **Per-frame React state during recording.** Use refs; one `setState` per second at most for the UI.
- **Reading `formScore` into any client response.** `workoutSessionService.listSessions` currently selects `analysisResult.formScore`; keep it out of the Zod response shapes the app consumes (FORM-04: stored, not shown).
- **Hand-rolled gzip, SSE, retry or consent screens.** All exist.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| gzip of the capture | Custom compression | `fflate` via existing `client.ts` upload | Already wired; server gunzip + size caps exist |
| Progress streaming | New polling or socket | `useAnalysisStatus` + existing SSE endpoint | Includes reconnect, terminal-close, monotonic filter |
| Retry of failed analysis | New resend flow | `POST /sessions/:id/analysis/retry` (stored capture) | D-11 |
| Consent gate | New consent logic | `assertAiPrerequisites` (428) + `AiConsentNotice` + `useAcceptAiConsent` | D-16 |
| LLM transport/error mapping | New client | `LlmProvider` / `AnthropicProvider` + `LlmError` codes | Add one method `generateFormFeedback` |
| Structured output parsing | Regex over text | `messages.parse` + `zodOutputFormat` | Already proven in Phase 4 |
| Pose model decode (option B) | Anchors/NMS/ROI math | MediaPipe Tasks `PoseLandmarker` | The pipeline that was evaluated |
| Pagination, date parsing | New helpers | `paginate`, `lookAheadTake`, `parseOptionalDate` | CLAUDE.md |
| Toast library | New dependency | ~60-line provider with Reanimated | No suitable existing UI |

**Key insight:** the only genuinely new algorithmic code is rep segmentation, angle math and the rubric thresholds, and all of it is pure and testable offline. Everything else is wiring of existing seams.

## Exercise Rubrics (DRAFT for user review, D-13)

> Confidence: the camera views and which errors are detectable from 2D landmarks are MEDIUM (Phase 1 eval + MediaPipe landmark geometry). The numeric thresholds are LOW-MEDIUM: published peer-reviewed push-up/dip/squat thresholds for 2D markerless video are scarce (searched; results were mostly coaching sources, one scapular kinematics study on pull-ups, and a systematic review finding 2D video frontal-plane measures unreliable when accuracy is required). They are conservative starting values drawn from widely used coaching standards and must be calibrated on the 16 evaluation clips plus deliberately bad takes. Treat every number as `RUBRIC_VERSION = "v0-draft"`.

**Conventions.** Landmarks: 11/12 shoulders, 13/14 elbows, 15/16 wrists, 23/24 hips, 25/26 knees, 27/28 ankles, 29/30 heels, 31/32 foot index, 0 nose, 9/10 mouth. Angles are 2D at the middle joint in isotropic coordinates. "Torso length" = shoulder-to-hip distance. `L` = shoulder-to-ankle distance. y grows downward. Side-on exercises use the **near side** (chain with higher mean visibility), matching the Phase 1 scoring rule.

### Assessability matrix (drives Open Question 1)

| Exercise | Recommended view | ROM | Core stability | Symmetry |
|----------|-----------------|-----|----------------|----------|
| push_up | side-on, phone at hip height, landscape | HIGH | HIGH (body line) | NOT ASSESSED |
| dip | side-on, landscape | HIGH | MEDIUM (trunk/swing) | NOT ASSESSED |
| squat | side-on, portrait | HIGH (depth) | MEDIUM-HIGH (trunk) | NOT ASSESSED (valgus needs front view; 2D valgus unreliable) |
| pull_up | front (or back), portrait | HIGH | LOW (swing is depth-wise, mostly invisible) | HIGH |

### push_up (side-on, near side)

Primary signal: elbow angle (shoulder-elbow-wrist), inverted. Top = lockout, bottom = deepest. Min amplitude 40 degrees.

| Tag | Dimension | Rule (per rep) | Provisional threshold | Detectability |
|-----|-----------|----------------|-----------------------|---------------|
| `PU_SHALLOW_DEPTH` | ROM | min elbow angle at bottom | flag if median > 100 deg; HIGH severity if > 120 | HIGH |
| `PU_INCOMPLETE_LOCKOUT` | ROM | max elbow angle at top | flag if < 155 deg | HIGH |
| `PU_HIP_SAG` | Core | hip below the shoulder-ankle line by > 0.06 L (mean over the rep) | 0.06 L; HIGH if > 0.12 L | HIGH side-on |
| `PU_HIP_PIKE` | Core | hip above the line by > 0.08 L | 0.08 L | HIGH side-on |
| `PU_RUSHED_TEMPO` | Core (minor) | rep duration | < 1.0 s | HIGH |
| `FATIGUE_DROP` (shared) | ROM | last 2 reps' min elbow angle worse than first 2 by > 15 deg | 15 deg | HIGH |

Not detectable (the LLM must never mention): elbow flare angle (needs front/top view), neck position, scapular movement, hand placement.

### pull_up (front or back view)

Primary signal: vertical position of the mouth landmarks (avg of 9,10) relative to the wrist line (avg of 15,16, hands on the bar), normalized by torso length. Elbow angle supplies the hang check.

| Tag | Dimension | Rule | Provisional threshold | Detectability |
|-----|-----------|------|-----------------------|---------------|
| `PL_CHIN_NOT_OVER_BAR` | ROM | at the top, mouth y not above bar (wrist) y | flag if (mouthY - barY)/torso > 0.03 | HIGH (landmark noise near the bar is the risk) |
| `PL_NO_FULL_HANG` | ROM | max elbow angle at bottom | flag if < 155 deg | HIGH |
| `PL_ASYM_PULL` | Symmetry | mean abs(left - right elbow angle) over the rep; shoulder-line tilt | flag if > 12 deg mean diff or > 8 deg tilt | HIGH front/back |
| `PL_RUSHED_TEMPO` | Core (minor) | rep duration | < 1.2 s | HIGH |
| `FATIGUE_DROP` | ROM | last 2 reps top height below first 2 | > 0.08 torso | HIGH |

Kipping/body swing is **only detectable from the side**, so it is NOT detectable in the recommended front view. Core stability for pull-up is therefore LOW; if kept as a dimension it should use only lateral sway (hip x range relative to shoulder x) and be flagged LOW confidence. Not detectable: scapular depression, grip width. Pull-up low-light has never been tested (Phase 1 gap): include in manual UAT.

### dip (side-on, near side)

Primary signal: elbow angle, inverted (same as push-up). Min amplitude 40 degrees.

| Tag | Dimension | Rule | Provisional threshold | Detectability |
|-----|-----------|------|-----------------------|---------------|
| `DIP_SHALLOW_DEPTH` | ROM | min elbow angle at bottom | flag if median > 110 deg (target about 90 or upper arm roughly parallel to floor) | HIGH |
| `DIP_EXCESSIVE_DEPTH` | ROM (safety) | min elbow angle, or shoulder y more than 0.35 upper-arm length below elbow y | < 70 deg | MEDIUM (evidence is coaching consensus, contested); keep as a soft advisory, never HIGH severity |
| `DIP_INCOMPLETE_LOCKOUT` | ROM | max elbow angle at top | < 155 deg | HIGH |
| `DIP_EXCESSIVE_LEAN` | Core | trunk angle from vertical at bottom (shoulder over hip line) | > 45 deg | MEDIUM-LOW (ideal lean is contested; coaching sources cite 20-30 deg as typical, so only flag extremes) |
| `DIP_SWING` | Core | hip x range per rep | > 0.25 torso | MEDIUM |
| `FATIGUE_DROP` | ROM | as push-up | 15 deg | HIGH |

Not detectable: shoulder protraction/shrug, scapular control (the main injury factor in coaching literature), bar width. Do not make medical or injury claims (D-14).

### squat (bodyweight, side-on, near side)

Primary signal: knee angle (hip-knee-ankle), inverted, or hip y (use hip y if the knee landmark confidence is low; squat hold l_knee was the weakest joint in Phase 1). Min amplitude 30 deg knee angle.

| Tag | Dimension | Rule | Provisional threshold | Detectability |
|-----|-----------|------|-----------------------|---------------|
| `SQ_SHALLOW_DEPTH` | ROM | at bottom, hip y above knee y by > 0.05 thigh length, or min knee angle > 110 deg | median over reps | HIGH |
| `SQ_EXCESSIVE_TRUNK_LEAN` | Core | trunk angle from vertical at bottom vs shin angle: flag if trunk leans > shin lean + 25 deg, or trunk > 60 deg | provisional; proportions (long femurs) cause legitimate lean, so keep severity MEDIUM max | MEDIUM |
| `SQ_HEEL_RISE` | Core | heel-to-toe line angle vs standing baseline (first 1 s) changes > 10 deg | 10 deg | MEDIUM (heel landmarks are noisy) |
| `SQ_INCOMPLETE_STAND` | ROM | max knee angle at top | < 160 deg | MEDIUM |
| `SQ_RUSHED_TEMPO` / bounce | Core (minor) | rep duration | < 1.0 s | HIGH |
| `FATIGUE_DROP` | ROM | as push-up (hip height at bottom) | provisional | HIGH |

Not detectable from the recommended view and **must not be reported**: knee valgus/cave (needs front view and 2D is unreliable), lumbar rounding ("butt wink"), foot rotation. Do **not** flag knees travelling past the toes (not an error under current coaching consensus).

### Cross-exercise rules
- Every tag has a plain-language label, one fixed cue (the LLM may rephrase but not invent new advice), a dimension and a severity (`LOW|MEDIUM|HIGH`, matches `FindingSeverity`).
- **Correction selection (server-side, deterministic):** rank detected tags by `severity x fraction of affected reps`; keep the top 2, at most one per dimension unless fewer than 2 exist. If the set has none, the corrections array is empty.
- **Positive candidates (server-side):** dimensions at Good or better, consistent depth (low variance across reps), full lockout on all reps, steady tempo, completed rep count. If the set is all Poor, the fallback positive is effort-based ("You finished N reps") and the prompt forbids invented praise.
- Level-adaptive wording only (D-15): the prompt receives `experienceLevel`; thresholds do not change.

## Runtime State Inventory

Omitted: this is a greenfield feature phase, not a rename/refactor/migration. Note the one data-contract change that does need care: adding `AnalysisResult.outcome`, making `formScore` nullable, and the `WorkoutSession` workout link are additive migrations; existing rows (Phase 1 pipeline-check sessions with the stub) have no result row and need no backfill.

## Data Model Changes (Prisma 7)

Existing: `AnalysisResult` (`formScore` required, `scoreBreakdown Json`, `summaryFeedback`, `rawFeedback Json`, `aiModelName`, `aiModelVersion`), `AnalysisFinding` (`findingType MISTAKE|CORRECTION|POSITIVE`, `severity`, `code`, `title`, `description`, `correction`, `bodyPart`, `startSec`, `endSec`, `sortOrder`), `PoseCapture` (keeps keypoints), `WorkoutSession` (user, exercise, status, stage columns).

Proposed additions (planner to finalise names):
- `WorkoutSession`: `workoutId Int?` (relation to `Workout`, `onDelete: SetNull`), `setNumber Int?`, index `(workoutId, performedAt desc)`. Needed for D-01/D-08.
- `AnalysisResult`: `outcome` enum `SCORED | UNTRACKABLE`, `formScore` becomes nullable (Phase 7 queries must filter `outcome = SCORED`), `untrackableReasons String[]`.
- `AnalysisFinding`: `repNumbers Int[]` (rep references for FORM-06); keep `startSec/endSec` for the first affected rep.
- Mapping: `scoreBreakdown` = `{ rom: {score, band|null, isAssessed}, core: ..., symmetry: ... }`; `rawFeedback` = `{ metricsVersion, rubricVersion, promptVersion, repMetrics: [...] }`; `summaryFeedback` = one-line summary; POSITIVE findings first by `sortOrder`, then up to 2 CORRECTION findings (`code` = tag, `title` = what, `description` = evidence with reps, `correction` = cue).
- `createWorkoutSessionSchema`: add optional `workoutId`, `setNumber`; session creation validates ownership of the workout and that the exercise code is one of the four supported (otherwise 400/422).
- New endpoints (shared Zod response shapes in `@repo/common`, registered in `apps/api/src/openapi/schemas.ts`): `GET /api/sessions/:id/analysis` (result: outcome, band, dimensions, positives, corrections, advice; never `formScore`), `GET /api/workouts/:id/sessions` (recorded sets for the detail screen, with status/stage/outcome/band), and a `processingStatus` filter on session listing so the tracker can re-hydrate pending analyses after an app restart.
- The capture route must call `assertAiPrerequisites` (428) before accepting a capture; today neither `createSession` nor `submitCapture` checks consent.

## LLM Prompt and Structured Output Design

- **Model:** reuse `env.llm.primaryModel` (Sonnet) at `low` or `medium` effort; the heavy lifting is deterministic, so cost and latency stay small (about 1-1.5k input and about 400 output tokens). Add `FORM_LLM_*` env keys only if a different effort/timeout is wanted; otherwise reuse `LLM_*` and `ANALYSIS_LLM_TIMEOUT_MS` (40 s; the env validator already ties it to the stuck timeout).
- **Provider:** add `generateFormFeedback(request): Promise<FormFeedbackResult>` to `LlmProvider` (same `signal`, `timeoutMs`, `maxRetries: 0`, `mapAnthropicError`), and extend `tests/unit/helpers/fakeLlmProvider.ts`.
- **Prompt module** `prompts/formFeedbackPrompt.ts` exporting `FORM_FEEDBACK_PROMPT_VERSION` and `buildFormFeedbackPrompt()`:
  - System: coach persona; second person, encouraging, concise; one actionable cue per correction; no joint-angle jargon, no medical or injury claims, no mention of height, weight or body composition in the output; may only talk about the supplied tags and strengths; never invent rep numbers; output language rules.
  - User turn (JSON-ish block): exercise, view, experience level, height/weight (PROF-07), set summary (rep count, tempo), per-rep table (n, depth, lockout, duration, tags), dimension bands, the <=2 **server-selected corrections** (tag, plain label, fixed cue, affected reps), and the candidate positives with rep refs.
  - Output (Zod, via `zodOutputFormat`):

```ts
const formFeedbackOutput = z.object({
  summary: z.string(),
  positives: z.array(z.object({ text: z.string(), repNumbers: z.array(z.number().int()) })),
  corrections: z.array(z.object({
    errorTag: z.enum(DETECTABLE_TAGS_FOR_EXERCISE),
    repNumbers: z.array(z.number().int()),
    cue: z.string(),
    detail: z.string(),
  })),
});
```
- **Server-side validation after parse** (the API ignores array `min/max`, as the Phase 4 comment notes): `positives.length >= 1`; `corrections.length <= 2` and each `errorTag` is one of the supplied tags; every `repNumbers` entry exists in the set and rep references are 1-based; no text contains digits-with-degrees jargon patterns or banned words (`degrees`, `valgus`, injury terms) via a small banned-phrases check; length caps. On failure do one repair attempt that appends the issues (same pattern as `GENERIC_ISSUE` in `workoutGenerationService`), then fail with `ANALYSIS_ERROR` (D-11 retry).
- **Never** let the LLM alter band, score or dimension chips.
- **Cost cap:** pricing/cost cap is an open project decision (STATE.md). Cheap guard: a per-user daily recorded-analysis cap enforced at capture (`TooManyRequestsError`, same style as `aiGeneration.dailyCap`). Flag to the user; do not invent a number silently.

## Native UX Notes

- **Entry (D-01):** in `workout-execute.tsx`, next to "Complete set", add "Record this set" when `ex.exercise.code` is supported. If AI prerequisites are missing, route into the existing consent/profile steps (reuse `AiProfilePrerequisite`, `AiConsentNotice`; extend `aiMessages.ts` copy).
- **Recording screen:** new route `app/(main)/record-set.tsx` (full screen). Result of the recording (sessionId, jobId) is registered with the tracker context, not passed through router params.
- **Analysis tracker (D-09/D-10/FORM-08/NOTF-02):** `AnalysisTrackerContext` mounted in `app/(main)/_layout.tsx` holds `pending: {sessionId, jobId, workoutId, setNumber}[]`, renders one `useAnalysisStatus` watcher per pending item (null UI), and on terminal COMPLETED invalidates the result/session queries and shows a toast with "View feedback" (router push to `workout-detail` focused on the set); on FAILED the set shows Retry. Re-hydrate on mount from `GET sessions?processingStatus=PROCESSING` so an app restart does not lose the badge.
- **States on a set row:** `Analysing... {stage_label} {percent}%` -> `Result` (badge + view) | `Needs retry` (message + Retry, calls retry endpoint then re-attaches the watcher with the new `jobId`; `useAnalysisStatus(sessionId, runKey)` already keys on the run) | `Couldn't track you` (advice + Record again).
- **Result view (D-05..D-07):** `BandBadge` with label always printed; three `DimensionRow`s with chips ("Not assessed from this angle" when `isAssessed` is false); "What went well" then up to 2 "Fix this" cards with rep chips. Color alone never carries meaning (accessibility). Choose contrast-checked green-to-red values in `src/theme/`.
- **Retry of upload vs retry of analysis** are different failure modes; keep two messages.
- Style per project skills (`native-code-standards`, `building-native-ui`): functional components, theme tokens, no inline magic colors for bands.

## Common Pitfalls

### Pitfall 1: Pose pipeline does not match the evaluated one
**What goes wrong:** An axis-aligned crop with a custom fast-tflite pass degrades on horizontal bodies, so measured accuracy in the field is below the Phase 1 numbers.
**Why:** BlazePose relies on a detector-derived rotated ROI and landmark-driven tracking; `vision-camera-resize-plugin` crops but cannot rotate.
**Avoid:** Wave 0 spike on a real Android device with push-up and dip clips; prefer the MediaPipe Tasks plugin. Compare device landmarks to the offline CSV on the same movements.
**Warning signs:** limbs flipping in the push-up bottom position, visibility collapsing when horizontal.

### Pitfall 2: Anisotropic coordinates distort angles
**What goes wrong:** Normalized x,y on a 16:9 frame make every angle wrong by up to tens of degrees.
**Avoid:** Store or derive aspect ratio; multiply x by `width/height` before angle math; unit-test with a synthetic skeleton at known angles on a non-square frame.

### Pitfall 3: Capture payload exceeds 1 MiB compressed
**What goes wrong:** 33 keypoints x 3 floats with full double precision at 15 fps for 120-180 s gzips to well over 1 MiB (the cap, `CAPTURE_LIMITS.maxCompressedBytes`), and the server rejects it.
**Avoid:** Quantize on the client: x,y to 3 decimals, confidence to 2 decimals, `timestampSec` to 3 decimals; record at ~15 fps (schema allows 5-60); optionally drop the 10 face landmarks other than nose and mouth only if still too big (keep indices stable, so do not drop silently). Estimate: about 6 bytes per keypoint gzipped gives about 180 KB for 60 s and about 540 KB for 180 s at 15 fps. Add a unit test that gzips a worst-case synthetic capture and asserts the cap; the roadmap's old "25-60 KB" estimate was for 17 points.

### Pitfall 4: Mirror and orientation errors flip left/right
**What goes wrong:** Front-camera mirroring or a rotated device swaps limbs, which corrupts symmetry and near-side choice.
**Avoid:** Un-mirror on the client before storing; store `cameraView` ("side" | "front" | "back") from the recommended view per exercise; include a server geometry check for the wrong angle (shoulder-width projection vs torso).

### Pitfall 5: Rep segmentation false positives/negatives
**What goes wrong:** Jitter at the top of a push-up counts as reps; slow partial reps vanish.
**Avoid:** smoothing, amplitude gate, prominence and min-duration rules; ground-truth fixtures (every shot-list clip has exactly 5 reps, hold clips have 0 reps).

### Pitfall 6: Late LLM result after timeout
**What goes wrong:** A timed-out call still completes and is billed (`withTimeout` does not cancel).
**Avoid:** AbortSignal on the SDK request (Pattern 5); keep the `runGuard` on writes.

### Pitfall 7: Non-idempotent result writes on retry
**What goes wrong:** BullMQ attempts or the D-11 retry create duplicate findings or hit the `sessionId` unique constraint.
**Avoid:** transaction: upsert result by `sessionId`, delete findings, recreate; then guarded `completeRun`.

### Pitfall 8: Network loss between Stop and upload
**What goes wrong:** The only copy of a 60 s set is in memory and lost.
**Avoid:** hold the gzip bytes in the recording hook (or tracker) until `202`, show "Retry upload"; do not create the session until Stop; consider persisting to the app cache directory (`expo-file-system`, already a transitive Expo dependency, would need declaring) only if UAT shows backgrounding kills the app mid-upload.

### Pitfall 9: Unsupported exercise or stale catalog
**What goes wrong:** Offer shown for exercises with no rubric (e.g. `plank`, which is `STATIC_HOLD`).
**Avoid:** one shared `FORM_ANALYSIS_EXERCISES` constant in `@repo/common` used by native offer, session create validation and the rubric registry. `dip` exists only after `db:seed` (STATE.md note).

### Pitfall 10: Consent copy no longer matches data sent
**What goes wrong:** Users consented on `2026-11-04` to workout-generation wording; form analysis sends new data categories.
**Avoid:** bump `AI_CONSENT_VERSION` (`packages/common/src/validations/aiPrerequisites.ts`) so existing users re-consent; update `AI_CONSENT_BODY_TEXT` to say: pose measurements derived from keypoints, plus height and weight, go to the LLM provider; video never leaves the phone. Update the unit tests that pin the version and the `user.ts` flow. Legal review of wording remains an open STATE item.

### Pitfall 11: Dim light and marginal joint confidence
**What goes wrong:** Pull-up low light untested; squat knee confidence marginal.
**Avoid:** manual UAT cases for dim light; the setup check reports "too dark"; squat falls back to hip-y signal when knee visibility is low.

### Pitfall 12: Score leaking to the UI or `setNumber` collisions
**What goes wrong:** A response shape includes `formScore`; two recorded attempts for one set number overwrite each other.
**Avoid:** response schema excludes score; allow multiple sessions per `(workoutId, setNumber)` and show the latest (Record again creates a new session).

## Code Examples

### 2D joint angle (isotropic coordinates)
```ts
// Source: standard vector geometry; unit-test against known angles
type P = readonly [x: number, y: number];
export const angleAt = (a: P, b: P, c: P): number => {
  const v1x = a[0] - b[0], v1y = a[1] - b[1];
  const v2x = c[0] - b[0], v2y = c[1] - b[1];
  const dot = v1x * v2x + v1y * v2y;
  const mag = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
  if (mag === 0) return Number.NaN;
  return (Math.acos(Math.min(1, Math.max(-1, dot / mag))) * 180) / Math.PI;
};
```

### Signed distance of hip from the shoulder-ankle line (push-up sag/pike)
```ts
// positive = hip below the line (y down). Normalise by L = |shoulder - ankle|.
export const hipOffsetRatio = (shoulder: P, hip: P, ankle: P): number => {
  const lx = ankle[0] - shoulder[0], ly = ankle[1] - shoulder[1];
  const len = Math.hypot(lx, ly);
  if (len === 0) return Number.NaN;
  const cross = lx * (hip[1] - shoulder[1]) - ly * (hip[0] - shoulder[0]);
  // sign so that "below" (larger y) is positive regardless of facing direction
  return (lx >= 0 ? cross : -cross) / (len * len);
};
```

### Structured LLM call (existing pattern to extend)
```ts
// Source: apps/api/src/lib/llm/anthropicProvider.ts (Phase 4)
message = await this.client.messages.parse(
  {
    model: req.model,
    max_tokens: req.maxTokens,
    system: req.system,
    messages: [{ role: "user", content: req.userPrompt }],
    output_config: { format: zodOutputFormat(formFeedbackOutput(req.allowedTags)), effort: req.effort },
  },
  { signal: req.signal, timeout: req.timeoutMs, maxRetries: 0 },
);
```

### Worker-side abort wiring (replaces `withTimeout` for the LLM call)
```ts
const controller = new AbortController();
const deadline = setTimeout(() => controller.abort(), env.analysis.llmTimeoutMs);
try {
  const feedback = await feedbackService.generateFeedback({ metrics, context, signal: controller.signal, timeoutMs: env.analysis.llmTimeoutMs });
  // ...persist, completeRun
} finally {
  clearTimeout(deadline);
}
```

### Client quantization before gzip
```ts
const q = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;
const frames = raw.map((f) => ({
  timestampSec: q(f.timestampSec, 3),
  keypoints: f.keypoints.map(([x, y, v]) => [q(x, 3), q(y, 3), q(v, 2)] as [number, number, number]),
}));
```

## State of the Art

| Old Approach | Current Approach | When | Impact |
|--------------|------------------|------|--------|
| MoveNet 17 points | BlazePose Full 33 points | Phase 1 decision 2026-11-08 | Payload and angles use 33-point indices |
| `withTimeout` (stop waiting) | AbortSignal on SDK request | Phase 4 pattern, applied here | Timed-out LLM calls are cancelled |
| LLM-scored form | Deterministic metrics + LLM phrasing | This research | Stable, testable scores |
| Vision Camera 4 + fast-tflite 2 | VC 5 / fast-tflite 3 (Nitro) exist | 2026 | Do not upgrade in this phase |

**Deprecated/outdated:** the roadmap's "25-60 KB" capture estimate (17 points); `usePoseCheck` is MoveNet-only dev tooling.

## Open Questions

1. **Symmetry for side-on exercises (needs user decision).**
   - Known: Phase 1 requires side-on for push-up/dip (and squat is best side-on); symmetry is not measurable there. D-06 fixes three rows.
   - Recommendation: keep three rows and show "Not assessed from this angle" where the view cannot judge; overall score renormalizes over assessed dimensions. Alternative: per-exercise dimension sets (changes D-06).
2. **Pull-up view: front vs side.** Front gives ROM + symmetry; side gives ROM + swing. Recommendation: front/back, core stability LOW confidence. User to confirm.
3. **Where recorded results appear (D-08).** There is no per-run detail screen; `WorkoutLog` is created only at Done. Recommendation: link `WorkoutSession.workoutId + setNumber` and show a "Recorded sets" section on `workout-detail` (latest run first). Confirm.
4. **Consent wording vs data actually sent.** D-16 says keypoints go to the LLM. Recommendation: send derived measurements only, and word the notice "measurements computed from your pose keypoints". Confirm with the user and the pending legal review.
5. **Pose runtime choice (Wave 0 spike).** Option B (MediaPipe Tasks plugin) vs A (fast-tflite two-stage). Requires a real Android device; iOS runtime remains an accepted unverified risk.
6. **Minimum reps for a band.** Proposed: 2 reps; fewer shows advice ("No reps detected"/"Do at least 2 reps"). Confirm.
7. **Cost cap per analysis/day.** Project open decision; propose a configurable per-user daily cap.
8. **Rubric thresholds.** All numeric values are provisional; user reviews the tables above and a calibration pass on the 16 clips (plus a few deliberately bad takes) is needed before the band cutoffs are trusted.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.x (+ Supertest) in `apps/api`; no test runner in `apps/native` |
| Config file | `apps/api/vitest.config.ts` (projects `unit`, `integration`) |
| Quick run command | `yarn workspace api test:unit` |
| Full suite command | `yarn workspace api test` (needs Docker Postgres :5433 and Redis) |
| Static gates | `yarn lint`, `yarn check-types`, `yarn format:check`, `yarn knip`, `yarn deps:lint` |

Design rule: put all non-UI logic where Vitest can reach it. The metrics engine and rubrics live in `apps/api/src/metrics`; band mapping, quantization helper, advice text maps and the supported-exercise list live in `@repo/common` and are imported by API unit tests. The native app is verified by `check-types`, `lint` and manual device UAT.

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| FORM-01 | Only the four supported exercises accepted for recorded sessions | unit + integration | `yarn workspace api test:unit -t "supported exercise"` | Wave 0 |
| FORM-02 | Record offer / camera only on accept | manual-only (device) | n/a, UAT checklist | manual |
| FORM-03 | Capture accepted, 202 + job id; payload <= cap after quantization; consent gate 428 | unit + integration | `yarn workspace api test:unit -t "quantiz"`; `yarn workspace api test:integration -t "capture"` | partial (captureService test exists) |
| FORM-04 | Score -> band mapping boundaries; `formScore` not exposed in responses | unit | `yarn workspace api test:unit tests/unit/metrics/scoring.test.ts` | Wave 0 |
| FORM-05 | Dimension scores and `isAssessed` per exercise/view | unit | `yarn workspace api test:unit tests/unit/metrics/computeFormMetrics.test.ts` | Wave 0 |
| FORM-06 | LLM output validator: rep numbers exist, tags allowed | unit | `yarn workspace api test:unit tests/unit/services/feedbackService.test.ts` | Wave 0 |
| FORM-07 | >=1 positive, <=2 corrections enforced; selection deterministic | unit | same as above + `selectCorrections.test.ts` | Wave 0 |
| FORM-08 | SSE COMPLETED then result endpoint returns result | integration | `yarn workspace api test:integration -t "analysis result"` | Wave 0 |
| FORM-09 | Untrackable fixtures yield `UNTRACKABLE` with reasons and no LLM call | unit | `yarn workspace api test:unit tests/unit/metrics/trackability.test.ts` | Wave 0 |
| PROF-07 | Prompt contains latest height/weight; consent version bumped | unit | `yarn workspace api test:unit tests/unit/prompts/formFeedbackPrompt.test.ts` | Wave 0 |
| NOTF-02 | Toast on COMPLETED, deep link to set | manual-only (device) | UAT checklist | manual |
| (cross) | AbortSignal cancels the LLM call; late result discarded; idempotent retry | unit/integration | `yarn workspace api test:unit -t "abort"` | Wave 0 |
| (cross) | Rep segmentation: every shot-list rep clip yields 5 reps, hold clips 0 | unit with golden fixtures | `yarn workspace api test:unit tests/unit/metrics/segmentReps.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `yarn workspace api test:unit` (+ `yarn check-types` for native-touching tasks)
- **Per wave merge:** `yarn workspace api test` plus `yarn lint && yarn format:check && yarn knip && yarn deps:lint`
- **Phase gate:** full suite green, then Android device UAT before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/metrics/*.test.ts` and fixture directory `tests/unit/metrics/fixtures/` — skeleton JSON from the 16 evaluation clips. Extend `scripts/pose-eval/evaluate.py` (or a sibling script) with a `--dump-keypoints` option writing quantized 33-point sequences (skeleton only, no imagery, so it is safe to commit); clips themselves stay gitignored.
- [ ] Synthetic skeleton generator helper (`tests/unit/helpers/syntheticPose.ts`): parametric push-up/squat/pull-up/dip sequences with known angles, sag, noise, dropouts, non-square aspect.
- [ ] Extend `tests/unit/helpers/fakeLlmProvider.ts` for `generateFormFeedback`.
- [ ] Integration test for the result endpoint and the consent gate at capture.
- [ ] Unit test pinning that `AI_CONSENT_VERSION` consumers and `unitEnv.ts` stay in sync if env keys are added (`tests/unit/config/env.test.ts`).
- [ ] Manual UAT checklist (Android device): permission denied, dark room (pull-up included), out-of-frame, countdown/pause, 60 s and 180 s cap upload, airplane mode at Stop, app backgrounded during analysis, toast deep link, retry after forced failure, Record again after untrackable.
- [ ] No native test framework is introduced; keep UI logic thin and reusable pure functions in `@repo/common`.

## Sources

### Primary (HIGH confidence)
- Repository code read this session: `apps/api/src/workers/analysisProcessor.ts`, `services/{captureService,analysisStateService,feedbackService,aiPrerequisitesService,workoutGenerationService,workoutSessionService}.ts`, `lib/llm/{types,anthropicProvider}.ts`, `utils/withTimeout.ts`, `packages/common/src/validations/{poseCapture,analysis,workoutSession}.ts`, Prisma models (`analysis-result`, `analysis-finding`, `pose-capture`, `workout-session`, `workout`), `apps/native/{src/hooks/usePoseCheck.ts,usePipelineCheck.ts,useAnalysisStatus.ts,app/(main)/workout-execute.tsx,package.json}`, `scripts/pose-eval/{README.md,evaluate.py}`, `01-POSE-MODEL-DECISION.md`.
- Bundled `pose_landmarker_full.task` unzipped and inspected locally with TensorFlow Lite: detector input `[1,224,224,3]` float32, outputs `[1,2254,12]` and `[1,2254,1]`; landmark input `[1,256,256,3]` float32, outputs `[1,195]`, `[1,1]`, `[1,256,256,1]`, `[1,64,64,39]`, `[1,117]`.
- npm registry (queried 2026-11-08): versions/dates for react-native-fast-tflite, react-native-vision-camera, vision-camera-resize-plugin, react-native-worklets-core, @anthropic-ai/sdk, react-native-mediapipe-posedetection.
- https://github.com/mrousavy/react-native-fast-tflite README (model loading, delegates, Expo plugin; no pose models mentioned)
- https://github.com/mrousavy/vision-camera-resize-plugin README (options: scale, crop, pixelFormat, dataType; no rotation documented)

### Secondary (MEDIUM confidence)
- https://github.com/EndLess728/react-native-mediapipe-posedetection README (33 landmarks with visibility/presence, `usePoseDetection`, model as bundled `.task`, New Architecture required, MIT, 29 stars)
- https://github.com/munishbp/react-native-mediapipe-pose-plugin README (VC4 frame-processor plugin; manual install, 0 stars; not recommended)
- MediaPipe `pose_landmark_cpu.pbtxt` (detection used only until landmark-derived ROI available; smoothing filters): https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/modules/pose_landmark/pose_landmark_cpu.pbtxt
- Scapula kinematics of pull-up techniques (impingement risk): https://pubmed.ncbi.nlm.nih.gov/26383875/
- Systematic evidence that 2D video frontal-plane kinematics are task-dependent and not suitable when accuracy is required (via search results, PubMed/core.ac.uk)

### Tertiary (LOW confidence, coaching sources; basis for provisional thresholds)
- Push-up form guides (hip sag, 45-90 degree elbow position, depth about 90 degrees elbow flexion): cathe.com, tomsguide.com, hundredpushups.com
- Dip depth about 90 degrees elbow flexion, trunk lean 20-30 degrees (contested), scapular control: donatif.com, bullbarfit.com, inspireusafoundation.org (equipment sellers; claims not verified)
- Squat depth/trunk thresholds: no authoritative 2D source found; values are conventional coaching standards (thigh parallel, torso roughly parallel to shin)

## Metadata

**Confidence breakdown:**
- Standard stack / reuse of Phase 1 and 4 seams: HIGH (code read directly)
- Pose runtime: MEDIUM (model I/O verified; plugin maturity and device behaviour unverified; spike required)
- Metrics architecture: MEDIUM-HIGH (standard signal processing; fixtures give ground truth)
- Rubric thresholds: LOW-MEDIUM (coaching consensus, little peer-reviewed 2D support; calibrate)
- LLM design: HIGH (reuses the proven Phase 4 structured-output path)
- Pitfalls: MEDIUM-HIGH

**Research date:** 2026-11-08
**Valid until:** about 2026-12-08 for stack facts (vision-camera/fast-tflite majors are moving to Nitro); rubric thresholds stay provisional until calibrated.
