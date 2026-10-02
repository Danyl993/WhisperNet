from database import get_connection


with get_connection() as connection:

    with connection.cursor() as cursor:

        cursor.execute(
            """
            SELECT
                report_id,
                created_at
            FROM report_embeddings
            ORDER BY report_id;
            """
        )

        rows = cursor.fetchall()

        print("\nEmbeddings in Supabase:")
        print("-" * 50)

        for report_id, created_at in rows:

            print(
                f"Report ID: {report_id} | "
                f"Created: {created_at}"
            )

        print("-" * 50)
        print(f"Total embeddings: {len(rows)}")