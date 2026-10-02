import os

import psycopg
from dotenv import load_dotenv


load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set in the .env file")


def get_connection():
    """
    Create a connection to the Supabase PostgreSQL database.
    """
    return psycopg.connect(DATABASE_URL)