from mysql_database import get_mysql_connection
from database import get_connection
from embedding import generate_embedding


TOP_K = 15
# MiniLM cosine scores around 0.65 are usually related, while the known
# canteen duplicate pair scores 0.8566. Category matching is also required.
SIMILARITY_THRESHOLD = 0.65
CLOSED_STATUSES = {"CLOSED", "RESOLVED"}


def get_report(report_id: int):
    connection = get_mysql_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT report_id, category_id, title, description
                FROM REPORTS
                WHERE report_id = %s;
                """,
                (report_id,),
            )
            return cursor.fetchone()
    finally:
        connection.close()


def find_similar_reports(embedding: list[float], exclude_report_id: int):
    """Search previously stored report vectors, never the report being processed."""
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT report_id,
                       1 - (embedding <=> %s::vector) AS similarity
                FROM report_embeddings
                WHERE report_id <> %s
                ORDER BY embedding <=> %s::vector
                LIMIT %s;
                """,
                (embedding, exclude_report_id, embedding, TOP_K),
            )
            return cursor.fetchall()


def find_issue_for_report(connection, report_id: int):
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT i.issue_id, i.category_id, i.status
            FROM ISSUE_REPORTS ir
            JOIN ISSUES i ON i.issue_id = ir.issue_id
            WHERE ir.report_id = %s
            ORDER BY ir.similarity_score DESC, ir.issue_id
            LIMIT 1;
            """,
            (report_id,),
        )
        return cursor.fetchone()


def detect_issue(connection, embedding: list[float], report_id: int, category_id: int):
    similar_reports = find_similar_reports(embedding, report_id)
    issue_scores = {}

    for similar_report_id, raw_similarity in similar_reports:
        similarity = float(raw_similarity)
        if similarity < SIMILARITY_THRESHOLD:
            # Rows are sorted by descending cosine similarity.
            break

        linked_issue = find_issue_for_report(connection, similar_report_id)
        if linked_issue is None:
            continue

        issue_id, matched_category_id, status = linked_issue
        if matched_category_id != category_id or status in CLOSED_STATUSES:
            continue

        issue_scores[issue_id] = max(issue_scores.get(issue_id, 0.0), similarity)

    if not issue_scores:
        return {"action": "CREATE_ISSUE", "issue_id": None, "similarity": None}

    best_issue_id = max(issue_scores, key=issue_scores.get)
    return {
        "action": "LINK_TO_ISSUE",
        "issue_id": best_issue_id,
        "similarity": issue_scores[best_issue_id],
    }


def store_embedding(report_id: int, embedding: list[float]):
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO report_embeddings (report_id, embedding)
                VALUES (%s, %s::vector)
                ON CONFLICT (report_id) DO UPDATE
                SET embedding = EXCLUDED.embedding;
                """,
                (report_id, embedding),
            )
        connection.commit()


def process_report(report_id: int):
    """Match against earlier reports, then link or create one issue atomically."""
    report = get_report(report_id)
    if report is None:
        return {"action": "REPORT_NOT_FOUND", "issue_id": None, "similarity": None}

    report_id, category_id, title, description = report
    report_text = f"{title}. {description}"
    embedding = generate_embedding(report_text)

    connection = get_mysql_connection()
    try:
        connection.start_transaction()
        with connection.cursor() as cursor:
            # Serialize matching for this category so two simultaneous reports
            # cannot both miss each other's new vector and create duplicate issues.
            cursor.execute(
                "SELECT category_id FROM CATEGORIES WHERE category_id = %s FOR UPDATE",
                (category_id,),
            )
            if cursor.fetchone() is None:
                raise ValueError(f"Category {category_id} does not exist")

        existing_issue = find_issue_for_report(connection, report_id)
        if existing_issue is not None:
            store_embedding(report_id, embedding)
            connection.commit()
            return {
                "action": "ALREADY_LINKED",
                "issue_id": existing_issue[0],
                "similarity": None,
            }

        # Search first; storing the current vector before the search made it
        # occupy a top-K slot and reduced the number of useful candidates.
        result = detect_issue(connection, embedding, report_id, category_id)
        store_embedding(report_id, embedding)

        with connection.cursor() as cursor:
            if result["action"] == "LINK_TO_ISSUE":
                issue_id = result["issue_id"]
                similarity = result["similarity"]
            else:
                cursor.execute(
                    """
                    INSERT INTO ISSUES (category_id, title, description, priority, status)
                    VALUES (%s, %s, %s, 'MEDIUM', 'OPEN');
                    """,
                    (category_id, title, description),
                )
                issue_id = cursor.lastrowid
                similarity = None

            cursor.execute(
                """
                INSERT INTO ISSUE_REPORTS (issue_id, report_id, similarity_score)
                VALUES (%s, %s, %s);
                """,
                (issue_id, report_id, similarity),
            )

        connection.commit()
        return {
            "action": result["action"],
            "issue_id": issue_id,
            "similarity": similarity,
        }
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


if __name__ == "__main__":
    process_report(4)
