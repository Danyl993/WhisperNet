from mysql_database import get_mysql_connection


connection = get_mysql_connection()

cursor = connection.cursor()

cursor.execute(
    """
    SELECT
        issue_id,
        title,
        description,
        priority,
        status
    FROM ISSUES
    ORDER BY issue_id;
    """
)

issues = cursor.fetchall()

print("\nIssues in MySQL:")
print("-" * 60)

for issue_id, title, description, priority, status in issues:
    print(f"Issue ID: {issue_id}")
    print(f"Title: {title}")
    print(f"Description: {description}")
    print(f"Priority: {priority}")
    print(f"Status: {status}")
    print("-" * 60)

cursor.close()
connection.close()