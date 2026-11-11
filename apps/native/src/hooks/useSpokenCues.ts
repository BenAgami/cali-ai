import { useEffect } from "react";
import * as Speech from "expo-speech";

import {
  SPEECH_LANGUAGE,
  SPOKEN_RECORDING_STARTED,
  SPOKEN_RECORDING_STOPPED,
} from "@src/constants/recordingMessages";
import type { RecordedSetPhase } from "@src/hooks/useRecordedSet";

/** The advice is not spoken for a passing glitch, only if it persists. */
const GUIDANCE_DELAY_MS = 1500;
const GUIDANCE_REPEAT_MS = 6000;

const say = (text: string) => {
  void Speech.stop();
  Speech.speak(text, { language: SPEECH_LANGUAGE });
};

/**
 * Speaks the recorder's guidance so it works with the screen facing away
 * (back camera): placement advice, the countdown, and start/stop of the set.
 */
export const useSpokenCues = (input: {
  phase: RecordedSetPhase;
  guidance: string | null;
  countdownSecondsLeft: number;
}) => {
  const { phase, guidance, countdownSecondsLeft } = input;

  useEffect(() => {
    if (phase !== "setup" || guidance === null) return;
    const first = setTimeout(() => {
      say(guidance);
    }, GUIDANCE_DELAY_MS);
    const repeat = setInterval(() => {
      say(guidance);
    }, GUIDANCE_REPEAT_MS);
    return () => {
      clearTimeout(first);
      clearInterval(repeat);
    };
  }, [phase, guidance]);

  useEffect(() => {
    if (phase === "countdown" && countdownSecondsLeft > 0) {
      say(String(countdownSecondsLeft));
    }
  }, [phase, countdownSecondsLeft]);

  useEffect(() => {
    if (phase === "recording") say(SPOKEN_RECORDING_STARTED);
    if (phase === "uploading") say(SPOKEN_RECORDING_STOPPED);
  }, [phase]);

  useEffect(
    () => () => {
      void Speech.stop();
    },
    [],
  );
};
