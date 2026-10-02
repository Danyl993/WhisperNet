from mysql_database import get_mysql_connection
from database import get_connection
from embedding import generate_embedding


def get_mysql_reports():
    """
    Fetch all reports from the Aiven MySQL database.
    """

    connection = get_mysql_connection()

    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT
            report_id,
            title,
            description
        FROM REPORTS
        ORDER BY report_id;
        """
    )

    reports = cursor.fetchall()

    cursor.close()
    connection.close()

    return reports


def sync_embeddings():
    """
    Generate embeddings for all MySQL reports
    and store them in Supabase PostgreSQL.
    """

    reports = get_mysql_reports()

    print(f"Found {len(reports)} reports in MySQL.")

    with get_connection() as connection:

        with connection.cursor() as cursor:

            # Remove old test embeddings.
            cursor.execute(
                "DELETE FROM report_embeddings;"
            )

            for report_id, title, description in reports:

                text = f"{title}. {description}"

                print(
                    f"Generating embedding for "
                    f"Report {report_id}: {title}"
                )

                embedding = generate_embedding(text)

                cursor.execute(
                    """
                    INSERT INTO report_embeddings
                        (report_id, embedding)
                    VALUES
                        (%s, %s::vector);
                    """,
                    (report_id, embedding),
                )

        connection.commit()

    print("\nEmbedding synchronization completed.")


if __name__ == "__main__":
    sync_embeddings()