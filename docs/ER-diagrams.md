# WhisperNet ER diagrams

The MySQL diagram reflects the transactional schema. The Supabase diagram reflects the vector store. The dotted edge is only a logical cross-database reference; it is not enforced as a foreign key.

## MySQL

```mermaid
erDiagram
    USERS {
        int user_id PK
        varchar name
        varchar email UK
        varchar password_hash
        enum role
        datetime created_at
    }
    CATEGORIES {
        int category_id PK
        varchar name UK
        text description
    }
    REPORTS {
        int report_id PK
        int category_id FK
        varchar title
        text description
        enum status
        datetime created_at
    }
    ISSUES {
        int issue_id PK
        int category_id FK
        varchar title
        text description
        enum priority
        enum status
        datetime created_at
        datetime updated_at
    }
    REPORT_AUTHORS {
        int report_id PK, FK
        int user_id FK
    }
    ISSUE_REPORTS {
        int issue_id PK, FK
        int report_id PK, FK
        decimal similarity_score
        datetime linked_at
    }
    ISSUE_SUPPORTERS {
        int issue_id PK, FK
        int user_id PK, FK
        datetime supported_at
    }
    STATUS_HISTORY {
        int history_id PK
        int issue_id FK
        int changed_by FK
        varchar old_status
        varchar new_status
        datetime changed_at
    }
    ADMIN_RESPONSES {
        int response_id PK
        int issue_id FK
        int admin_id FK
        text response
        datetime created_at
    }

    CATEGORIES ||--o{ REPORTS : categorizes
    CATEGORIES ||--o{ ISSUES : categorizes
    REPORTS ||--o| REPORT_AUTHORS : authored_by
    USERS ||--o{ REPORT_AUTHORS : submits
    ISSUES ||--o{ ISSUE_REPORTS : groups
    REPORTS ||--o{ ISSUE_REPORTS : linked_to
    ISSUES ||--o{ ISSUE_SUPPORTERS : supported_by
    USERS ||--o{ ISSUE_SUPPORTERS : supports
    ISSUES ||--o{ STATUS_HISTORY : tracks
    USERS ||--o{ STATUS_HISTORY : changes
    ISSUES ||--o{ ADMIN_RESPONSES : receives
    USERS ||--o{ ADMIN_RESPONSES : writes
```

## Supabase PostgreSQL (pgvector)

```mermaid
erDiagram
    MYSQL_REPORTS_REFERENCE {
        int report_id PK
        string stored_in_mysql
    }
    REPORT_EMBEDDINGS {
        int report_id PK
        vector_384 embedding
        timestamptz created_at
    }

    MYSQL_REPORTS_REFERENCE ||..o| REPORT_EMBEDDINGS : has_embedding
```

`report_embeddings.report_id` is the MySQL report's ID. PostgreSQL has a primary key on it and an HNSW index using `vector_cosine_ops`; it does not have a database-enforced foreign key because the referenced `REPORTS` row lives in MySQL.
