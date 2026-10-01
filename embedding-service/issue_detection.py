from similarity import find_similar_reports


SIMILARITY_THRESHOLD = 0.80


def find_or_create_issue(report_text: str):

    results = find_similar_reports(
        report_text,
        limit=1
    )

    if not results:

        return {
            "action": "CREATE_ISSUE",
            "similar_report_id": None,
            "similarity": None,
        }

    similar_report_id, similarity = results[0]

    if similarity >= SIMILARITY_THRESHOLD:

        return {
            "action": "LINK_TO_ISSUE",
            "similar_report_id": similar_report_id,
            "similarity": similarity,
        }

    return {
        "action": "CREATE_ISSUE",
        "similar_report_id": similar_report_id,
        "similarity": similarity,
    }


if __name__ == "__main__":

    report = (
        "It is extremely difficult to find "
        "a parking spot on campus."
    )

    result = find_or_create_issue(report)

    print("\nDecision:")
    print(result)