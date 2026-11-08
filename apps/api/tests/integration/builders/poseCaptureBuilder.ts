import type { PoseCapturePayload } from "@repo/common";

type Frame = PoseCapturePayload["frames"][number];

const DEFAULT_FPS = 15;
const DEFAULT_FRAME_COUNT = 900;
const DEFAULT_KEYPOINTS = 17;

export class PoseCaptureBuilder {
  private payload: PoseCapturePayload = {
    version: 1,
    poseModelName: "movenet-lightning",
    poseModelVersion: "4",
    fps: DEFAULT_FPS,
    frameCount: DEFAULT_FRAME_COUNT,
    durationSec: 60,
    frames: [],
  };
  private frameCount = DEFAULT_FRAME_COUNT;
  private keypointCount = DEFAULT_KEYPOINTS;
  private randomCoordinates = false;
  private frameCountOverride: number | undefined;

  setFrames(count: number, keypoints: number = DEFAULT_KEYPOINTS) {
    this.frameCount = count;
    this.keypointCount = keypoints;
    return this;
  }

  setFrameCount(count: number) {
    this.frameCountOverride = count;
    return this;
  }

  setRandomCoordinates() {
    this.randomCoordinates = true;
    return this;
  }

  build(): PoseCapturePayload {
    const frames: Frame[] = Array.from({ length: this.frameCount }, (_, i) => ({
      timestampSec: i / DEFAULT_FPS,
      keypoints: Array.from(
        { length: this.keypointCount },
        (): [number, number, number] =>
          this.randomCoordinates
            ? [Math.random(), Math.random(), Math.random()]
            : [0.5, 0.5, 0.9],
      ),
    }));

    return {
      ...this.payload,
      frameCount: this.frameCountOverride ?? this.frameCount,
      durationSec: Math.min(this.frameCount / DEFAULT_FPS, 180),
      frames,
    };
  }
}
