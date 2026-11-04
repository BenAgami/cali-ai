# Phase 4 Golden-Set Eval Results (D-22)

- Date: 2026-11-04
- Prompt version: workout-plan-v1
- Golden set: 6 goals x 2 levels (BEGINNER, ADVANCED) = 12 calls per model, 24 total
- Raw output: `apps/api/scripts/workout-eval/results/2026-11-04T10-20-45.379Z.json`
- Command: `yarn workspace api eval:workouts` (run from `apps/api`)

## Results

| Metric                       | claude-haiku-5-5 (effort low) | claude-sonnet-5-5 (effort medium) |
| ---------------------------- | ----------------------------- | --------------------------------- |
| schemaValid                  | 58%                           | 100%                              |
| catalogValid                 | 58%                           | 100%                              |
| restPresent                  | 100%                          | 100%                              |
| levelDiffers                 | 33%                           | 100%                              |
| note on handstand and knee   | 50%                           | 100%                              |
| p50 latency (ms)             | 3133                          | 2356                              |
| max latency (ms)             | 15007                         | 5714                              |
| mean input tokens            | 1388                          | 1388                              |
| mean output tokens           | 265                           | 248                               |

## Notable failures (Haiku)

5 of 12 Haiku calls failed outright, which is what drives the low rates:

- TIMEOUT (15 s, hit `LLM_PRIMARY_TIMEOUT_MS`): pull-up ADVANCED, push-up endurance ADVANCED, handstand BEGINNER
- UNAVAILABLE: 20-minute full-body BEGINNER (14.5 s), handstand ADVANCED (4.2 s)

Sonnet had no failures. Successful Haiku calls were fast (1.8-4.2 s), so the
failures look like intermittent provider timeouts or unavailability rather than
plan-quality problems. The eval counts a failed call as schema/catalog invalid,
so the quality numbers are confounded with availability. Only one run was done
(no retries on paid calls).

## Decision

D-22 rule: keep Haiku primary only if catalogValid >= 90%, levelDiffers >= 80%
and restPresent = 100%. Haiku measured 58% / 33% / 100%, so it MISSES the
thresholds. The model default is NOT changed. Per the plan this is escalated to
the user as a decision:

- (a) Keep Haiku first; the fallback ladder covers failures, at higher Sonnet spend.
- (b) Make Sonnet primary (changes D-16).
- (c) Revise the prompt in `workoutPlanPrompt.ts` and/or rerun the eval (a rerun would help separate provider flakiness from quality).

Latency rule: Haiku p50 is 3.1 s, well under 10 s, so no timeout default change is made.
