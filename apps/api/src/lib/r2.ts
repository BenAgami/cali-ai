import { S3Client } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { Agent as HttpsAgent } from "node:https";

import { env } from "../config/env";
import { VIDEO_ANALYSIS_WORKER_CONCURRENCY } from "../config/constants";

const R2_CONNECTION_TIMEOUT_MS = 5_000;
const R2_REQUEST_TIMEOUT_MS = 10_000;
const R2_SOCKET_HEADROOM_MULTIPLIER = 3;

const httpsAgent = new HttpsAgent({
  keepAlive: true,
  maxSockets: VIDEO_ANALYSIS_WORKER_CONCURRENCY * R2_SOCKET_HEADROOM_MULTIPLIER,
  maxFreeSockets: VIDEO_ANALYSIS_WORKER_CONCURRENCY,
});

export const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${env.r2.accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.r2.accessKeyId,
    secretAccessKey: env.r2.secretAccessKey,
  },
  requestHandler: new NodeHttpHandler({
    connectionTimeout: R2_CONNECTION_TIMEOUT_MS,
    requestTimeout: R2_REQUEST_TIMEOUT_MS,
    httpsAgent,
  }),
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
  maxAttempts: 5,
});
