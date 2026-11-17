---
created: 2026-11-15T16:19:36.199Z
title: Remove MoveNet dev tooling
area: native
files:
  - apps/native/assets/models/movenet_singlepose_lightning_int8.tflite
  - apps/native/src/hooks/usePoseCheck.ts
  - apps/native/app/(main)/dev-pose-check.tsx
  - apps/native/app/(main)/(tabs)/settings.tsx:69-76
  - apps/native/app/(main)/_layout.tsx:67
  - apps/native/app.json:50
  - apps/native/metro.config.js:21-22
  - apps/native/package.json:46,57
---

## Problem

MoveNet Lightning is no longer the app's pose model. BlazePose Full won the
pose-model gate in plan 01-04 (4/4 exercises against 1/4 for MoveNet), and
recording now runs through `useMediaPipePose`. Only the Phase 1 dev "Pose check"
screen still uses the MoveNet model (2.8 MB), through `usePoseCheck`. That
screen is also the only reason `react-native-fast-tflite` and
`vision-camera-resize-plugin` stay installed, so Knip never flags them.

Phase 5 kept this tooling on purpose (05-01-PLAN, 05-RESEARCH) and pushed its
removal to a "Phase 8 cleanup" that was never added to the roadmap.

## Solution

1. Delete the model file, `src/hooks/usePoseCheck.ts` and
   `app/(main)/dev-pose-check.tsx`.
2. Remove the screen's Settings "Pose check" row and its `_layout` route.
3. Remove the `react-native-fast-tflite` and `vision-camera-resize-plugin`
   dependencies, the `react-native-fast-tflite` plugin entry in `app.json`, and
   the `tflite` assetExt in `metro.config.js`.
4. Run `yarn install`, then `yarn deps:lint`, `yarn knip`, `yarn lint` and
   `yarn check-types`.
5. Check whether `react-native-worklets-core` is still used (`useMediaPipePose`
   may use it) before removing anything else.
6. This removes a native module, so it needs a new EAS dev build. Schedule it
   for a time when no device UAT is pending on the current build.
7. Update the `CLAUDE.md` Phase 1 note that mentions `react-native-fast-tflite`.
