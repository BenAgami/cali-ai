---
phase: 05-ai-form-analysis-camera-post-set
verified: 2026-11-12T00:00:00Z
status: passed
score: 6/6 must-haves verified
re_verification: false
---

# Phase 5: AI Form Analysis (Camera + Post-Set) Verification Report

**Phase Goal:** Users can choose to record a set; the camera and on-device pose estimation run only for recorded sets, and when such a set ends the keypoints are automatically analyzed (metrics -> LLM) and the user receives a form band, dimension breakdown and rep-level coaching text with no manual upload step.
**Verified:** 2026-11-12
**Status:** passed
**Re-verification:** No - initial verification

Evidence basis: code read directly (not SUMMARYs), `yarn workspace api test:unit` (66 files, 818 tests, all pass), and 05-HUMAN-UAT.md (23/23 PASS on a Galaxy S25+) for device-only behaviour. Decisions D-22 (hands-free start) and D-23 (auto-stop, spoken cues) are treated as intentional amendments of D-02 (manual Start/Stop).

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Exercise chosen, record offered, camera only on accept, keypoints auto-submitted on set end (no upload screen); declined set is logged without analysis | VERIFIED | Offer: `apps/native/app/(main)/workout-execute.tsx:253-276` shows "Record this set" only when `isFormAnalysisExercise(code)` and phase is `working`; the normal "Complete set" button (`:239`) is separate. Camera: `apps/native/app/(main)/record-set.tsx:234-250` renders `<Camera isActive>` only after the `prerequisites` and `permission` phase gates (`:106-170`). Auto-submit: `apps/native/src/hooks/useRecordedSet.ts:326-348` (`finish` -> `runUpload` -> `sessionsApi.create` + `submitCapture`, then `onSubmitted` -> `router.back()`); auto-stop at 175 s `:61,:424`, set-end detection `:411-424`. Decline path: a WorkoutSession is only created inside `runUpload` (`useRecordedSet.ts:326-331`; the only other caller is the dev pipeline check), so a declined set never creates a session or capture. Server restricts sessions to the 4 exercises: `packages/common/src/validations/workoutSession.ts:10-14`. UAT rows 1, 1b, 8, 14, 21 PASS. |
| 2 | Band (5 levels) + dimension breakdown (ROM, CORE, SYMMETRY); 0-100 score stored, not shown | VERIFIED | 5 bands: `packages/common/src/validations/formAnalysis.ts:67-99`. Dimensions: `:101-107`. Score stored: `apps/api/src/services/formAnalysisResultService.ts:82` (`formScore: metrics.overallScore`). Never exposed: `analysisResultQueryService.ts:131,211` map `formScore` through `bandFromScore` only; responses are re-parsed by `formAnalysisResponseSchema` (`:225-232`), whose shape has no score field (`formAnalysis.ts:187-216`); no `formScore` reference anywhere in `apps/native` or `packages/common/src`. UI: `apps/native/app/(main)/analysis-result.tsx:79-98` (BandBadge + DimensionRow per dimension). Symmetry shows "Not assessed from this angle" (`formMessages.ts:4`). UAT rows 2 PASS. |
| 3 | Feedback references specific reps, positives first, max 2 corrections | VERIFIED | Server-selected corrections capped at `MAX_CORRECTIONS = 2` (`apps/api/src/metrics/selectFindings.ts:22,126-137`). LLM output validator requires >=1 positive (`feedbackService.ts:89-91`), exactly the server-selected tag set (`:102-115`), rep numbers inside the set / finding (`:95,:123-130`), plus one repair attempt (`:179-229`); on failure the job fails rather than saving bad text. Response schema enforces `positives.min(1)` and `corrections.max(2)` (`formAnalysis.ts:209-210`). Persisted positives (sortOrder before corrections) and rep numbers: `formAnalysisResultService.ts:51-75`. UI renders "What went well" first, then at most `MAX_CORRECTIONS_SHOWN`=2 with rep chips (`FeedbackBlocks.tsx:51-79`). LLM never scores (score/band computed in `computeFormMetrics.ts:80-107`). UAT row 3 PASS. |
| 4 | In-app notification + feedback screen updates automatically on completion | VERIFIED | SSE endpoint `apps/api/src/routes/session.ts:67-74` -> `analysisStreamService.ts`; client `apps/native/src/hooks/useAnalysisStatus.ts:30-96` (react-native-sse, reconnect, terminal close). Global tracker `AnalysisTrackerContext.tsx:84-118`: on COMPLETED invalidates the session and recorded-sets queries, adds to unseen set and sets a "Feedback ready" toast; mounted app-wide at `apps/native/app/(main)/_layout.tsx:10,75`. Re-attaches PROCESSING sessions after restart `:150-175`. Result screen shows live progress and refetches on completion (`analysis-result.tsx:46-58`, `useAnalysisResultScreen.ts`). UAT rows 4, 15 PASS. |
| 5 | Failed analysis presents a retry option | VERIFIED (one warning) | Server: `POST /sessions/:id/analysis/retry` (`routes/session.ts:45-52`) -> `captureService.retryAnalysis` (`captureService.ts:87-110`) restarts from the stored capture, FAILED-only. Failure sources: worker error via `onAnalysisJobFailed` (`analysisProcessor.ts:188+`), enqueue failure (`captureService.ts:175-184`), stuck jobs reaped (`reaperProcessor.ts`, repeatable job `workers/index.ts:49-65`), BullMQ attempts/backoff `lib/queue.ts:21-22`. Native: failed rows show Retry for TIMEOUT/LLM_TIMEOUT/ENQUEUE_FAILED/ANALYSIS_ERROR (`AnalysingRow.tsx:39,67-80`, `formMessages.ts:32-37`) -> `AnalysisTrackerContext.retry` (`:120-134`); upload/network failure shows "Retry upload" (`record-set.tsx:170-196`, `useRecordedSet.ts:432`). UAT rows 5a, 5b PASS. See warning W1 for CAPTURE_* reasons. |
| 6 | Untrackable body -> camera advice instead of feedback | VERIFIED | Preflight `trackability.ts` (thresholds `:20-29`, `MIN_REPS_FOR_BAND` `:14`) and `computeFormMetrics.ts:46-49,63-65` return `UNTRACKABLE` (reasons incl. NO_REPS_DETECTED). Worker persists `UNTRACKABLE` with no LLM call (`analysisProcessor.ts:117-135`, `formAnalysisResultService.saveUntrackable`). Read side returns advice via `buildUntrackableAdvice` (`analysisResultQueryService.ts:96-107`); UI `analysis-result.tsx:118-120` -> `CameraAdvice.tsx` with "Record again". Live pre-recording setup check also guides placement (`useRecordedSet.ts:296-303`). UAT rows 6, 9-13 PASS. |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `apps/api/src/services/captureService.ts` | Capture accept, caps, enqueue, retry | VERIFIED | 189 lines; consent/prereq check, 15/day and 2/exercise/workout caps, bounded enqueue |
| `apps/api/src/workers/analysisProcessor.ts` | metrics -> LLM -> guarded persist | VERIFIED | Full pipeline with AbortSignal timeout and run-guarded saves |
| `apps/api/src/metrics/*` + `rubrics/*` | Deterministic score/band/findings | VERIFIED | `computeFormMetrics`, scoring, selectFindings, trackability, 4 rubric modules, `RUBRIC_VERSION = "rubric-v1"`; calibration in `05-CALIBRATION.md` |
| `apps/api/src/services/feedbackService.ts` + `prompts/formFeedbackPrompt.ts` | Validated LLM phrasing | VERIFIED | Validator and repair loop wired into worker |
| `apps/api/src/services/formAnalysisResultService.ts` / `analysisResultQueryService.ts` | Write/read sides | VERIFIED | Transactional run-guarded writes; read side drops score |
| `packages/common/src/validations/formAnalysis.ts` etc. | Shared contracts | VERIFIED | Used by API and native (no duplicated shapes found) |
| `apps/native/app/(main)/record-set.tsx`, `src/hooks/useRecordedSet.ts`, `src/pose/*` | Recorder | VERIFIED | Phase machine prerequisites -> permission -> setup -> countdown -> recording -> uploading |
| `apps/native/src/context/AnalysisTrackerContext.tsx`, `AnalysisToast.tsx` | Global tracker/banner | VERIFIED | Mounted in `(main)/_layout.tsx` |
| `apps/native/app/(main)/analysis-result.tsx` + `components/form/*` | Result UI | VERIFIED | BandBadge, DimensionRow, FeedbackBlocks, CameraAdvice, RecordedSetCard, AnalysingRow |
| Prisma migration `20261108124537_form_analysis` | Schema | VERIFIED | Present; integration tests exist for capture, analysis, retry, worker, recorded sets |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| workout-execute | record-set | `router.push("/record-set")` | WIRED | `workout-execute.tsx:256-266` |
| useRecordedSet | POST /sessions, /capture | `sessionsApi.create`, `submitCapture` | WIRED | `useRecordedSet.ts:326-334`; routes `routes/session.ts:25-40` |
| captureService | BullMQ worker | `formAnalysisQueue.add` | WIRED | `captureService.ts:166-174`; worker `workers/index.ts` |
| analysisProcessor | computeFormMetrics / feedbackService / result service | direct calls | WIRED | `analysisProcessor.ts:93,157,175` |
| worker state | SSE stream | `analysisStateService` + `analysisStreamService` | WIRED | `routes/session.ts:67-74` |
| SSE event | toast + query invalidation | `AnalysisWatcher` -> `handleEvent` | WIRED | `AnalysisTrackerContext.tsx:84-118` |
| GET /sessions/:id/analysis | result screen | `useSessionAnalysis` | WIRED | `useAnalysisResultScreen.ts` |
| Retry button | POST analysis/retry | `AnalysisTracker.retry` -> `sessionsApi.retryAnalysis` | WIRED | `AnalysisTrackerContext.tsx:120-122` |
| Untrackable result | Record again | `CameraAdvice.onRecordAgain` | WIRED | `useAnalysisResultScreen.ts:46-59` |

### Requirements Coverage

| Requirement | Status | Evidence |
| --- | --- | --- |
| PROF-07 | SATISFIED | Latest height/weight in form feedback prompt (`formFeedbackPrompt.ts:59-60`, fed by `bodyMetricService.getLatest` in `analysisProcessor.ts:149,162-163`) and workout generation (`workoutPlanPrompt.ts:50`, `workoutGenerationService.ts:216`). Notice discloses profile data and pose measurements go to Anthropic (`apps/native/src/constants/aiMessages.ts:31`); consent version bumped (`AI_CONSENT_VERSION = "2026-11-08"`), enforced in `aiPrerequisitesService`. UAT row 7 PASS. |
| FORM-01 | SATISFIED | 4 supported exercises: `FORM_ANALYSIS_EXERCISES`, enforced server-side in `workoutSession.ts:10-14` and client in `workout-execute.tsx:253`. |
| FORM-02 | SATISFIED | Opt-in "Record this set" button; camera only after accept (see truth 1). D-22 hands-free start is intentional. |
| FORM-03 | SATISFIED | `useRecordedSet.ts:326-348`; 202 + jobId from `captureService.ts:84`; sessions only created for recorded sets. |
| FORM-04 | SATISFIED | See truth 2. |
| FORM-05 | SATISFIED | See truth 2 (3 dimensions, SYMMETRY `isAssessed=false` when unassessable). |
| FORM-06 | SATISFIED | Rep numbers validated and shown (`feedbackService.ts:95,123-130`, `FeedbackBlocks.tsx`). |
| FORM-07 | SATISFIED | See truth 3. |
| FORM-08 | SATISFIED | SSE progress -> result (truth 4). |
| FORM-09 | SATISFIED | See truth 6. |
| NOTF-02 | SATISFIED | In-app "Feedback ready" toast with deep link (`AnalysisTrackerContext.tsx:108-116`, `AnalysisToast.tsx`). In-app only, matching the requirement text. |

No orphaned requirements: all 11 Phase 5 IDs in REQUIREMENTS.md are claimed and satisfied.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `apps/native/src/constants/formMessages.ts` / `components/form/AnalysingRow.tsx` | `formMessages.ts:31`, `AnalysingRow.tsx:39,67` | Comment states CAPTURE_* failures "offer Record again instead of a retry", but `AnalysingRow` renders only the message and no action for CAPTURE_MISSING / CAPTURE_INVALID | Warning (W1) | A failed row with these two reasons has an explanation but no button. Low reachability (payload is validated at upload; these only arise from a missing/corrupt stored capture). Not a silent dead end, and retry would fail identically. User can still record again from the workout screen. |
| `.planning/ROADMAP.md` | 20, 128, 149, 205 | Phase 5 still `[ ]`, "12/18 plans executed", 05-18 unchecked, progress table 12/18 | Info | Planning bookkeeping lags the code (05-18 summary exists, requirements already ticked). Needs the phase-complete update. |

No TODO/FIXME/placeholder stubs found in the verified Phase 5 files; the grep-style stub patterns that matched are typed initial state overwritten by fetch/SSE data.

### Human Verification Required

None. Device-only behaviour is covered by 05-HUMAN-UAT.md (23/23 PASS, Galaxy S25+).

### Accepted / Known Items (not gaps)

- iOS pose runtime untested (no Mac or Apple developer account).
- Live TOO_DARK cannot fire (the pose plugin provides no luma); a truly dark room yields the not-detected path (UAT rows 9, 10).
- dip/diag45_1 segmentation is pinned as NO_REPS_DETECTED (calibration).
- Opposite-landscape handling was inferred from sensor geometry but confirmed by UAT row 17.

### Gaps Summary

No blocking gaps. All six success criteria and all 11 requirements are implemented and wired end to end; the unit suite passes (818 tests) and device UAT passed 23/23. Two non-blocking follow-ups: (1) W1, offer a "Record again" action (or drop the misleading comment) for CAPTURE_MISSING / CAPTURE_INVALID failed rows; (2) update ROADMAP.md Phase 5 status and plan counts (05-18 complete, 18/18).

Not re-run in this verification: integration tests (need Docker Postgres/Redis), lint, format, knip, native type-check.

---

_Verified: 2026-11-12_
_Verifier: Claude (gsd-verifier)_
