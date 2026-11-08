import { S3Client } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { Agent as HttpsAgent } from "node:https";

import { env } from "../config/env";

const R2_CONNECTION_TIMEOUT_MS = 5_000;
const R2_REQUEST_TIMEOUT_MS = 10_000;
const R2_MAX_SOCKETS = 15;
const R2_MAX_FREE_SOCKETS = 5;

const httpsAgent = new HttpsAgent({
  keepAlive: true,
  maxSockets: R2_MAX_SOCKETS,
  maxFreeSockets: R2_MAX_FREE_SOCKETS,
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
