# Phase 4: AI Workout Generation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-04
**Phase:** 4-AI Workout Generation
**Areas discussed:** Height/weight gate, Generate flow and preview, Plan shape and personalization, Validation/failures/cost control

---

## Height/weight gate (PROF-06)

| Option | Description | Selected |
|--------|-------------|----------|
| Inline prompt on Generate screen | Form shown when metrics are missing | ✓ (combined) |
| Block at registration/onboarding | Everyone enters up front | ✓ (combined, as optional) |
| Profile screen only | Link to profile-edit | |

**User's choice:** Optional onboarding step plus inline prompt whenever an AI feature needs the metrics.
**Notes:** Onboarding does not exist today; user explicitly kept it in Phase 4 after the scope concern was raised.

| Option | Description | Selected |
|--------|-------------|----------|
| Metric only (cm/kg) | Simplest | |
| Metric + imperial toggle | Convert on submit | ✓ (modified) |

**User's choice:** Default from device region, with a toggle, converted for storage.

| Option | Description | Selected |
|--------|-------------|----------|
| Edit on profile, new row each save | Latest wins, unchanged skipped | ✓ |
| Re-confirm before each generation | More friction | |

| Option | Description | Selected |
|--------|-------------|----------|
| Server refuses without metrics | Typed error | ✓ |
| Client-side only | Bypassable | |

---

## Generate flow and preview

| Option | Description | Selected |
|--------|-------------|----------|
| Preview, then Save or Regenerate | Not saved until accepted | ✓ |
| Auto-save then open | Junk workouts pile up | |

| Option | Description | Selected |
|--------|-------------|----------|
| One free-text box with example chips | Matches requirement | ✓ |
| Text box plus structured fields | More UI | |

| Option | Description | Selected |
|--------|-------------|----------|
| Preview and the Start button | Covers plans opened later | ✓ |
| Preview only | Misses "before starting" | |

| Option | Description | Selected |
|--------|-------------|----------|
| Button next to "create" on workouts list | One place for both ways | ✓ |
| Own tab | Adds a main tab | |

---

## Plan shape and personalization

| Option | Description | Selected |
|--------|-------------|----------|
| One session, 3-6 exercises | Fits existing model | ✓ |
| AI chooses, up to ~8 | Less predictable | |

| Option | Description | Selected |
|--------|-------------|----------|
| Closest plan plus a note | For goals the catalog can't serve | ✓ |
| Refuse with a message | Dead end | |

| Option | Description | Selected |
|--------|-------------|----------|
| Metrics sent as light context | Overlaps PROF-07 | ✓ |
| Only level and goal | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Defaults and a note | Assume beginner/general | |
| Require level and goal first | Like height/weight | ✓ |

---

## Validation, failures and cost control

| Option | Description | Selected |
|--------|-------------|----------|
| Retry once, then fail | | ✓ (later amended) |
| Silently drop invalid exercises | | |

**Notes:** Amended after the provider discussion: three attempts (Haiku, Haiku with feedback, Sonnet), then fail.

| Option | Description | Selected |
|--------|-------------|----------|
| Inside the HTTP request | Loading state | ✓ |
| Background job with progress | Reuses queue/SSE | |

| Option | Description | Selected |
|--------|-------------|----------|
| Daily cap per user | | ✓ |
| No limit | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Accept once before first use | | ✓ |
| Small always-visible text | | |

---

## Provider and model

User asked why Claude. The project already fixes Claude as the default (PROJECT.md). After a separate conversation the user pasted a summary; relevant parts were adopted (Haiku 5.5 default, Sonnet only on the last attempt, provider interface, error normalization, golden-set eval, `dip` seeded). Phase 5, training-data and Qwen items were deferred. The video-frames-to-Claude idea was flagged as conflicting with the keypoints-only decision.

## Claude's Discretion

Timeout and per-attempt limits, daily cap number, chip and disclaimer wording, AI-workout flag mechanism, prompt details, onboarding layout.

## Deferred Ideas

Multi-week programs, second LLM provider, video-frame vision fallback, Phase 5 pose/training-data notes, route docs tidy-up.
