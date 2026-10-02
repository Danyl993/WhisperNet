import os

import psycopg
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer


load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set in the .env file")


MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

model = SentenceTransformer(MODEL_NAME)


def get_connection():
    return psycopg.connect(DATABASE_URL)


def generate_embedding(text: str):
    return model.encode(text).tolist()


test_reports = [
    (
        2,
        "Students struggle to find parking on campus.",
    ),
    (
        3,
        "There are very few parking spaces near the engineering block.",
    ),
    (
        4,
        "The library Wi-Fi is extremely slow and keeps disconnecting.",
    ),
    (
        5,
        "Internet connectivity in the library is terrible.",
    ),
    (
        6,
        "The cafeteria food is too expensive for students.",
    ),
]


with get_connection() as connection:

    with connection.cursor() as cursor:

        for report_id, text in test_reports:

            embedding = generate_embedding(text)

            cursor.execute(
                """
                INSERT INTO report_embeddings
                    (report_id, embedding)
                VALUES
                    (%s, %s)
                ON CONFLICT (report_id)
                DO NOTHING;
                """,
                (report_id, embedding),
            )

        connection.commit()


print("Test embeddings inserted successfully.")