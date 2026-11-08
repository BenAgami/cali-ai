# Phase 1: Infrastructure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-10-22
**Phase:** 1-Infrastructure
**Areas discussed:** Capture payload & storage, SSE stream behavior, Failure/retry/reaper, Dev-build & pose-model gate

---

## Capture payload & storage

| Option | Description | Selected |
|--------|-------------|----------|
| Gzip JSON | Simple, debuggable, easy to validate | ✓ |
| Quantized binary | Smaller, needs custom codec | |

| Option | Description | Selected |
|--------|-------------|----------|
| One row, compressed blob | Single insert, simple consent deletion | ✓ |
| One row per frame | SQL-queryable, huge row counts | |

| Option | Description | Selected |
|--------|-------------|----------|
| Drop video columns in Phase 1 | One migration, schema matches design | ✓ |
| Leave until later | Less churn, dead fields remain | |

| Option | Description | Selected |
|--------|-------------|----------|
| Hard caps on size and frames | Protects worker and LLM spend | ✓ |
| Validate shape only | Simpler, abuse risk | |

**Notes:** User asked for each option to be explained and compared (pros/trade-offs) before choosing.

---

## SSE stream behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Fetch-based SSE with Bearer header | Reuses JWT middleware | ✓ |
| Short-lived token in query string | New endpoint, log leakage risk | |

| Option | Description | Selected |
|--------|-------------|----------|
| Coarse stage events | QUEUED/PROCESSING/COMPLETED/FAILED + label | |
| Fine-grained percent | Mostly fake for LLM step | |
| Other (user) | Coarse stages as foundation, percent derived from persisted stage via one range table | ✓ |

| Option | Description | Selected |
|--------|-------------|----------|
| Send current state on connect | Read from Postgres, no history | ✓ |
| Replay missed events | Needs persisted events | |

| Option | Description | Selected |
|--------|-------------|----------|
| Redis pub/sub per session | Works across instances | ✓ |
| In-process emitter | Breaks when API and worker split | |

---

## Failure, retry & reaper

| Option | Description | Selected |
|--------|-------------|----------|
| 3 attempts, exponential backoff | BullMQ-native | ✓ |
| No retries | Loses sets on LLM hiccup | |

| Option | Description | Selected |
|--------|-------------|----------|
| BullMQ repeatable job | No extra process | ✓ |
| setInterval in API | Runs per instance | |

| Option | Description | Selected |
|--------|-------------|----------|
| 3 minutes | Above worst-case retry budget | ✓ |
| 2 minutes | Risks reaping last retry | |
| 5 minutes | Still long to wait | |

| Option | Description | Selected |
|--------|-------------|----------|
| Config constant; phone shows stage label | | ✓ |
| Client-side "taking longer" state | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Re-enqueue from stored capture | Phone need not keep keypoints | ✓ |
| Phone resubmits | Breaks if app is killed | |

| Option | Description | Selected |
|--------|-------------|----------|
| Reject with 409 | Prevents double LLM spend | ✓ |
| Return existing job ID | Needs idempotency rules | |

**Notes:** User questioned whether 10 minutes is a sensible wait; timeout reduced from the roadmap's 10 minutes to 3.

---

## Dev-build & pose-model gate

| Option | Description | Selected |
|--------|-------------|----------|
| EAS iOS simulator build must compile; runtime deferred | No Apple account needed | ✓ |
| Skip iOS in Phase 1 | Late discovery of build issues | |

| Option | Description | Selected |
|--------|-------------|----------|
| Launch, model loads, pose pass on test image/video | Objective, repeatable | ✓ |
| Launch and link only | Weak bar | |

| Option | Description | Selected |
|--------|-------------|----------|
| User films clips of four exercises | | ✓ |
| Public datasets / stock footage | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Per-joint confidence and detection rate | | ✓ |
| Visual judgement only | | |

**Notes:** User is on Windows with no Apple developer account, so iOS runtime cannot be tested for now.

---

## Claude's Discretion

Numeric caps, LLM timeout/backoff values, stage names and ranges, queue naming, SSE client library.

## Deferred Ideas

Quantized binary format; iOS runtime verification; client-side slow-job state.
