import { redisConnection } from "../../../src/lib/redis";
import { formAnalysisQueue } from "../../../src/lib/queue";
import { closeProgressBus } from "../../../src/lib/progressBus";

export const resetAnalysisQueue = () =>
  formAnalysisQueue.obliterate({ force: true });

export const closeQueueConnections = async () => {
  await formAnalysisQueue.close();
  await closeProgressBus();
  await redisConnection.quit();
};
