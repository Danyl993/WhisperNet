from mysql_database import get_mysql_connection
from database import get_connection
from embedding import generate_embedding


TOP_K = 3
SIMILARITY_THRESHOLD = 0.70


def get_report(report_id: int):
    """
    Fetch a report's details from MySQL.
    """

    connection = get_mysql_connection()

    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    report_id,
                    category_id,
                    title,
                    description
                FROM REPORTS
                WHERE report_id = %s;
                """,
                (report_id,),
            )

            return cursor.fetchone()

    finally:
        connection.close()


def find_similar_reports(text: str):
    """
    Generate an embedding and find the top-K
    semantically similar reports in Supabase.
    """

    embedding = generate_embedding(text)

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    report_id,
                    1 - (embedding <=> %s::vector) AS similarity
                FROM report_embeddings
                ORDER BY embedding <=> %s::vector
                LIMIT %s;
                """,
                (embedding, embedding, TOP_K),
            )

            return cursor.fetchall()


def find_issue_for_report(connection, report_id: int):
    """
    Find the issue currently associated with a report.
    """

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT issue_id
            FROM ISSUE_REPORTS
            WHERE report_id = %s
            LIMIT 1;
            """,
            (report_id,),
        )

        result = cursor.fetchone()

        if result:
            return result[0]

        return None


def detect_issue(report_text: str):
    """
    Determine whether the report should be linked
    to an existing issue or create a new issue.
    """

    similar_reports = find_similar_reports(report_text)

    connection = get_mysql_connection()

    try:
        issue_scores = {}

        print("\nTop similar reports:")
        print("-" * 50)

        for report_id, similarity in similar_reports:

            issue_id = find_issue_for_report(
                connection,
                report_id
            )

            print(
                f"Report {report_id} | "
                f"Similarity: {similarity:.4f} | "
                f"Issue: {issue_id}"
            )

            if (
                issue_id is not None
                and similarity >= SIMILARITY_THRESHOLD
            ):
                issue_scores.setdefault(issue_id, [])
                issue_scores[issue_id].append(similarity)

        if not issue_scores:
            return {
                "action": "CREATE_ISSUE",
                "issue_id": None,
                "similarity": None
            }

        best_issue_id = max(
            issue_scores,
            key=lambda issue_id:
                max(issue_scores[issue_id])
        )

        best_similarity = max(
            issue_scores[best_issue_id]
        )

        return {
            "action": "LINK_TO_ISSUE",
            "issue_id": best_issue_id,
            "similarity": best_similarity
        }

    finally:
        connection.close()


def store_embedding(report_id: int, text: str):
    """
    Generate and store the report embedding in Supabase.
    """

    embedding = generate_embedding(text)

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO report_embeddings
                    (report_id, embedding)
                VALUES
                    (%s, %s::vector)
                ON CONFLICT (report_id)
                DO UPDATE SET
                    embedding = EXCLUDED.embedding;
                """,
                (report_id, embedding),
            )

        connection.commit()

    print(f"Embedding stored for Report {report_id}.")


def process_report(report_id: int):
    """
    Process an existing MySQL report.

    If a matching issue exists:
        Link the report to that issue.

    Otherwise:
        Create a new issue and link the report to it.
    """

    report = get_report(report_id)

    if report is None:
        print(f"Report {report_id} does not exist.")
        return

    report_id, category_id, title, description = report

    print("\n" + "=" * 70)
    print(f"PROCESSING REPORT {report_id}")
    print("=" * 70)
    print(f"Title: {title}")
    print(f"Description: {description}")
    print(f"Category ID: {category_id}")

    report_text = f"{title}. {description}"

    # Store or update the embedding BEFORE checking
    # whether the report is already linked to an issue.
    store_embedding(report_id, report_text)

    # Check whether this report is already linked.
    existing_issue = None

    connection = get_mysql_connection()

    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT issue_id
                FROM ISSUE_REPORTS
                WHERE report_id = %s;
                """,
                (report_id,),
            )

            result = cursor.fetchone()

            if result:
                existing_issue = result[0]

    finally:
        connection.close()

    if existing_issue is not None:
        print(
            f"\nReport {report_id} is already linked "
            f"to Issue {existing_issue}."
        )
        print("No database changes were made.")
        return

    # Detect whether the report belongs to an existing issue.
    result = detect_issue(report_text)

    print("\nDetection result:")
    print(result)

    connection = get_mysql_connection()

    try:
        connection.start_transaction()

        with connection.cursor() as cursor:

            if result["action"] == "LINK_TO_ISSUE":

                issue_id = result["issue_id"]
                similarity = result["similarity"]

                cursor.execute(
                    """
                    INSERT INTO ISSUE_REPORTS
                        (issue_id, report_id, similarity_score)
                    VALUES
                        (%s, %s, %s);
                    """,
                    (
                        issue_id,
                        report_id,
                        similarity
                    ),
                )

                print(
                    f"\nReport {report_id} linked "
                    f"to Issue {issue_id}."
                )

            else:

                cursor.execute(
                    """
                    INSERT INTO ISSUES
                        (
                            category_id,
                            title,
                            description,
                            priority,
                            status
                        )
                    VALUES
                        (
                            %s,
                            %s,
                            %s,
                            'MEDIUM',
                            'OPEN'
                        );
                    """,
                    (
                        category_id,
                        title,
                        description
                    ),
                )

                issue_id = cursor.lastrowid
                similarity = None

                cursor.execute(
                    """
                    INSERT INTO ISSUE_REPORTS
                        (
                            issue_id,
                            report_id,
                            similarity_score
                        )
                    VALUES
                        (
                            %s,
                            %s,
                            %s
                        );
                    """,
                    (
                        issue_id,
                        report_id,
                        similarity
                    ),
                )

                print(
                    f"\nNew Issue {issue_id} created "
                    f"for Report {report_id}."
                )

        connection.commit()

        print("Database transaction committed successfully.")

    except Exception as error:

        connection.rollback()

        print("\nDatabase transaction rolled back.")
        print("Error:", error)

    finally:
        connection.close()


if __name__ == "__main__":

    # Test with Report 4
    process_report(4)