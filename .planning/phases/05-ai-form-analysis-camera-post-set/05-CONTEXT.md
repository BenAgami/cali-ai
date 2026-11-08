# Phase 5: AI Form Analysis (Camera + Post-Set) - Context

**Gathered:** 2026-11-08
**Status:** Ready for planning

<domain>
## Phase Boundary

From a workout, the user can choose to record a set. The camera and on-device BlazePose estimation run only for recorded sets. When the set ends the keypoints are submitted automatically (Phase 1 pipeline) and the user receives a form band, a dimension breakdown and rep-level coaching text. Covers FORM-01 to FORM-09, PROF-07, NOTF-02. Real-time cues (Phase 6), progress trends (Phase 7) and training-data labeling (Phase 5.1) are separate phases.

Roadmap-fixed (not re-asked): 5-level band; 0-100 score stored but never shown per set; positives before corrections; max 2 corrections per set; failure shows retry; untrackable body shows camera advice.

</domain>

<decisions>
## Implementation Decisions

### Record entry and capture flow
- **D-01:** The "record this set?" offer appears per set, at the start of each set of a supported exercise (push-up, pull-up, dip, squat), next to the normal Done action in `workout-execute.tsx`. Declining logs the set normally with no analysis.
- **D-02:** A recorded set ends when the user taps Stop (also auto-stops at the Phase 1 duration cap). Keypoints are submitted immediately on stop. Auto-detect end of motion is deferred.
- **D-03:** Before recording, the user sees the camera preview with a framing guide and a countdown (about 5-10 s; planner sets exact length) so they can get into position.
- **D-04:** Start is blocked until the live pose pass detects the body with enough confident keypoints; the user is told what is wrong (out of frame, too dark). Exact thresholds are the planner's call.

### Result screen and band display
- **D-05:** The band is a labeled badge with a color scale (Excellent / Good / Fair / Needs work / Poor, green to red). Color is always paired with the text label.
- **D-06:** The 3 dimensions (range of motion, core stability, symmetry) show as three rows, each with its own band chip in the same 5-level vocabulary. No numeric scores shown.
- **D-07:** Feedback text is a "What went well" block followed by up to 2 "Fix this" cards, each citing specific reps with a short cue.
- **D-08:** Results live on the set inside that workout's detail, plus a deep link from the notification. No new tab; history and trends stay in Phase 7.

### Waiting, notification and failure UX
- **D-09:** After Stop, the user returns to the workout. The set shows an "Analysing..." row with stage label and percent (reuses `useAnalysisStatus`); rest timer and next set continue.
- **D-10:** On completion an in-app banner/toast with a "View feedback" action appears wherever the user is, plus a badge on the set (NOTF-02). OS push for a backgrounded app is not part of this phase.
- **D-11:** A failed analysis shows inline on the set with a plain message and a Retry button that calls the existing retry endpoint (stored capture, no resend).
- **D-12:** When the body cannot be tracked (FORM-09), no band is shown; the user gets specific tips derived from the cause (framing, light, per-exercise angle hint) and a "Record again" action. This is not treated as a failed analysis.

### Feedback rubric and coaching voice
- **D-13:** Per-exercise rubrics (error tags, thresholds, detectability) are drafted by phase research from biomechanics sources and reviewed by the user in the plan before execution. Resolves the STATE.md open decision.
- **D-14:** Coaching tone is encouraging, concise, second person ("Your depth was solid..."); one actionable cue per correction; no joint-angle jargon or medical claims.
- **D-15:** Bands are level-agnostic: the same bar for everyone, so the stored 0-100 score stays comparable over time. Feedback wording may adapt to fitness level.
- **D-16:** Consent reuses the Phase 4 AI consent gate (`assertAiPrerequisites`, 428) and notice, with form-analysis wording added: pose keypoints and height/weight go to the LLM provider; no video leaves the phone (PROF-07).

### Post-research amendments (2026-11-08)
- **D-17:** Symmetry is only assessable from a front/back view. The result keeps the three dimension rows (D-06); for side-on exercises (push-up, dip, squat) the symmetry row reads "Not assessed from this angle".
- **D-18:** Pull-ups are filmed front/back (enables symmetry); push-up, dip and squat are filmed side-on.
- **D-19:** Amends D-16: only server-derived measurements (angles, rep metrics) plus height/weight are sent to the LLM, never raw keypoints. The consent wording states exactly this. Scoring and band are computed deterministically on the server; the LLM only phrases the (at most 2) corrections the server selected.
- **D-20:** Recorded-set results appear in a "Recorded sets" section on the workout detail screen (a recorded set has no existing link to a workout; the schema gains the link, see RESEARCH.md).
- **D-21:** No UI-SPEC.md for this phase; planning works from D-01..D-20.

### Claude's Discretion
- Countdown length, confidence thresholds for the live setup check, framing-guide visuals
- Exact banner/toast mechanics and badge styling
- Exact band color values (within the green-to-red scale, accessible contrast)
- Component structure for result, analysing and advice states

</decisions>

<specifics>
## Specific Ideas

No specific requirements beyond the decisions above; open to standard approaches.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Pipeline and architecture
- `.planning/phases/01-infrastructure/01-CONTEXT.md` - Capture payload, SSE events, retry/reaper decisions (D-01 to D-21)
- `.planning/phases/01-infrastructure/01-POSE-MODEL-DECISION.md` - BlazePose Full chosen; Phase 5 must integrate it on device and recheck low light (pull-up)
- `docs/architecture.md` - Pipeline design and worker steps
- `docs/data-model.md` - PoseCapture, AnalysisResult entities
- `docs/features.md`, `docs/vision.md` - Feature scope and vision

### LLM and consent
- `.planning/phases/04-ai-workout-generation/04-CONTEXT.md` - AI consent gate, LlmProvider, model choice patterns
- `.planning/phases/04-ai-workout-generation/04-EVAL-RESULTS.md` - Sonnet primary per D-22 eval

### Planning
- `.planning/ROADMAP.md` - Phase 5 goal and success criteria
- `.planning/REQUIREMENTS.md` - FORM-01..09, PROF-07, NOTF-02
- `.planning/STATE.md` - Blockers: rubrics open decision; `withTimeout` cancellation concern (change to AbortSignal when the real LLM call replaces the `feedbackService` stub)
- `.planning/research/PITFALLS.md`, `.planning/research/FEATURES.md` - Prior research
- `.planning/codebase/*.md`, `CLAUDE.md` - Conventions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/native/src/hooks/useAnalysisStatus.ts`: SSE status hook (stage + percent) for the Analysing row
- `apps/native/src/hooks/usePoseCheck.ts`, `app/(main)/dev-pose-check.tsx`: existing vision-camera frame-processor pose pass
- `apps/native/src/hooks/usePipelineCheck.ts`, `dev-pipeline-check.tsx`: gzip capture upload path
- `apps/native/src/hooks/useWorkoutExecution.ts`, `app/(main)/workout-execute.tsx`: set-by-set run screen where the record offer goes
- `apps/native/src/components/AiConsentNotice.tsx`, `AiDisclaimer.tsx`, `AiProfilePrerequisite.tsx`: consent UI to extend
- `apps/api/src/services/captureService.ts`, `analysisStateService.ts`, `analysisStreamService.ts`, `feedbackService.ts` (stub to replace), `aiPrerequisitesService.ts`

### Established Patterns
- Route -> controller -> service -> Prisma; Zod in `packages/common`; shared response shapes defined once in `@repo/common`
- Worker logs through `logger.child({ jobId, sessionId })`; errors via `toError`
- LLM calls: SDK signal + timeout, vendor errors normalized (Phase 4)

### Integration Points
- `workout-execute.tsx` set flow; workout detail screen for persisted results
- `feedbackService` stub in the analysis worker; metrics computation before the LLM call
- Notification/banner surface (none yet for in-app)

</code_context>

<deferred>
## Deferred Ideas

- Auto-detect end of motion (stop recording when movement ceases for a few seconds) - backlog
- OS push notification when the app is backgrounded - future
- Form history / trends view - Phase 7

</deferred>

---

*Phase: 05-ai-form-analysis-camera-post-set*
*Context gathered: 2026-11-08*
