# WhisperNet

WhisperNet is a campus issue reporting and tracking application. Students can submit reports, browse current issues, support issues reported by others, and follow responses and status updates. Administrators can triage issues, update their status and priority, send responses to students, review activity, and create administrator accounts.

The application uses **Next.js and React** for its web interface and API, **MySQL** for application and workflow data, and a **Python FastAPI service with Supabase PostgreSQL and pgvector** to match similar reports.

## Contents

- [Roles and permissions](#roles-and-permissions)
- [Application architecture](#application-architecture)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [How report matching works](#how-report-matching-works)
- [API reference](#api-reference)
- [Database model](#database-model)
- [Project file guide](#project-file-guide)
- [Troubleshooting](#troubleshooting)

## Roles and permissions

Accounts have one of two database roles: `USER` (shown in the product as **Student**) or `ADMIN`.

| Capability | Student (`USER`) | Admin (`ADMIN`) |
| --- | :---: | :---: |
| Create an account through the sign-in page | Yes | No |
| Sign in, sign out, and change their own password | Yes | Yes |
| Submit reports and view their own activity | Yes | Yes |
| Browse active issues and view closed issues | Yes | Yes |
| Support or remove support from an issue | Yes | Yes |
| Change issue status or priority | No | Yes |
| View the administration dashboard and analytics | No | Yes |
| Send an official response to an issue | No | Yes |
| Create additional administrator accounts | No | Yes |

Public registration always assigns the `USER` role. Administrator accounts are created by an existing administrator from the admin dashboard. The API checks the account role before allowing administrator operations.

After signing in, the navigation bar shows an account menu with account details, a password-reset link, and sign-out. Admins also get links to the admin dashboard; students get a link to their activity.

## Application architecture

```text
Browser
  └─ Next.js pages and API routes
       ├─ MySQL: accounts, reports, issues, support, status history, responses
       └─ FastAPI semantic service (127.0.0.1:8000)
            ├─ sentence-transformers/all-MiniLM-L6-v2
            ├─ MySQL: report/issue matching and issue creation
            └─ Supabase PostgreSQL + pgvector: report embeddings
```

MySQL is the source of truth for accounts and issue workflow. Supabase PostgreSQL stores the 384-dimensional vector for each report; it does not hold a copy of the issue workflow. The vector table's `report_id` refers logically to `REPORTS.report_id` in MySQL, but no foreign key can span the two database systems.

The main user flows are:

1. A student creates an account or signs in.
2. A student submits a report. WhisperNet records the report and its author in MySQL.
3. The semantic service compares the report with earlier reports. It links it to a matching open issue or creates a new issue, then stores the report-to-issue link.
4. Students can see active issues, support them, and view closed issues in the closed section. Their activity page shows the status of their report and the latest admin response attached to its issue.
5. An admin updates an issue, sends a response, and can review status history and dashboard analytics.

## Getting started

### Prerequisites

- Node.js and npm
- Python 3
- A MySQL database
- A Supabase PostgreSQL project with the pgvector extension available

### Install and configure

1. Clone or open this repository and install JavaScript dependencies:

   ```bash
   npm install
   ```

2. Create the root `.env.local` file using [`.env.example`](.env.example), then set the MySQL connection values.

3. Create `embedding-service/.env` using [`embedding-service/.env.example`](embedding-service/.env.example). Set `DATABASE_URL` to the Supabase PostgreSQL connection string and set the `MYSQL_*` values to the same MySQL database used by Next.js.

4. Create and populate the databases:

   - The MySQL tables, views, triggers, and procedure are documented in [`database/mysql/README.md`](database/mysql/README.md) and [`database/whispernet_db.sql`](database/whispernet_db.sql).
   - The Supabase vector table and cosine index are in [`database/postgres/schema.sql`](database/postgres/schema.sql). Run this file in the Supabase SQL editor.
   - **Review `database/whispernet_db.sql` before executing it.** It is a combined development/demo script, not a clean migration: it contains sample inserts, test statements, and delete statements that remove rows from application tables. Do not run it end-to-end against a database with data you want to keep. Use the MySQL schema definitions and setup notes to provision a clean database.

5. Create the Python environment and install the semantic service requirements:

   **macOS/Linux**

   ```bash
   python3 -m venv embedding-service/.venv
   source embedding-service/.venv/bin/activate
   pip install -r embedding-service/requirements.txt
   ```

   **Windows PowerShell**

   ```powershell
   py -m venv embedding-service/.venv
   .\embedding-service\.venv\Scripts\Activate.ps1
   pip install -r embedding-service/requirements.txt
   ```

   The first startup may take longer because the sentence-transformer model is loaded and may need to be downloaded.

6. Start the web app and semantic service together:

   ```bash
   npm run dev
   ```

   The runner starts Uvicorn on `127.0.0.1:8000`, waits for the semantic service and model to become ready, and then starts Next.js. Keep the terminal running while using the app.

7. Open [http://localhost:3000](http://localhost:3000).

### Demo accounts

If the sample account rows from `database/whispernet_db.sql` are present, the bundled demo credentials are:

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@whispernet.test` | `Admin@123` |
| Student | `user1@whispernet.test` | `user123` |

These credentials are for local/demo use only. Change them for any non-demo deployment. Public signup creates student accounts only; an admin can create additional admins from the admin dashboard.

## Configuration

| Variable | Used by | Description |
| --- | --- | --- |
| `MYSQL_HOST` | Next.js and Python service | MySQL server host |
| `MYSQL_PORT` | Next.js and Python service | MySQL port; defaults to `3306` |
| `MYSQL_DATABASE` | Next.js and Python service | MySQL schema/database name |
| `MYSQL_USER` | Next.js and Python service | MySQL username |
| `MYSQL_PASSWORD` | Next.js and Python service | MySQL password |
| `DATABASE_URL` | Python service | Supabase PostgreSQL connection string used by psycopg |

Keep real credentials in ignored local environment files; do not commit them. The checked-in `.env.example` files contain placeholders only.

## How report matching works

The production submission path is implemented by `embedding-service/process_real_report.py`:

1. It combines the report title and description and encodes the text with `sentence-transformers/all-MiniLM-L6-v2` as a normalized 384-dimensional vector.
2. It compares that vector against previously stored vectors in pgvector using cosine similarity. The search considers up to 15 nearest reports and excludes the report currently being processed.
3. It follows the nearest reports' MySQL issue links. A candidate must meet the `0.65` similarity threshold, belong to the same category, and link to an issue that is not `CLOSED` or `RESOLVED`.
4. If an eligible issue is found, WhisperNet links the new report to the best matching issue. Otherwise, it creates a new open issue. In either case, it stores the report-to-issue relationship and the report vector.
5. A MySQL category-row lock serializes matching for simultaneous reports in the same category, reducing the chance that near-simultaneous duplicates create separate issues.

The reports API also has a fallback: if the semantic service cannot provide an issue link, it creates an issue and links the report in MySQL so the submission remains visible. That fallback preserves report visibility but cannot deduplicate semantically while the vector service is unavailable.

The threshold and top-15 candidate limit are configuration choices in `process_real_report.py`; adjust them only after reviewing matching quality with representative campus reports.

## API reference

All application API routes are Next.js route handlers under `app/api/`. Most return JSON. Student/admin authorization is based on the signed-in account and its role.

| Method and path | Purpose | Access |
| --- | --- | --- |
| `POST /api/auth/login` | Verify credentials and start a session | Public |
| `POST /api/auth/register` | Create a student account | Public |
| `POST /api/auth/logout` | Clear the session | Signed-in |
| `GET /api/auth/me` | Return the current account/session state | Public/session-aware |
| `POST /api/account/password` | Change the current account password | Signed-in |
| `POST /api/reports` | Submit a report and trigger semantic processing | Signed-in |
| `GET /api/issues` | List active and closed issues | Public |
| `GET /api/issues/[id]` | Get issue details and associated reports | Public |
| `POST /api/issues/[id]/support` | Support an issue | Signed-in |
| `DELETE /api/issues/[id]/support` | Remove support from an issue | Signed-in |
| `GET /api/activity` | Get the signed-in user's reports and supported issues | Signed-in |
| `GET /api/admin` | Get admin dashboard data and analytics | Admin |
| `POST /api/admin/accounts` | Create an admin account | Admin |
| `GET /api/admin/issues/[id]` | Get issue details, reports, and status history | Admin |
| `PATCH /api/admin/issues/[id]` | Update issue status or priority | Admin |
| `POST /api/admin/issues/[id]/responses` | Add an admin response to an issue | Admin |

The semantic service exposes `GET /` as a readiness check and `POST /process-report` to process a MySQL report ID. It is intended to be called by the Next.js app on localhost.

## Database model

The transactional MySQL schema contains:

- `USERS`: account identity, password hash, and role.
- `CATEGORIES`: report and issue categories.
- `REPORTS`: student-submitted report details and report status.
- `REPORT_AUTHORS`: private mapping from each report to its submitting user.
- `ISSUES`: grouped issue summary, status, and priority.
- `ISSUE_REPORTS`: links reports to issues and stores the semantic similarity score.
- `ISSUE_SUPPORTERS`: student support for issues.
- `STATUS_HISTORY`: audit trail of issue status changes.
- `ADMIN_RESPONSES`: responses associated with an issue and the responding admin.

The Supabase PostgreSQL database contains `public.report_embeddings`: one primary-keyed report ID, a `VECTOR(384)` embedding, and a creation timestamp. An HNSW index with cosine distance supports nearest-neighbor matching.

See [the MySQL ER diagram](docs/ER-diagrams.md#mysql), [the Supabase PostgreSQL ER diagram](docs/ER-diagrams.md#supabase-postgresql-pgvector), or [the ER diagrams and relationship notes](docs/ER-diagrams.md). A PNG rendering is available at [`docs/ER-diagram.png`](docs/ER-diagram.png).

## Project file guide

### Web application

| File or directory | Role |
| --- | --- |
| `app/page.tsx` | Public home page; loads account and issue data and provides links to reporting and issue browsing. |
| `app/login/page.tsx` | Sign-in and student account creation interface. |
| `app/issues/page.tsx` | Browse active and closed issues. |
| `app/issues/[id]/page.tsx` | Student-facing issue details, associated reports, and support controls. |
| `app/report/page.tsx` | Student report submission form. |
| `app/activity/page.tsx` | Signed-in account activity, submitted report status, linked issues, and admin responses. |
| `app/account/password/page.tsx` | Signed-in password change form. |
| `app/admin/page.tsx` | Admin dashboard, analytics, issue management entry points, and admin account creation. |
| `app/admin/issues/[id]/page.tsx` | Admin issue detail, status/priority controls, response form, and status history. |
| `components/Navbar.tsx` | Shared navigation, role-aware links, account dropdown, password link, and sign-out action. |
| `app/layout.tsx` | Root Next.js document layout and page metadata. |
| `app/globals.css` | Global styles and responsive visual design. |

### Web API routes

| File | Role |
| --- | --- |
| `app/api/auth/login/route.ts` | Validates account credentials and creates the login cookie. |
| `app/api/auth/register/route.ts` | Validates input, hashes the password, and creates a `USER` account. |
| `app/api/auth/logout/route.ts` | Clears the login cookie. |
| `app/api/auth/me/route.ts` | Validates the session against MySQL and returns the current account. |
| `app/api/account/password/route.ts` | Verifies the current password and saves a new password hash. |
| `app/api/reports/route.ts` | Creates reports and author links, invokes semantic matching, and falls back to a new issue if needed. |
| `app/api/issues/route.ts` | Retrieves issue summaries, separates closed issues, and includes report/support totals. |
| `app/api/issues/[id]/route.ts` | Retrieves issue details and associated report/support data. |
| `app/api/issues/[id]/support/route.ts` | Adds or removes the signed-in user's issue support. |
| `app/api/activity/route.ts` | Retrieves the account's submitted reports and supported issues, including linked issue status and latest admin response. |
| `app/api/admin/route.ts` | Authorizes admins and returns dashboard issue data and analytics. |
| `app/api/admin/accounts/route.ts` | Authorizes an admin and creates another admin account. |
| `app/api/admin/issues/[id]/route.ts` | Returns admin issue detail and updates status/priority while recording history. |
| `app/api/admin/issues/[id]/responses/route.ts` | Saves an admin response for an issue. |

### Database and documentation

| File | Role |
| --- | --- |
| `database/whispernet_db.sql` | MySQL development/demo script containing schema definitions, views, triggers, a procedure, sample data, diagnostics, and data-clearing statements. Read it carefully before running. |
| `database/repair_demo_account_passwords.sql` | Repairs bcrypt password hashes for known demo accounts in an existing database. |
| `database/mysql/README.md` | MySQL schema notes and ER diagram link. |
| `database/postgres/schema.sql` | Creates the pgvector extension, report embedding table, and cosine HNSW index. |
| `database/postgres/README.md` | Supabase vector-store setup and cross-database reference notes. |
| `docs/ER-diagrams.md` | Mermaid ER diagrams for MySQL and Supabase PostgreSQL. |
| `docs/ER-diagram.png` | Image rendering of the database diagrams. |

### Semantic service

| File | Role |
| --- | --- |
| `embedding-service/api.py` | FastAPI app, readiness endpoint, and report-processing endpoint. |
| `embedding-service/process_real_report.py` | Main semantic matching and issue linking/creation workflow used by the API. |
| `embedding-service/embedding.py` | Loads MiniLM and generates normalized 384-dimensional embeddings. |
| `embedding-service/database.py` | Opens Supabase PostgreSQL connections using `DATABASE_URL`. |
| `embedding-service/mysql_database.py` | Opens MySQL connections for the semantic service. |
| `embedding-service/similarity.py` | General-purpose vector similarity lookup used by exploration utilities. |
| `embedding-service/issue_detection.py` | Earlier standalone issue-detection experiment; not the API's production matching path. |
| `embedding-service/process_report.py` | Earlier standalone report-processing experiment; the API calls `process_real_report.py` instead. |
| `embedding-service/main.py` | Command-line semantic search example. |
| `embedding-service/sync_embeddings.py` | Rebuilds all Supabase report vectors from MySQL. It deletes all rows in `report_embeddings` before repopulating them; run only when that rebuild is intended. |
| `embedding-service/verify_embeddings.py` | Prints stored embedding IDs and timestamps. |
| `embedding-service/requirements.txt` | Python runtime and ML/service dependency versions. |
| `embedding-service/.env.example` | Placeholder configuration for the semantic service. |
| `embedding-service/test_data.py` | Development utility that loads example report embeddings. |
| `embedding-service/threshold_test.py` | Manual similarity/threshold exploration script. |
| `embedding-service/mysql_test.py` | Prints MySQL reports for debugging. |
| `embedding-service/mysql_issue_test.py` | Prints MySQL issues for debugging. |
| `embedding-service/mysql_issue_reports_test.py` | Prints report-to-issue links and similarity scores. |

The three Python files named `*_test.py` and `threshold_test.py` are standalone database/model inspection scripts; the repository does not define a formal automated test suite or an `npm test` command.

### Project configuration and utilities

| File | Role |
| --- | --- |
| `package.json` | JavaScript dependencies and `dev`, `dev:web`, `build`, `start`, and `lint` scripts. |
| `package-lock.json` | Exact npm dependency lockfile. |
| `scripts/with-semantic-service.cjs` | Starts Uvicorn, waits for readiness, then starts Next.js; also handles an already-running web app during development. |
| `next.config.ts` | Next.js configuration, including React strict mode. |
| `tsconfig.json` | TypeScript compiler options and the `@/*` path alias. |
| `next-env.d.ts` | Next.js-generated TypeScript declarations. |
| `.env.example` | Placeholder MySQL environment variables for the Next.js app. |
| `.gitignore` | Excludes credentials, dependency directories, build output, and Python virtual environments. |
| `README 2.md` | Empty leftover duplicate README file; the maintained project documentation is this `README.md`. |
| `route.tsx` | Root-level legacy route handler source. Next.js routes are defined under `app/`; this file is not part of the app route tree. |
| `embedding-service/app/api/auth/me/route.ts` | Stray duplicate of the web auth-status handler under the Python service directory; it is not used by FastAPI or the Next.js `app/api` routes. |

Generated/local files such as `.DS_Store`, `node_modules/`, `.next/`, and `embedding-service/.venv/` are not application source.

## Troubleshooting

### Sign-in fails

- Confirm that the root `.env.local` points to the expected MySQL host and database.
- Confirm that the `USERS` table has the account and that its stored password is a bcrypt hash.
- If using the included demo rows, verify the email/password pair above. For existing databases with older broken demo hashes, review and run `database/repair_demo_account_passwords.sql` only if you intend to reset those demo accounts.

### Report submitted but an issue was not deduplicated

- Confirm that Uvicorn is available at `http://127.0.0.1:8000` and that `DATABASE_URL` can connect to Supabase.
- Confirm that `report_embeddings` exists and that its `VECTOR(384)` dimension matches MiniLM.
- Matching requires the same category and an active linked issue as well as a similarity score at or above the threshold. A report that does not meet those conditions becomes a new issue.
- If the semantic service is unavailable, the report API's fallback creates a separate issue to keep the report visible.

### Python model or database startup fails

- Activate the environment at `embedding-service/.venv` and reinstall from `embedding-service/requirements.txt`.
- Check both environment files and ensure the Python and Next.js processes use the same MySQL database.
- Confirm the Supabase connection string and that the pgvector schema has been applied.
- The model's initial load/download can take time. The development runner waits up to two minutes for semantic readiness before starting Next.js.

### Closed issue or response is not reflected in student activity

- The student report's displayed status follows its linked issue status where a link exists.
- Responses are written to `ADMIN_RESPONSES` against the issue and the activity endpoint selects the latest response for the linked issue.
- Confirm the report has a row in `ISSUE_REPORTS`; older orphan reports are repaired by the activity endpoint when it loads.

---

For schema relationships, see [the ER diagrams](docs/ER-diagrams.md). For local configuration, start with [`.env.example`](.env.example) and [`embedding-service/.env.example`](embedding-service/.env.example).
