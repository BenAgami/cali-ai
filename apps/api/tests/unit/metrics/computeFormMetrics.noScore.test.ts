import { computeFormMetrics } from "../../../src/metrics/computeFormMetrics";
import { buildSyntheticCapture } from "../helpers/syntheticPose";

// Rep features can all be NaN when joints are missing at the rep frames while
// the capture as a whole still passes trackability; model that by leaving every
// dimension unscored.
vi.mock("../../../src/metrics/scoring", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/metrics/scoring")>()),
  buildDimensions: () => ({
    ROM: { score: null, band: null, isAssessed: false },
    CORE: { score: null, band: null, isAssessed: false },
    SYMMETRY: { score: null, band: null, isAssessed: false },
  }),
}));

describe("computeFormMetrics with no scorable dimension", () => {
  it("returns UNTRACKABLE instead of a fabricated POOR score", () => {
    const result = computeFormMetrics(
      buildSyntheticCapture({ exercise: "push_up", reps: 5 }),
      "push_up",
    );

    expect(result).toMatchObject({
      outcome: "UNTRACKABLE",
      reasons: ["KEY_JOINTS_HIDDEN"],
    });
    expect(result).not.toHaveProperty("overallScore");
  });
});
