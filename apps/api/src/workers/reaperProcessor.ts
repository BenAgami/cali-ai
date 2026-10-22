import type { Job } from "bullmq";

import { logger } from "../lib/logger";
import analysisStateService from "../services/analysisStateService";

export const processReapJob = async (job: Job): Promise<{ reaped: number }> => {
  const log = logger.child({ jobId: job.id ?? "" });
  const ids = await analysisStateService.reapStuck(new Date(), log);

  if (ids.length > 0) {
    log.warn({ sessionIds: ids }, "Failed stuck analysis sessions");
  }

  return { reaped: ids.length };
};
