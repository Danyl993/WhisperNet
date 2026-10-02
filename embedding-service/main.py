from similarity import find_similar_reports


def search_reports(report_text: str, limit: int = 5):
    """
    Find reports that are semantically similar to a new report.

    Args:
        report_text: Text of the new report.
        limit: Maximum number of similar reports to return.

    Returns:
        List of (report_id, similarity_score) tuples.
    """

    return find_similar_reports(
        report_text,
        limit=limit
    )


if __name__ == "__main__":

    report = (
        "Students are having difficulty "
        "finding parking spaces on campus."
    )

    results = search_reports(report)

    print("\nSemantic Search Results:")
    print("-" * 40)

    for report_id, similarity in results:

        print(
            f"Report ID: {report_id} | "
            f"Similarity: {similarity:.4f}"
        )