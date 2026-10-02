import os

import mysql.connector
from dotenv import load_dotenv


load_dotenv()


MYSQL_CONFIG = {
    "host": os.getenv("MYSQL_HOST"),
    "port": int(os.getenv("MYSQL_PORT", "3306")),
    "database": os.getenv("MYSQL_DATABASE"),
    "user": os.getenv("MYSQL_USER"),
    "password": os.getenv("MYSQL_PASSWORD"),
}


def get_mysql_connection():
    """
    Create a connection to the Aiven MySQL database.
    """
    return mysql.connector.connect(**MYSQL_CONFIG)


if __name__ == "__main__":

    connection = get_mysql_connection()

    cursor = connection.cursor()

    cursor.execute("SELECT DATABASE();")

    database = cursor.fetchone()

    print("MySQL connection successful!")
    print("Database:", database[0])

    cursor.close()
    connection.close()