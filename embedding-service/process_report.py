from mysql_database import get_mysql_connection
from database import get_connection
from embedding import generate_embedding


TOP_K = 3
SIMILARITY_THRESHOLD = 0.70


def find_similar_reports(text: str):
    """
    Generate an embedding for the report text and find
    the top-K semantically similar reports.
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
    Find the issue associated with a report.
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
    Determine whether a new report should be linked
    to an existing issue or create a new issue.
    """

    similar_reports = find_similar_reports(report_text)

    connection = get_mysql_connection()

    try:
        print("\nTop similar reports:")
        print("-" * 50)

        issue_scores = {}

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

                if issue_id not in issue_scores:
                    issue_scores[issue_id] = []

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


if __name__ == "__main__":

    test_reports = [

        "The lecture notes and course materials are not uploaded on time.",

        "The classroom projector is not working properly during lectures.",

        "The hostel water supply keeps getting interrupted.",

        "The college cafeteria food is too expensive."

    ]

    for new_report in test_reports:

        print("\n" + "=" * 70)
        print("NEW REPORT:")
        print(new_report)
        print("=" * 70)

        result = detect_issue(new_report)

        print("\nDecision:")
        print(result)