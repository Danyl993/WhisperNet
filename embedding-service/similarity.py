from database import get_connection
from embedding import generate_embedding


def find_similar_reports(
    text: str,
    limit: int = 5
) -> list[tuple[int, float]]:
    """
    Find the top-K reports most semantically similar to the given text.

    Returns:
        List of tuples containing:
        (report_id, similarity_score)
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
                (embedding, embedding, limit),
            )

            return cursor.fetchall()


if __name__ == "__main__":

    query = "It is very difficult to find a parking spot on campus."

    results = find_similar_reports(query, limit=5)

    print("\nTop similar reports:")

    for report_id, similarity in results:

        print(
            f"Report ID: {report_id} | "
            f"Similarity: {similarity:.4f}"
        )