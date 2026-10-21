# CaliAI - Data Model (MVP)

## 1. Modeling Goals

This model is designed for the MVP while staying compatible with near-term growth.

- Never persist video or frames; the phone sends keypoints only.
- Keep raw keypoints only for users who consented to training use.
- Persist structured outputs and labels, each with the versions that produced them.
- Support session history and progress analytics.
- Keep tables query-friendly for mobile timelines and comparisons.

## 2. Core Relationships

```mermaid
erDiagram
    User ||--o{ BodyMetric : records
    User ||--o{ UserGoal : sets
    User ||--o{ WorkoutSession : performs
    Exercise ||--o{ WorkoutSession : selected_in
    WorkoutSession ||--o| PoseCapture : captures
    WorkoutSession ||--o| AnalysisResult : produces
    AnalysisResult ||--o{ AnalysisFinding : contains
    PoseCapture ||--o{ FormLabel : labeled_by
    User ||--o{ TrainingConsent : grants
    MilestoneDefinition ||--o{ UserMilestone : unlocks
    User ||--o{ UserMilestone : earns

    User {
        int id PK
        uuid uuid UK
        string email UK
        string username UK
        string full_name
        string password_hash
        string role
        string experience_level
        timestamp created_at
        timestamp updated_at
    }

    Exercise {
        int id PK
        string code UK
        string display_name
        string exercise_type
        boolean is_active
        text description
        timestamp created_at
        timestamp updated_at
    }

    WorkoutSession {
        int id PK
        int user_id FK
        int exercise_id FK
        string processing_status
        text notes
        timestamp performed_at
        decimal capture_duration_sec
        decimal capture_fps
        timestamp processing_started_at
        timestamp processing_finished_at
        text failure_reason
        timestamp created_at
        timestamp updated_at
    }

    AnalysisResult {
        int id PK
        int session_id FK
        int form_score
        json score_breakdown
        text summary_feedback
        json raw_feedback
        json metrics
        text metrics_version
        text ai_model_name
        text ai_model_version
        text prompt_version
        text rubric_version
        timestamp analyzed_at
        timestamp created_at
    }

    PoseCapture {
        int id PK
        int session_id FK
        bytes keypoints
        string keypoints_format
        string pose_model_name
        string pose_model_version
        decimal fps
        int frame_count
        string camera_view
        string device_model
        string app_version
        boolean training_consent
        timestamp retain_until
        timestamp created_at
    }

    FormLabel {
        int id PK
        int capture_id FK
        string source
        string score_bucket
        json tags
        string model_version
        string prompt_version
        string rubric_version
        timestamp created_at
    }

    TrainingConsent {
        int id PK
        int user_id FK
        boolean granted
        string policy_version
        timestamp created_at
    }
```

## 3. Enums

`Role`

- `USER`
- `ADMIN`

`ExperienceLevel`

- `BEGINNER`
- `INTERMEDIATE`
- `ADVANCED`

`GoalType`

- `SKILL`
- `STRENGTH`
- `ENDURANCE`
- `MOBILITY`
- `CONSISTENCY`

`GoalStatus`

- `ACTIVE`
- `PAUSED`
- `COMPLETED`
- `DROPPED`

`ExerciseType`

- `DYNAMIC`
- `STATIC_HOLD`

`SessionStatus`

- `PENDING`
- `PROCESSING`
- `COMPLETED`
- `FAILED`

`FindingType`

- `MISTAKE`
- `CORRECTION`
- `POSITIVE`

`FindingSeverity`

- `LOW`
- `MEDIUM`
- `HIGH`

## 4. MVP Tables

### 4.1 `users`

Purpose: authentication profile root.

Fields:

- `id` INT PK (internal relation key).
- `uuid` UUID UNIQUE DEFAULT `uuidv7()` (public identifier).
- `email` TEXT UNIQUE (store normalized lowercase).
- `username` TEXT UNIQUE.
- `full_name` TEXT.
- `password_hash` TEXT.
- `role` `Role` DEFAULT `USER`.
- `experience_level` `ExperienceLevel` DEFAULT `BEGINNER`.
- `created_at` TIMESTAMPTZ DEFAULT `now()`.
- `updated_at` TIMESTAMPTZ.

Indexes:

- unique on `email`, `username`, `uuid`.

### 4.2 `user_goals`

Purpose: user profile goals and objective tracking.

Fields:

- `id` INT PK.
- `user_id` INT FK -> `users(id)` ON DELETE CASCADE.
- `goal_type` `GoalType`.
- `title` VARCHAR(120).
- `target_value` NUMERIC(10,2) NULL.
- `target_unit` VARCHAR(30) NULL (example: `reps`, `seconds`, `sessions_week`).
- `target_date` DATE NULL.
- `status` `GoalStatus` DEFAULT `ACTIVE`.
- `completed_at` TIMESTAMPTZ NULL.
- `created_at` TIMESTAMPTZ DEFAULT `now()`.
- `updated_at` TIMESTAMPTZ.

Indexes:

- `idx_user_goals_user_status` on (`user_id`, `status`).

### 4.3 `body_metrics`

Purpose: measurable physical progress points over time.

Fields:

- `id` INT PK.
- `user_id` INT FK -> `users(id)` ON DELETE CASCADE.
- `height_cm` REAL NOT NULL.
- `weight_kg` REAL NOT NULL.
- `created_at` TIMESTAMPTZ DEFAULT `now()`.

Constraints:

- `weight_kg > 0`.
- `height_cm > 0`.

Indexes:

- `idx_body_metrics_user_created_at_desc` on (`user_id`, `created_at` DESC).

### 4.4 `exercises`

Purpose: catalog of supported exercise types.

Fields:

- `id` INT PK.
- `code` VARCHAR(40) UNIQUE (example: `push_up`, `pull_up`, `squat`, `plank`).
- `display_name` VARCHAR(80).
- `exercise_type` `ExerciseType`.
- `is_active` BOOLEAN DEFAULT `true`.
- `description` TEXT NULL.
- `created_at` TIMESTAMPTZ DEFAULT `now()`.
- `updated_at` TIMESTAMPTZ.

Indexes:

- unique on `code`.

### 4.5 `workout_sessions`

Purpose: one user attempt (a captured set) for a selected exercise.

Fields:

- `id` INT PK.
- `user_id` INT FK -> `users(id)` ON DELETE CASCADE.
- `exercise_id` INT FK -> `exercises(id)`.
- `processing_status` `SessionStatus` DEFAULT `PENDING`.
- `notes` TEXT NULL.
- `performed_at` TIMESTAMPTZ DEFAULT `now()`.
- `capture_duration_sec` NUMERIC(6,2) NULL.
- `capture_fps` NUMERIC(6,2) NULL.
- `processing_started_at` TIMESTAMPTZ NULL.
- `processing_finished_at` TIMESTAMPTZ NULL.
- `failure_reason` TEXT NULL.
- `created_at` TIMESTAMPTZ DEFAULT `now()`.
- `updated_at` TIMESTAMPTZ.

Constraints:

- capture_duration_sec > 0.
- capture_fps > 0.

Indexes:

- `idx_sessions_user_performed_at_desc` on (`user_id`, `performed_at` DESC).
- `idx_sessions_user_exercise_performed_at_desc` on (`user_id`, `exercise_id`, `performed_at` DESC).
- `idx_sessions_processing_status` on (`processing_status`).

Notes:

- No video or frames are persisted. Capture metadata is persisted for
  analytics/debugging only.
- The keypoints live in `pose_captures`, not here, so session lists stay light.

### 4.6 `analysis_results`

Purpose: structured AI output for a workout session.

Fields:

- `id` INT PK.
- `session_id` INT UNIQUE FK -> `workout_sessions(id)` ON DELETE CASCADE.
- `form_score` SMALLINT CHECK (`form_score BETWEEN 0 AND 100`).
- `score_breakdown` JSONB NOT NULL DEFAULT `'{}'::jsonb`
  (example keys: `posture`, `range_of_motion`, `stability`, `symmetry`).
- `summary_feedback` TEXT NULL.
- `raw_feedback` JSONB NOT NULL DEFAULT `'{}'::jsonb`.
- `metrics` JSONB NOT NULL DEFAULT `'{}'::jsonb` (per-rep metrics the LLM was given).
- `metrics_version` VARCHAR(40) NULL.
- `ai_model_name` VARCHAR(80) NULL.
- `ai_model_version` VARCHAR(40) NULL.
- `prompt_version` VARCHAR(40) NULL.
- `rubric_version` VARCHAR(40) NULL.
- `analyzed_at` TIMESTAMPTZ DEFAULT `now()`.
- `created_at` TIMESTAMPTZ DEFAULT `now()`.

Indexes:

- unique on `session_id`.
- `idx_analysis_results_analyzed_at` on (`analyzed_at` DESC).

### 4.6a `pose_captures`

Purpose: the keypoints a phone sent for one session. Separate from
`workout_sessions` so session lists never load them.

Fields:

- `id` INT PK.
- `session_id` INT UNIQUE FK -> `workout_sessions(id)` ON DELETE CASCADE.
- `keypoints` BYTEA NULL (gzipped series; NULL after deletion).
- `keypoints_format` VARCHAR(40) (payload format version).
- `pose_model_name` VARCHAR(80), `pose_model_version` VARCHAR(40).
- `fps` NUMERIC(6,2), `frame_count` INT.
- `camera_view` VARCHAR(20) NULL (example: `side`, `front`).
- `device_model` VARCHAR(80) NULL, `app_version` VARCHAR(40) NULL.
- `context` JSONB NULL (snapshot at capture time of body and profile values, exercise variation and equipment, set position and targets, capture quality, and outcome signals; NULL for non-consented sets).
- `context_version` VARCHAR(40) NULL.
- `training_consent` BOOLEAN (snapshot of the user's consent at capture time).
- `retain_until` TIMESTAMPTZ NULL.
- `created_at` TIMESTAMPTZ DEFAULT `now()`.

Notes:

- When `training_consent` is false, the worker sets `keypoints` to NULL after
  analysis finishes.
- Payload size is roughly 25-60 KB per set.

### 4.6b `form_labels`

Purpose: judgments about a capture, from several sources, for training and
evaluation.

Fields:

- `id` INT PK.
- `capture_id` INT FK -> `pose_captures(id)` ON DELETE CASCADE.
- `source` VARCHAR(20) (`LLM`, `SELF_REVIEW`, `USER_RATING`, `OWN_MODEL`).
- `score_bucket` VARCHAR(20) (for example `90-100`, `50-60`).
- `tags` JSONB (error tags per rep).
- `model_version`, `prompt_version`, `rubric_version` VARCHAR(40) NULL.
- `created_at` TIMESTAMPTZ DEFAULT `now()`.

### 4.6c `training_consents`

Purpose: history of a user's consent to training use, for audit and
withdrawal.

Fields:

- `id` INT PK.
- `user_id` INT FK -> `users(id)` ON DELETE CASCADE.
- `granted` BOOLEAN.
- `policy_version` VARCHAR(40).
- `created_at` TIMESTAMPTZ DEFAULT `now()`.

The latest row per user is the current state.

### 4.7 `analysis_findings`

Purpose: queryable mistakes/corrections/positives from one analysis.

Fields:

- `id` INT PK.
- `analysis_result_id` INT FK -> `analysis_results(id)` ON DELETE CASCADE.
- `finding_type` `FindingType`.
- `severity` `FindingSeverity` DEFAULT `MEDIUM`.
- `code` VARCHAR(80) NULL (stable error tag from the exercise definition, example: `KNEE_VALGUS`).
- `rep_index` SMALLINT NULL (which rep the finding refers to).
- `title` VARCHAR(140).
- `description` TEXT.
- `correction` TEXT NULL.
- `body_part` VARCHAR(60) NULL.
- `start_sec` NUMERIC(6,2) NULL.
- `end_sec` NUMERIC(6,2) NULL.
- `sort_order` SMALLINT DEFAULT 0.
- `created_at` TIMESTAMPTZ DEFAULT `now()`.

Indexes:

- `idx_findings_result_type_order` on (`analysis_result_id`, `finding_type`, `sort_order`).
- `idx_findings_code` on (`code`).

## 5. Smart To Add Now (Low Cost, High Future Value)

These are not strictly required to ship MVP but are cheap to add now.

### 5.1 `milestone_definitions`

Purpose: system milestone catalog (seeded/static data).

Fields:

- `id` INT PK.
- `code` VARCHAR(60) UNIQUE (example: `first_session`, `avg_score_80_push_up`).
- `name` VARCHAR(120).
- `description` TEXT.
- `is_active` BOOLEAN DEFAULT `true`.
- `created_at` TIMESTAMPTZ DEFAULT `now()`.

### 5.2 `user_milestones`

Purpose: unlocked milestones for timeline/badges.

Fields:

- `id` INT PK.
- `user_id` INT FK -> `users(id)` ON DELETE CASCADE.
- `milestone_definition_id` INT FK -> `milestone_definitions(id)`.
- `session_id` INT NULL FK -> `workout_sessions(id)` (optional trigger source).
- `unlocked_at` TIMESTAMPTZ DEFAULT `now()`.

Indexes:

- unique on (`user_id`, `milestone_definition_id`).
- `idx_user_milestones_user_unlocked_at_desc` on (`user_id`, `unlocked_at` DESC).

## 6. Query Patterns This Supports

- My session history: `workout_sessions` filtered by `user_id`, ordered by `performed_at DESC`.
- My progress per exercise: join `workout_sessions` `analysis_results` by `exercise_id`.
- Last N scores trend: `analysis_results` through session join, ordered by `analyzed_at`.
- Most common mistakes: aggregate `analysis_findings.code` per user and exercise.
- Goal and milestone dashboard: `user_goals` `user_milestones`.

## 7. Implementation Notes

- Keep UUIDs for public APIs; keep integer IDs for relational performance.
- Keep one `analysis_results` row per session in MVP (`session_id` unique).
- Persist structured AI output (`raw_feedback`/`score_breakdown`) and findings, not media files.
- Seed `exercises` with MVP set: `push_up`, `pull_up`, `dip`, `squat`. Static holds (for example `plank`, `front_lever`) use `STATIC_HOLD` and are added with their research-based definitions.
- Training exports select only captures where `training_consent` is true and `keypoints` is not NULL, and split by user.
