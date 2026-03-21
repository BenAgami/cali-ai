# Feature Research

**Domain:** Calisthenics mobile app with AI form analysis and workout generation
**Researched:** 2026-03-21
**Confidence:** MEDIUM (ecosystem well-mapped; AI form analysis pipeline is novel enough that some claims rely on single sources)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Exercise library with video demos | Every fitness app has this; users need to know what correct form looks like before filming themselves | LOW | Already seeded via API. Native UI just needs to display it. |
| Workout session logging (sets, reps, rest) | Core fitness tracking primitive; without it there's nothing to analyze over time | LOW | Session model already exists. Needs UI wiring. |
| Post-set video upload + AI form feedback | This is the core product promise. Users who download specifically for AI analysis will churn immediately if absent | HIGH | The primary new technical surface. Requires video ingestion, pose estimation, and LLM feedback generation. |
| Form score per set | Users need a concrete output to anchor progress ("I went from 62 to 79 on push-ups"). Pure text feedback without a number feels vague | MEDIUM | Scoring schema must be consistent enough to trend over time. Define rubric before building. |
| Progress over time — form score history | Users need to see their arc. Without trend data the AI feedback is a one-off event, not a coaching relationship | MEDIUM | Requires persisting scores per set with timestamps. Simple charting on mobile. |
| User profile (name, avatar, fitness level) | Required for personalization framing. "Your AI coach" feels hollow without it. Also used to calibrate difficulty of generated workouts | LOW | Display name, avatar, fitness level (beginner/intermediate/advanced), goals. Do not bloat with biometric data in v1. |
| Workout builder — manual | Users who are experienced athletes or have specific programs will not trust AI-only generation. Manual fallback is required | MEDIUM | Pick exercises from catalog, set reps/sets/rest, name and save. |
| Named, saveable workouts | Repeat-ability is the core habit loop. Users need to run "my Monday push workout" without rebuilding it | LOW | Depends on manual workout builder. Simple save/load. |
| Push notifications for workout reminders | Standard retention mechanic. Apps without this see rapid DAU decay | LOW | Basic scheduled local notifications via Expo. Do not build a complex rule engine in v1. |

---

### Differentiators (Competitive Advantage)

Features that set the product apart. These align with the core value: "film yourself, get coached."

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Real-time form cues during a set | Competitors (Gymscore, ChAIron) offer post-hoc analysis. Live audio/visual cues mid-set change the training experience — you correct immediately rather than after the fact | HIGH | Requires on-device pose estimation (MediaPipe via TFLite) running at inference time. Battery and latency constraints are real. This is the hardest feature in the roadmap. Validate post-set analysis first. |
| AI-generated workout from a goal description | "Build a 4-day upper-body program for someone who can do 10 pull-ups" — natural language to structured workout. Freeletics does this but within rigid templates. LLM generation is more flexible | MEDIUM | Claude API with a structured output schema. Requires user profile context for calibration. Validate the manual builder first so AI output can be compared to a known good baseline. |
| Per-exercise form score trend charts | Most apps show session-level volume/weight trends. Showing "your push-up quality score over 8 weeks" is unique to AI-analysis apps and directly reinforces the core value | MEDIUM | Requires aggregating set-level AI scores. Needs at least 3-4 sessions of data before charts are meaningful — use empty states well. |
| Actionable, rep-level feedback text | Generic feedback ("keep your back straight") is table stakes in 2026. Specific, rep-referenced feedback ("in rep 4, your hips dropped 20 degrees") is differentiated and builds trust in the AI | MEDIUM | LLM prompt engineering + structured output from pose data. Quality depends heavily on the quality of pose keypoints delivered to the LLM. |
| Explainable form scores | A score of 74/100 is meaningless without breakdown. Showing "Range of Motion: 82, Core stability: 61, Symmetry: 79" gives users something to act on | LOW | Schema design decision more than engineering lift. Define breakdown categories per exercise type. |
| Offline workout execution | Users train in gyms with poor signal. Competitor apps that require connectivity mid-workout get abandoned. Downloading a workout for offline use is a clear differentiator vs cloud-dependent competitors | MEDIUM | Local SQLite via Expo + sync on reconnect. Not v1 scope but plan the data model for it now. |

---

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create disproportionate cost or risk.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Social feed / sharing workouts | Users want community; sharing feels viral | Social content moderation, spam, feed ranking, and real-time infra are a separate product. Freeletics spent years on this. It dilutes focus from AI coaching, which is the actual differentiator | Add a simple "share this form score" deep-link card. Let iOS/Android native share sheets handle it. No in-app feed. |
| Nutrition / meal planning | Users associate fitness with diet; cross-sell opportunity feels obvious | Nutrition is a regulated domain with its own data complexity (food databases, calorie APIs, dietary restriction logic). It doubles the product surface for a calisthenics-first app | Out of scope v1. If demanded, partner with an existing nutrition API (e.g., Nutritionix) rather than building from scratch. |
| Wearable integration (Apple Watch, Garmin) | Users expect their fitness data connected | Heart rate and biometric sync adds a third SDK surface with platform-specific permission flows. It doesn't improve form analysis quality. | Defer entirely. The AI form feedback loop does not require biometric data. Re-evaluate at v2 if users ask. |
| Auto-detect exercise from video | "The app should know what I'm doing" is a frequent user request | Auto-detection accuracy is low (~60-70%) for bodyweight movements (pose estimation alone cannot distinguish push-up variants from dips easily). False detection breaks the analysis trust | Require the user to select the exercise before recording. This matches how Gymscore and ChAIron handle it. Clearly explain why in onboarding. |
| Full AI form analysis on 2500+ exercises | Breadth signals completeness | Deep, accurate, trustworthy analysis on 4-6 core moves is far more valuable than shallow analysis on hundreds. Each exercise needs a custom scoring rubric, cueing logic, and test data. Spreading thin destroys quality | Launch with push-ups, pull-ups, dips, squats. Make coverage depth and accuracy a quality signal, not exercise count. |
| Live video streaming / virtual trainer session | "Talk to an AI trainer live" sounds compelling | WebRTC + real-time AI inference on a server is extreme infrastructure complexity with high latency risk. The UX bar to be better than a Zoom call with a human trainer is very high | Post-set analysis + real-time on-device inference (if resources allow) covers the same user need without server-streaming complexity. |
| In-app chat between users | Community requests | Real-time messaging is a separate product with moderation, safety, and infrastructure requirements | Not in scope. No in-app social messaging. |
| Nutrition / food logging | Frequently bundled in fitness apps | Outside domain of calisthenics / AI form. Adds data complexity without advancing core value | Out of scope. Refer users to MyFitnessPal. |

---

## Feature Dependencies

```
User Profile
    └──required by──> AI Workout Generation (needs fitness level + goals for prompt context)
    └──required by──> Progress Tracking (anchor for all historical data)

Exercise Catalog (existing)
    └──required by──> Manual Workout Builder (pick exercises from catalog)
    └──required by──> AI Form Analysis (must know which exercise to analyze)

Manual Workout Builder
    └──required by──> Workout Sessions (sessions execute a saved workout)
    └──validates──> AI Workout Generation (humans need to verify AI output is reasonable)

Workout Sessions (existing)
    └──required by──> Post-Set Video Upload + AI Form Analysis
    └──required by──> Progress Tracking (sessions are the unit of history)

Post-Set AI Form Analysis (form score + feedback text)
    └──required by──> Progress Tracking — form scores over time
    └──enables──> Real-Time Form Cues (real-time is the harder version of the same pipeline)

Post-Set AI Form Analysis ──precedes──> Real-Time Form Cues
    (Validate the analysis quality post-hoc before attempting live inference)

AI Workout Generation ──enhances──> Manual Workout Builder
    (Generated workouts are editable via the manual builder)

Push Notifications ──enhances──> Workout Sessions
    (Reminders drive session starts)
```

### Dependency Notes

- **User Profile required by AI Workout Generation:** The LLM prompt must include fitness level, goals, and available equipment. Without this context the output is generic and low quality.
- **Manual Workout Builder validates AI Workout Generation:** Users who build their own workouts develop intuition for what a good workout looks like. This makes them better evaluators of AI output, reducing the "AI gave me something weird" churn risk.
- **Post-set analysis precedes real-time cues:** Real-time is the same pose estimation pipeline running at inference time on live frames instead of a video file. You cannot de-risk real-time until you know the analysis produces trustworthy output on uploaded video first.
- **Progress Tracking requires both Session data and Form Scores:** If form analysis is not yet built, progress tracking falls back to session frequency only (useful but incomplete). Plan schema to accommodate both from the start.

---

## MVP Definition

### Launch With (v1) — This Milestone

- [ ] User profile (name, avatar, fitness level, goal) — required anchor for personalization claims
- [ ] Manual workout builder — saves named workouts with exercises, sets, reps, rest
- [ ] AI workout generation from goal description — differentiator; validates LLM integration before video pipeline
- [ ] Post-set AI form analysis — upload video, receive form score + breakdown + feedback text (push-ups, pull-ups, dips, squats)
- [ ] Progress tracking — session history list, per-exercise form score trend chart, overall form score trend
- [ ] Real-time form cues (live camera) — high-value differentiator; implement after post-set analysis is validated

### Add After Validation (v1.x)

- [ ] Offline workout download — add when users report connectivity problems mid-session (trigger: support requests or low session completion rate in poor-signal areas)
- [ ] Explainable form score breakdown UI improvements — add when initial scoring schema is validated by user feedback
- [ ] Push notification rules (e.g., "rest day reminder") — add after baseline session frequency data is available to inform timing

### Future Consideration (v2+)

- [ ] Additional exercise coverage beyond core 4 — add after AI quality on core moves is consistently rated useful by users
- [ ] Wearable integration — defer until users ask for it and AI form pipeline is mature
- [ ] Social sharing card — lightweight share, no feed; add when retention metrics show social as a growth lever

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Post-set AI form analysis | HIGH | HIGH | P1 |
| User profile | HIGH | LOW | P1 |
| Manual workout builder | HIGH | MEDIUM | P1 |
| Progress tracking (form score history) | HIGH | MEDIUM | P1 |
| AI workout generation | HIGH | MEDIUM | P1 |
| Real-time form cues | HIGH | HIGH | P1 (after post-set validated) |
| Push notification reminders | MEDIUM | LOW | P2 |
| Offline workout execution | MEDIUM | MEDIUM | P2 |
| Social share card | LOW | LOW | P3 |
| Wearable integration | LOW | HIGH | P3 |
| In-app social feed | LOW | HIGH | defer |

**Priority key:**
- P1: Must have for this milestone
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | Freeletics | Gymscore | ChAIron | Cali-AI Approach |
|---------|------------|----------|---------|-----------------|
| AI workout generation | YES — adaptive, template-based | NO | NO | YES — LLM-generated from natural language goal. More flexible than Freeletics templates. |
| Post-set form analysis | NO | YES — upload video, 0-100 score | YES | YES — score + breakdown + rep-level LLM feedback |
| Real-time form cues | NO | NO | YES | YES — planned after post-set validation |
| Exercise library | Large (HIIT/bodyweight) | 2500+ gym exercises | Calisthenics-focused | Curated calisthenics catalog (existing). Depth over breadth. |
| Progress tracking | Session history, performance graphs | Form score trend charts | Movement analytics | Session history + per-exercise form score trends |
| Social features | Strong community, leaderboards | None | None | Deliberately excluded from v1 |
| Offline mode | Partial | NO | Unknown | Planned v1.x |
| Platform | iOS, Android | iOS, Android | iOS, Android | iOS + Android via Expo |

**Key competitive gap to exploit:** No single competitor combines LLM workout generation AND AI form analysis AND real-time cues in a calisthenics-focused package. Freeletics owns generation + community. Gymscore owns post-hoc analysis. ChAIron owns real-time. Cali-AI can own all three for the calisthenics vertical.

---

## Sources

- [11 Best Calisthenics Workout Apps in 2026 — GetFit AI / bestaifitnessapp.com](https://www.bestaifitnessapp.com/blog/best-calisthenics-workout-app)
- [The 18 Best Calisthenics Apps in 2026 — CalisthenicsWorldwide](https://calisthenicsworldwide.com/apps/best-calisthenics-apps/)
- [Gymscore — AI Form Analysis product page](https://www.gymscore.ai/)
- [ChAIron — AI-Powered Training Performance](https://chairon.app/)
- [Challenges of Human Pose Estimation in AI-Powered Fitness Apps — InfoQ](https://www.infoq.com/articles/human-pose-estimation-ai-powered-fitness-apps/)
- [How I Built Real-Time AI Form Correction Into a Mobile Fitness App — DEV Community](https://dev.to/godlymane11/how-i-built-real-time-ai-form-correction-into-a-mobile-fitness-app-3k09)
- [Fitness App Trends 2025: What Users Really Want — Glance](https://thisisglance.com/blog/fitness-app-trends-2025-what-users-really-want-from-their-workout-apps)
- [AI Fitness Apps: I Tried 4 Personal Trainer Alternatives — Humai Blog](https://www.humai.blog/ai-fitness-apps-i-tried-4-personal-trainer-alternatives/)
- [Boost Fitness App Retention with AI, AR & Gamification — Imaginovation](https://imaginovation.net/blog/why-fitness-apps-lose-users-ai-ar-gamification-fix/)
- [Top 5 Free AI Workout Plan Generators in 2026 — Dr Muscle](https://dr-muscle.com/ai-workout-plan-generator/)
- [Freeletics App Review 2025 — Nutritionports](https://nutritionports.com/freeletics-app-review/)

---
*Feature research for: Calisthenics mobile app with AI form analysis*
*Researched: 2026-03-21*
