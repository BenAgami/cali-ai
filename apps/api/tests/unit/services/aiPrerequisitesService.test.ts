import { StatusCodes } from "http-status-codes";

import { getPrismaClient } from "@repo/db";
import { AI_CONSENT_VERSION } from "@repo/common";

import { NotFoundError } from "../../../src/errors";

import {
  asPrismaClient,
  createPrismaMock,
  type PrismaMock,
} from "../helpers/prismaMock";

vi.mock("@repo/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@repo/db")>()),
  getPrismaClient: vi.fn(),
}));

const { AiPrerequisitesService } =
  await import("../../../src/services/aiPrerequisitesService");

let prisma: PrismaMock;
let service: InstanceType<typeof AiPrerequisitesService>;

const completeUser = {
  experienceLevel: "BEGINNER",
  aiConsentVersion: AI_CONSENT_VERSION,
  goals: [{ goalType: "STRENGTH", title: "10 pull-ups" }],
};
const metric = {
  heightCm: 180,
  weightKg: 75,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

beforeEach(() => {
  prisma = createPrismaMock();
  vi.mocked(getPrismaClient).mockReturnValue(asPrismaClient(prisma));
  prisma.bodyMetric.findFirst.mockResolvedValue(metric);
  service = new AiPrerequisitesService();
});

describe("AiPrerequisitesService.assertAiPrerequisites", () => {
  it("throws NotFoundError when the user is missing", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.assertAiPrerequisites(7)).rejects.toThrow(
      new NotFoundError("User not found"),
    );
  });

  it.for([
    [
      "no experience level",
      { ...completeUser, experienceLevel: null },
      metric,
      "PROFILE_INCOMPLETE",
    ],
    [
      "no active goal",
      { ...completeUser, goals: [] },
      metric,
      "PROFILE_INCOMPLETE",
    ],
    ["no body metric", completeUser, null, "BODY_METRICS_REQUIRED"],
    [
      "an outdated consent version",
      { ...completeUser, aiConsentVersion: "old" },
      metric,
      "AI_CONSENT_REQUIRED",
    ],
  ])("rejects with 428 for %s", async ([_label, user, bodyMetric, code]) => {
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.bodyMetric.findFirst.mockResolvedValue(bodyMetric);

    await expect(service.assertAiPrerequisites(7)).rejects.toMatchObject({
      status: StatusCodes.PRECONDITION_REQUIRED,
      code,
    });
  });

  it("returns the AI user context when everything is present", async () => {
    prisma.user.findUnique.mockResolvedValue(completeUser);

    await expect(service.assertAiPrerequisites(7)).resolves.toEqual({
      userId: 7,
      experienceLevel: "BEGINNER",
      goal: { goalType: "STRENGTH", title: "10 pull-ups" },
      heightCm: 180,
      weightKg: 75,
    });
  });
});
