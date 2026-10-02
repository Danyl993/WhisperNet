from mysql_database import get_mysql_connection


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

print("\nReports in MySQL:")
print("-" * 60)

for report_id, title, description in reports:
    print(f"Report ID: {report_id}")
    print(f"Title: {title}")
    print(f"Description: {description}")
    print("-" * 60)

cursor.close()
connection.close()