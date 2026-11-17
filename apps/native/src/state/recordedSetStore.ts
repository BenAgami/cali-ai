export interface RecordedSetKey {
  workoutPlanId: number;
  setNumber: number;
}

let pending: RecordedSetKey | undefined;

export const markRecordedSetDone = (key: RecordedSetKey): void => {
  pending = key;
};

/** True once when the stored key matches, then clears. */
export const consumeRecordedSetDone = (key: RecordedSetKey): boolean => {
  const isMatch =
    pending !== undefined &&
    pending.workoutPlanId === key.workoutPlanId &&
    pending.setNumber === key.setNumber;
  if (isMatch) pending = undefined;
  return isMatch;
};
