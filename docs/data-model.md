# CaliAI – Data Model

---

# 1. Design Principles

The data model is designed to:

- Keep AI processing stateless
- Store only structured analysis results (not raw videos)
- Support historical performance tracking
- Allow future expansion (training plans, real-time mode, etc.)
- Maintain clean relational boundaries

---

```mermaid
erDiagram

    User ||--o{ WorkoutSession : creates
    Exercise ||--o{ WorkoutSession : performed_in
    WorkoutSession ||--|| AnalysisResult : produces

    User {
        uuid id PK
        string email
        string password_hash
        string experience_level
        timestamp created_at
        timestamp updated_at
    }

    Exercise {
        uuid id PK
        string name
        string category
        boolean is_active
    }

    WorkoutSession {
        uuid id PK
        uuid user_id FK
        uuid exercise_id FK
        timestamp performed_at
        timestamp created_at
    }

    AnalysisResult {
        uuid id PK
        uuid session_id FK
        int score
        json feedback
        timestamp analyzed_at
    }
```
## 4.1 User

Represents a registered athlete.

Fields:

- id (UUID, Primary Key)
- email (Unique, Indexed)
- password_hash
- experience_level (Beginner | Intermediate | Advanced)
- created_at
- updated_at