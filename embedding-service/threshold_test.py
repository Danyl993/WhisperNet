from database import get_connection
from embedding import generate_embedding


REFERENCE_REPORTS = {
    1: "Parking is difficult to find on campus.",
    4: "The library WiFi is slow and keeps disconnecting.",
    6: "The cafeteria food is too expensive.",
}


test_cases = [
    # Parking
    "There are hardly any parking spaces available on campus.",
    "Students have to park outside because campus parking is full.",
    "Finding a parking spot at college is extremely difficult.",
    "Cars are blocking the road near the college entrance.",
    "College buses are frequently delayed in the morning.",

    # WiFi
    "The library internet keeps disconnecting.",
    "The WiFi connection in the library is very slow.",
    "Students cannot get a stable internet connection in the library.",
    "The cafeteria prices are too high for students.",
    "The classrooms are too hot because the air conditioning is broken.",

    # Cafeteria
    "The cafeteria food costs too much.",
    "Students are unhappy with the high food prices.",
    "Food in the college canteen is very expensive.",
    "The library internet is extremely slow.",
    "College buses are frequently delayed.",
]


with get_connection() as connection:

    with connection.cursor() as cursor:

        for reference_id, reference_text in REFERENCE_REPORTS.items():

            reference_embedding = generate_embedding(reference_text)

            print("\n" + "=" * 60)
            print(f"REFERENCE REPORT {reference_id}")
            print(f"Text: {reference_text}")
            print("=" * 60)

            for test_text in test_cases:

                test_embedding = generate_embedding(test_text)

                cursor.execute(
                    """
                    SELECT
                        1 - (embedding <=> %s::vector) AS similarity
                    FROM report_embeddings
                    WHERE report_id = %s;
                    """,
                    (test_embedding, reference_id),
                )

                result = cursor.fetchone()

                similarity = result[0]

                print(
                    f"{similarity:.4f} | {test_text}"
                )