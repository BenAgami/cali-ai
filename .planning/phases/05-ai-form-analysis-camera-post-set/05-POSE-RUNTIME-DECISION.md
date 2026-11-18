# Pose runtime decision (plan 05-01, Wave 0 gate)

**Date:** 2026-11-09
Decision: PASS (option B, react-native-mediapipe-posedetection 0.4.0, GPU delegate)

Runtime is MediaPipe Tasks PoseLandmarker (`pose_landmarker_full.task`) through the `react-native-mediapipe-posedetection` frame-processor plugin. Option A (custom two-stage fast-tflite BlazePose) is not needed.

Reference device: Galaxy S25+ (Android). A POCO F1 was also tried and ran at about 12 fps. Only one person was tested.

## Results

| Criterion | Measured | Threshold | Result |
| --------- | -------- | --------- | ------ |
| C1 load | 33 keypoints, GPU delegate, about 30 fps (needed `targetFps` 60, see traps) | no crash 60 s, >= 15 fps | PASS |
| C2 push-up (landscape, front camera) | near-side chain 94%, dots stay on arm | >= 90% | PASS |
| C3 dip | near-side chain 100%, dots on arm | >= 90% | PASS |
| C4 squat (portrait, side-on) | near-side chain 88% | recorded (UAT risk) | MARGINAL (just under 90%) |
| C5 pull-up (portrait, facing camera) | not run (user injury, not a model failure) | recorded | UNVERIFIED |
| C6 pull-up, dim light | not run (same reason) | recorded | UNVERIFIED |
| C7 mirroring | correct on both cameras; raised right hand is the right-chain wrist | labels correct | PASS |
| C8 orientation | aspectRatio L=1.333, P=0.750 after adapter; dots aligned with body | upright landmarks | PASS (portrait needs rotation, see Orientation) |
| C9 thermal | 30 fps after 3 min, phone not hot | not hot, >= 12 fps | PASS |

Pass rule: C1-C3 must pass; they do. C4-C9 are recorded, not gates.

## Delegate

GPU loaded on the S25+. The adapter falls back to CPU if the plugin errors before the first result.

## Mirroring

Android frame-processor frames are not mirrored and `frame.isMirrored` reads false. The plugin's `mirrorMode` only affects its JS `convertPoint`, which we do not call, so the adapter passes `no-mirror`. The `IS_FRONT_OUTPUT_MIRRORED` constant planned in Task 1 is therefore gone; there is nothing to un-mirror. `PoseFrame` is upright and unmirrored with correct left/right labels on both cameras. The front preview is mirrored, so overlay dots for the front camera must draw `x` as `1 - x`.

## Orientation

On Android the plugin ignores orientation and returns landmarks in the raw landscape sensor frame; aspectRatio is 1.333 in both screen modes.

- Landscape: no rotation applied; aspectRatio = 4/3.
- Portrait: a per-camera pure rotation in `toUpright` (`useMediaPipePose.ts`). Back sensor is landscape-left: `(x, y) -> (1 - y, x)`. Front sensor is landscape-right: `(x, y) -> (y, 1 - x)`. aspectRatio = 1 / sensor ratio = 0.750.
- `ScreenOrientation.lockAsync(LANDSCAPE)` with app.json portrait gave landmarks aligned with the body in landscape.
- Open caveat: landscape held in the opposite direction (180 degrees) is not handled, because the landscape path applies no rotation. Plan 05-13 must handle it.

## Luma

Not tested. The plugin owns the frame processor, so running `vision-camera-resize-plugin` for a 16x16 thumbnail in the same processor was not tried. Treat luma as unavailable: the setup check uses the NOT_DETECTED copy that mentions light.

## Known gaps

- iOS runtime untested (accepted risk, as in Phase 1).
- C4 squat 88%: marginal, a UAT risk.
- C5 pull-up and C6 dim light: not run, deferred risks to re-check. Do not treat as passed.
- Single tester, single reference device; POCO F1 ran about 12 fps.

## Traps

1. `runAtTargetFps` on a 30 fps camera: a target of 15 quantises to about 12 fps. Use 60 for unthrottled, which gives about 30 fps.
2. RTL: React Native swaps left/right on RTL phones (e.g. Hebrew). Overlay layers positioned with `left` need `direction: "ltr"`.
3. The library logs a noisy `onResults event received: <handle>` line. Harmless; could be patched out.
4. The EAS dev build upload archive is 831 MB; an `.easignore` would speed it up.
5. The plugin owns the frame processor and delivers results to JS itself, so the adapter has no `Worklets.createRunOnJS` hop (deviation from the plan text).

## Consequences for 05-13

- Use `useMediaPipePose` from `apps/native/src/pose/useMediaPipePose.ts` (committed 5a44468). It returns `PoseSource` plus `delegate`, `lastError` and `cameraHandlers` (`onLayout`, `onOutputOrientationChanged`, `onDeviceChange`), which must be wired to the `Camera`.
- Pass `isPortrait` in the options and set `targetFps` to 60 for about 30 fps; do not use 15. Downsample to the capture rate in the consumer.
- Handle the 180-degree landscape case before recording in landscape.
- Draw front-camera overlay dots with `x = 1 - x`, and give overlay layers `direction: "ltr"`.
- Show the aspectRatio from `info` in the capture payload (0.750 portrait, 1.333 landscape).
- Re-check pull-up and dim-light visibility during UAT.
