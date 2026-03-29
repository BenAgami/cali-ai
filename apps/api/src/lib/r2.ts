import { S3Client } from "@aws-sdk/client-s3";
import { env } from "../config/env";

// Cloudflare R2 uses S3-compatible API with region "auto"
// Source: https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/
export const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${env.r2.accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.r2.accessKeyId,
    secretAccessKey: env.r2.secretAccessKey,
  },
});
