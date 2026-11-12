export type RecordedSetRun<T> = {
  /** Null for sets recorded outside any run. */
  runId: number | null;
  /** The group's newest set. */
  performedAt: string;
  items: T[];
};

/** Groups newest-first sets by workout run, keeping the newest run first. */
export const groupRecordedSetsByRun = <
  T extends { workoutLogId: number | null; performedAt: string },
>(
  items: T[],
): RecordedSetRun<T>[] => {
  const groups = new Map<number | null, RecordedSetRun<T>>();
  for (const item of items) {
    const group = groups.get(item.workoutLogId);
    if (group) {
      group.items.push(item);
    } else {
      groups.set(item.workoutLogId, {
        runId: item.workoutLogId,
        performedAt: item.performedAt,
        items: [item],
      });
    }
  }
  return [...groups.values()];
};
