export type RecordedSetRun<T> = {
  /** Null for sets recorded outside any run. */
  runId: number | null;
  /** When the group's first set was recorded. */
  firstPerformedAt: string;
  items: T[];
};

/**
 * Groups newest-first sets by workout run, newest run first. Sets recorded
 * outside any run always come last, wherever their newest set falls.
 */
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
      // Items arrive newest first, so the last one seen is the run's first.
      group.firstPerformedAt = item.performedAt;
    } else {
      groups.set(item.workoutLogId, {
        runId: item.workoutLogId,
        firstPerformedAt: item.performedAt,
        items: [item],
      });
    }
  }
  const runs = [...groups.values()];
  return [
    ...runs.filter((run) => run.runId !== null),
    ...runs.filter((run) => run.runId === null),
  ];
};
