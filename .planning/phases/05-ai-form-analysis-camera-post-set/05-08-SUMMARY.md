---
phase: 05-ai-form-analysis-camera-post-set
plan: 08
subsystem: native-data-layer
tags: [react-native, react-query, sse, context, reanimated]
requires:
  - phase: 05-04
    provides: shared form analysis contracts in @repo/common
provides:
  - Typed native endpoints for session create/list/analysis and recorded sets
  - analysisKeys, useSessionAnalysis, useRecordedSets
  - AnalysisTrackerProvider/useAnalysisTracker and AnalysisToast
affects: [05-12, 05-15]
tech-stack:
  added: []
  patterns: [one SSE watcher component per tracked session, run-id dedupe of terminal events]
key-files:
  created:
    - apps/native/src/hooks/queries/useSessionAnalysis.ts
    - apps/native/src/hooks/queries/useRecordedSets.ts
    - apps/native/src/context/AnalysisTrackerContext.tsx
    - apps/native/src/components/form/AnalysisToast.tsx
  modified:
    - apps/native/src/constants/routes.ts
    - apps/native/src/api/endpoints/sessions.ts
    - apps/native/src/api/endpoints/workouts.ts
    - apps/native/src/api/keys.ts
    - apps/native/src/api/index.ts
    - apps/native/src/hooks/usePipelineCheck.ts
    - apps/native/app/(main)/_layout.tsx
key-decisions:
  - "Terminal events are handled once per sessionId:jobId so re-renders cannot duplicate toasts or invalidations"
  - "FAILED analyses only invalidate recordedSets; no toast (inline per D-11)"
requirements-completed: [FORM-08, NOTF-02]
duration: interrupted/resumed
completed: 2026-11-09
---

# Phase 5 Plan 08: Native data layer and analysis tracker Summary

Typed analysis endpoints and query hooks, plus an app-wide AnalysisTrackerProvider that runs one SSE watcher per pending session, re-attaches PROCESSING sessions after restart, and shows a deep-linking "View feedback" banner.

## Commits

- de897fb: Task 1, endpoints, keys, query hooks, pipeline check update
- ffe898d: Task 2, tracker context, toast, layout wiring

## Verification

`check-types`, `lint` and `format:check` pass. Device behaviour is deferred to 05-18 UAT.

## Deviations from Plan

None. The plan executed as written. The run was interrupted once; Task 1 was recovered from uncommitted work, re-verified and committed.

## Known Stubs

None. Note that the banner navigates to `/analysis-result`, which is created by plan 05-12; until then the route does not exist.

## Self-Check: PASSED
