import { redisConnection } from "../../../src/lib/redis";
import { formAnalysisQueue, maintenanceQueue } from "../../../src/lib/queue";
import { closeProgressBus } from "../../../src/lib/progressBus";

export const resetAnalysisQueue = () =>
  formAnalysisQueue.obliterate({ force: true });

export const closeQueueConnections = async () => {
  await formAnalysisQueue.close();
  await maintenanceQueue.close();
  await closeProgressBus();
  await redisConnection.quit();
};
