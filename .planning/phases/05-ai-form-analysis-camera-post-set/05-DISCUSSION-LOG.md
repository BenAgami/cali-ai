# Phase 5: AI Form Analysis (Camera + Post-Set) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md.

**Date:** 2026-11-08
**Phase:** 5 - AI Form Analysis (Camera + Post-Set)
**Areas discussed:** Record entry & capture flow, Result screen & band display, Waiting/notification/failure UX, Feedback rubric & coaching voice

## Record entry & capture flow
| Question | Options | Chosen |
|---|---|---|
| Where is the record offer | Per set / Per exercise / Separate entry | Per set |
| How a set ends | Tap Stop / Auto-detect / Stop + cap | Tap Stop (auto-detect added to backlog) |
| Pre-record setup | Preview+guide+countdown / Tips card / Nothing | Preview + guide + countdown |
| Live setup check | Block Start / Warn only / None | Block Start until body detected |

## Result screen & band display
| Question | Options | Chosen |
|---|---|---|
| Band look | Colored badge / 5-segment meter / Text only | Colored badge |
| Dimensions | Three chip rows / Mini-bars / Weakest only | Three chip rows |
| Feedback layout | Well + 2 fix cards / Paragraph / Per-rep list | Well + up to 2 fix cards |
| Persistence | Set in workout detail + deep link / Form tab / Transient | Set in workout detail + deep link |

## Waiting, notification & failure UX
| Question | Options | Chosen |
|---|---|---|
| While analysing | Analysing row / Full-screen / Spinner | Analysing row with stage + percent |
| Notification | In-app banner + badge / + OS notification / Badge only | In-app banner + badge |
| Failure | Inline Retry / Modal / Silent auto-retry | Inline Retry |
| Untrackable body | Specific tips + Record again / Generic / Low-confidence result | Specific tips + Record again |

## Feedback rubric & coaching voice
| Question | Options | Chosen |
|---|---|---|
| Rubrics | Research drafts, user reviews / User supplies / Minimal v1 | Research drafts, user reviews in plan |
| Tone | Encouraging / Technical / Tough-love | Encouraging, concise, second person |
| Strictness | Level-agnostic / Level-calibrated | Level-agnostic |
| Consent | Reuse Phase 4 gate / Separate consent | Reuse Phase 4 gate |

## Claude's Discretion
Countdown length, live-check thresholds, banner mechanics, band colors, component structure.

## Deferred Ideas
Auto-detect end of motion (backlog); OS push when backgrounded; history/trends (Phase 7).
