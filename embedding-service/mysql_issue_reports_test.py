from mysql_database import get_mysql_connection


connection = get_mysql_connection()

cursor = connection.cursor()

cursor.execute(
    """
    SELECT
        ir.issue_id,
        ir.report_id,
        ir.similarity_score,
        r.title AS report_title,
        i.title AS issue_title
    FROM ISSUE_REPORTS ir
    JOIN REPORTS r
        ON ir.report_id = r.report_id
    JOIN ISSUES i
        ON ir.issue_id = i.issue_id
    ORDER BY ir.issue_id, ir.report_id;
    """
)

mappings = cursor.fetchall()

print("\nReport → Issue mappings:")
print("-" * 70)

for issue_id, report_id, similarity, report_title, issue_title in mappings:

    print(f"Report ID: {report_id}")
    print(f"Report: {report_title}")
    print(f"Issue ID: {issue_id}")
    print(f"Issue: {issue_title}")
    print(f"Similarity: {similarity}")
    print("-" * 70)


cursor.close()
connection.close()