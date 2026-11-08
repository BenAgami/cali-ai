import { promisify } from "node:util";
import { gunzip, gzip } from "node:zlib";
import {
  poseCapturePayloadSchema,
  type PoseCapturePayload,
} from "@repo/common";
import { getZodErrorMessage } from "./zodErrorMessage";

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export const KEYPOINTS_FORMAT = "gzip-json-v1";

export class InvalidCaptureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidCaptureError";
  }
}

export const encodeCapture = async (
  payload: PoseCapturePayload,
): Promise<Buffer> => gzipAsync(Buffer.from(JSON.stringify(payload)));

export const decodeCapture = async (
  bytes: Uint8Array,
): Promise<PoseCapturePayload> => {
  let raw: Buffer;
  try {
    raw = await gunzipAsync(bytes);
  } catch {
    throw new InvalidCaptureError("Capture blob is not valid gzip");
  }

  let json: unknown;
  try {
    json = JSON.parse(raw.toString("utf8"));
  } catch {
    throw new InvalidCaptureError("Capture blob is not valid JSON");
  }

  const result = poseCapturePayloadSchema.safeParse(json);
  if (!result.success) {
    throw new InvalidCaptureError(
      getZodErrorMessage(result.error)
        .map((issue) => issue.message)
        .join("; "),
    );
  }
  return result.data;
};
