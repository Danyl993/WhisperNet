USE whispernet;
SELECT DATABASE();

CREATE TABLE USERS (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE CATEGORIES (
    category_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT
);

CREATE TABLE REPORTS (
    report_id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status ENUM('PENDING', 'REVIEWED', 'MERGED', 'RESOLVED') NOT NULL DEFAULT 'PENDING',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_reports_category
        FOREIGN KEY (category_id)
        REFERENCES CATEGORIES(category_id)
);

CREATE TABLE ISSUES (
    issue_id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    priority ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NOT NULL DEFAULT 'MEDIUM',
    status ENUM('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_issues_category
        FOREIGN KEY (category_id)
        REFERENCES CATEGORIES(category_id)
);

CREATE TABLE ISSUE_REPORTS (
    issue_id INT NOT NULL,
    report_id INT NOT NULL,
    similarity_score DECIMAL(5,4),
    linked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (issue_id, report_id),

    CONSTRAINT fk_issue_reports_issue
        FOREIGN KEY (issue_id)
        REFERENCES ISSUES(issue_id),

    CONSTRAINT fk_issue_reports_report
        FOREIGN KEY (report_id)
        REFERENCES REPORTS(report_id)
);

CREATE TABLE ISSUE_SUPPORTERS (
    issue_id INT NOT NULL,
    user_id INT NOT NULL,
    supported_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (issue_id, user_id),

    CONSTRAINT fk_issue_supporters_issue
        FOREIGN KEY (issue_id)
        REFERENCES ISSUES(issue_id),

    CONSTRAINT fk_issue_supporters_user
        FOREIGN KEY (user_id)
        REFERENCES USERS(user_id)
);

CREATE TABLE REPORT_AUTHORS (
    report_id INT PRIMARY KEY,
    user_id INT NOT NULL,

    CONSTRAINT fk_report_authors_report
        FOREIGN KEY (report_id)
        REFERENCES REPORTS(report_id),

    CONSTRAINT fk_report_authors_user
        FOREIGN KEY (user_id)
        REFERENCES USERS(user_id)
);

CREATE TABLE STATUS_HISTORY (
    history_id INT AUTO_INCREMENT PRIMARY KEY,
    issue_id INT NOT NULL,
    changed_by INT NOT NULL,
    old_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_status_history_issue
        FOREIGN KEY (issue_id)
        REFERENCES ISSUES(issue_id),

    CONSTRAINT fk_status_history_user
        FOREIGN KEY (changed_by)
        REFERENCES USERS(user_id)
);

CREATE TABLE ADMIN_RESPONSES (
    response_id INT AUTO_INCREMENT PRIMARY KEY,
    issue_id INT NOT NULL,
    admin_id INT NOT NULL,
    response TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_admin_responses_issue
        FOREIGN KEY (issue_id)
        REFERENCES ISSUES(issue_id),

    CONSTRAINT fk_admin_responses_admin
        FOREIGN KEY (admin_id)
        REFERENCES USERS(user_id)
);

CREATE INDEX idx_reports_category_status
ON REPORTS(category_id, status);

CREATE INDEX idx_issues_category_status_priority
ON ISSUES(category_id, status, priority);

CREATE INDEX idx_status_history_issue
ON STATUS_HISTORY(issue_id, changed_at);

CREATE INDEX idx_admin_responses_issue
ON ADMIN_RESPONSES(issue_id, created_at);

CREATE INDEX idx_issue_reports_report
ON ISSUE_REPORTS(report_id);

CREATE INDEX idx_issue_supporters_user
ON ISSUE_SUPPORTERS(user_id);

CREATE VIEW vw_reports AS
SELECT
    r.report_id,
    r.title,
    r.description,
    r.status,
    r.created_at,
    c.category_id,
    c.name AS category_name
FROM REPORTS r
JOIN CATEGORIES c
    ON r.category_id = c.category_id;
    
CREATE VIEW vw_issues AS
SELECT
    i.issue_id,
    i.title,
    i.description,
    i.priority,
    i.status,
    i.created_at,
    i.updated_at,
    c.category_id,
    c.name AS category_name
FROM ISSUES i
JOIN CATEGORIES c
    ON i.category_id = c.category_id;
    
DELIMITER $$

CREATE TRIGGER trg_issue_status_history
AFTER UPDATE ON ISSUES
FOR EACH ROW
BEGIN
    IF OLD.status <> NEW.status THEN
        INSERT INTO STATUS_HISTORY (
            issue_id,
            changed_by,
            old_status,
            new_status
        )
        VALUES (
            NEW.issue_id,
            1,
            OLD.status,
            NEW.status
        );
    END IF;
END$$

DELIMITER ;

SHOW TRIGGERS LIKE 'ISSUES';

DELIMITER $$

CREATE TRIGGER trg_admin_response_check
BEFORE INSERT ON ADMIN_RESPONSES
FOR EACH ROW
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM USERS
        WHERE user_id = NEW.admin_id
          AND role = 'ADMIN'
    ) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Only ADMIN users can create responses';
    END IF;
END$$

DELIMITER ;

SHOW TRIGGERS LIKE 'ADMIN_RESPONSES';

CREATE VIEW vw_admin_issues AS
SELECT
    i.issue_id,
    i.title,
    i.description,
    i.priority,
    i.status,
    i.created_at,
    i.updated_at,
    c.name AS category_name,
    COUNT(ir.report_id) AS report_count
FROM ISSUES i
JOIN CATEGORIES c
    ON i.category_id = c.category_id
LEFT JOIN ISSUE_REPORTS ir
    ON i.issue_id = ir.issue_id
GROUP BY
    i.issue_id,
    i.title,
    i.description,
    i.priority,
    i.status,
    i.created_at,
    i.updated_at,
    c.name;
    
SELECT * FROM vw_admin_issues;

DELIMITER $$

CREATE PROCEDURE update_issue_status(
    IN p_issue_id INT,
    IN p_new_status VARCHAR(50),
    IN p_changed_by INT
)
BEGIN
    DECLARE v_old_status VARCHAR(50);

    START TRANSACTION;

    SELECT status
    INTO v_old_status
    FROM ISSUES
    WHERE issue_id = p_issue_id
    FOR UPDATE;

    IF v_old_status IS NULL THEN
        ROLLBACK;
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Issue not found';
    ELSE
        UPDATE ISSUES
        SET status = p_new_status
        WHERE issue_id = p_issue_id;

        INSERT INTO STATUS_HISTORY (
            issue_id,
            changed_by,
            old_status,
            new_status
        )
        VALUES (
            p_issue_id,
            p_changed_by,
            v_old_status,
            p_new_status
        );

        COMMIT;
    END IF;
END$$

DELIMITER ;

SHOW PROCEDURE STATUS
WHERE Db = 'whispernet'
  AND Name = 'update_issue_status';
  
CREATE VIEW vw_issue_status_analytics AS
SELECT
    status,
    COUNT(*) AS issue_count
FROM ISSUES
GROUP BY status;

SELECT * FROM vw_issue_status_analytics;

CREATE VIEW vw_category_issue_analytics AS
SELECT
    c.category_id,
    c.name AS category_name,
    COUNT(i.issue_id) AS issue_count
FROM CATEGORIES c
LEFT JOIN ISSUES i
    ON c.category_id = i.category_id
GROUP BY
    c.category_id,
    c.name;
SELECT * FROM vw_category_issue_analytics;

CREATE VIEW vw_issue_priority_analytics AS
SELECT
    priority,
    COUNT(*) AS issue_count
FROM ISSUES
GROUP BY priority;
SELECT * FROM vw_issue_priority_analytics;


CREATE VIEW vw_admin_issue_summary AS
SELECT
    i.issue_id,
    i.title,
    i.priority,
    i.status,
    c.name AS category_name,
    COUNT(DISTINCT ir.report_id) AS report_count,
    COUNT(DISTINCT isup.user_id) AS supporter_count
FROM ISSUES i
JOIN CATEGORIES c
    ON i.category_id = c.category_id
LEFT JOIN ISSUE_REPORTS ir
    ON i.issue_id = ir.issue_id
LEFT JOIN ISSUE_SUPPORTERS isup
    ON i.issue_id = isup.issue_id
GROUP BY
    i.issue_id,
    i.title,
    i.priority,
    i.status,
    c.name;
SELECT * FROM vw_admin_issue_summary;
SHOW TABLES;

DESCRIBE USERS;
DESCRIBE ISSUES;

INSERT INTO CATEGORIES (name, description) VALUES
('Academics', 'Academic and course-related issues'),
('Infrastructure', 'Campus infrastructure and facilities'),
('Hostel', 'Hostel-related issues'),
('Transport', 'Bus and transportation issues'),
('Canteen', 'Food and canteen-related issues');

INSERT INTO USERS (name, email, password_hash, role) VALUES
('Admin User', 'admin@whispernet.test', '$2b$10$UmoiLsb86DTj7pXD/4ROR.kiOouvcleXB7M9IGVRFbhqXwmfuYMBi', 'ADMIN'),
('Test User 1', 'user1@whispernet.test', '$2b$10$WUMW90JdcfoO77O0d5bycuXifA8zEw44di3dvLfgQQJ2JWGKE5n.G', 'USER'),
('Test User 2', 'user2@whispernet.test', '$2b$10$WUMW90JdcfoO77O0d5bycuXifA8zEw44di3dvLfgQQJ2JWGKE5n.G', 'USER');

INSERT INTO REPORTS (category_id, title, description, status) VALUES
(1, 'Missing course materials', 'Important lecture materials are not uploaded on time.', 'PENDING'),
(2, 'Broken classroom projector', 'Projector in one classroom is frequently not working.', 'REVIEWED'),
(3, 'Hostel water problem', 'Water supply is interrupted regularly.', 'PENDING');

INSERT INTO REPORT_AUTHORS (report_id, user_id) VALUES
(1, 2),
(2, 3),
(3, 2);

INSERT INTO ISSUES (category_id, title, description, priority, status) VALUES
(1, 'Course materials not available', 'Students are unable to access required lecture materials.', 'HIGH', 'OPEN'),
(2, 'Classroom projector failures', 'Projectors in classrooms are frequently unavailable.', 'MEDIUM', 'IN_PROGRESS'),
(3, 'Hostel water supply issue', 'Water supply is interrupted regularly in the hostel.', 'URGENT', 'OPEN');
INSERT INTO ISSUE_REPORTS (issue_id, report_id, similarity_score) VALUES
(1, 1, 0.9200),
(2, 2, 0.8800),
(3, 3, 0.9500);

INSERT INTO ISSUE_SUPPORTERS (issue_id, user_id) VALUES
(1, 3),
(2, 2),
(3, 2),
(3, 3);
INSERT INTO ADMIN_RESPONSES (issue_id, admin_id, response)
VALUES
(1, 1, 'We have received the issue and are reviewing it.');

CALL update_issue_status(1, 'IN_PROGRESS', 1);
SELECT *
FROM STATUS_HISTORY
WHERE issue_id = 1
ORDER BY changed_at;

DROP TRIGGER trg_issue_status_history;
SHOW TRIGGERS;

DELETE FROM STATUS_HISTORY
WHERE history_id = 2;
SELECT *
FROM STATUS_HISTORY
WHERE issue_id = 1;

SELECT * FROM vw_admin_issue_summary;
SELECT * FROM vw_admin_issues;

SELECT * FROM vw_category_issue_analytics;
SELECT * FROM vw_issue_status_analytics;

SELECT * FROM vw_issue_priority_analytics;
SELECT * FROM vw_category_issue_analytics;

SELECT * FROM vw_issue_priority_analytics;
SELECT
    issue_id,
    title,
    priority,
    status,
    created_at,
    updated_at
FROM ISSUES
ORDER BY issue_id;

SELECT
    ir.issue_id,
    ir.report_id,
    ir.similarity_score,
    r.title AS report_title
FROM ISSUE_REPORTS ir
JOIN REPORTS r
    ON ir.report_id = r.report_id
ORDER BY ir.issue_id;
SELECT
    isup.issue_id,
    isup.user_id,
    u.name AS supporter_name
FROM ISSUE_SUPPORTERS isup
JOIN USERS u
    ON isup.user_id = u.user_id
ORDER BY isup.issue_id;

SELECT
    ra.report_id,
    ra.user_id,
    u.name AS author_name
FROM REPORT_AUTHORS ra
JOIN USERS u
    ON ra.user_id = u.user_id
ORDER BY ra.report_id;
SELECT
    ar.response_id,
    ar.issue_id,
    ar.admin_id,
    u.name AS admin_name,
    ar.response,
    ar.created_at
FROM ADMIN_RESPONSES ar
JOIN USERS u
    ON ar.admin_id = u.user_id
ORDER BY ar.response_id;

INSERT INTO ADMIN_RESPONSES (issue_id, admin_id, response)
VALUES
(1, 2, 'This should not be allowed.');
SELECT
    response_id,
    issue_id,
    admin_id,
    response
FROM ADMIN_RESPONSES
ORDER BY response_id;

SELECT
    response_id,
    issue_id,
    admin_id,
    response
FROM ADMIN_RESPONSES
ORDER BY response_id;
SELECT
    TABLE_NAME,
    TABLE_ROWS
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'whispernet'
  AND TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME;


SELECT
    i.issue_id,
    i.title,
    c.name AS category,
    i.priority,
    i.status,
    COUNT(DISTINCT ir.report_id) AS report_count,
    COUNT(DISTINCT isup.user_id) AS supporter_count
FROM ISSUES i
JOIN CATEGORIES c
    ON i.category_id = c.category_id
LEFT JOIN ISSUE_REPORTS ir
    ON i.issue_id = ir.issue_id
LEFT JOIN ISSUE_SUPPORTERS isup
    ON i.issue_id = isup.issue_id
GROUP BY
    i.issue_id,
    i.title,
    c.name,
    i.priority,
    i.status
ORDER BY i.created_at DESC;
SELECT
    sh.history_id,
    sh.issue_id,
    u.name AS changed_by,
    sh.old_status,
    sh.new_status,
    sh.changed_at
FROM STATUS_HISTORY sh
JOIN USERS u
    ON sh.changed_by = u.user_id
ORDER BY sh.changed_at DESC;

CALL update_issue_status(1, 'INVALID_STATUS', 1);
SELECT
    issue_id,
    status,
    updated_at
FROM ISSUES
WHERE issue_id = 1;

SELECT
    issue_id,
    status,
    updated_at
FROM ISSUES
WHERE issue_id = 1;
SELECT
    TABLE_NAME,
    TABLE_TYPE
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'whispernet'
ORDER BY TABLE_TYPE, TABLE_NAME;

SELECT
    TABLE_NAME,
    COLUMN_NAME,
    CONSTRAINT_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'whispernet'
  AND REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY TABLE_NAME, COLUMN_NAME;
SELECT
    TABLE_NAME,
    INDEX_NAME,
    COLUMN_NAME
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = 'whispernet'
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;

SELECT
    TABLE_NAME,
    ENGINE,
    TABLE_COLLATION
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'whispernet'
  AND TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME;
SELECT
    SCHEMA_NAME,
    DEFAULT_CHARACTER_SET_NAME,
    DEFAULT_COLLATION_NAME
FROM information_schema.SCHEMATA
WHERE SCHEMA_NAME = 'whispernet';


SELECT
    'USERS' AS table_name, COUNT(*) AS row_count FROM USERS
UNION ALL
SELECT 'CATEGORIES', COUNT(*) FROM CATEGORIES
UNION ALL
SELECT 'REPORTS', COUNT(*) FROM REPORTS
UNION ALL
SELECT 'ISSUES', COUNT(*) FROM ISSUES
UNION ALL
SELECT 'ISSUE_REPORTS', COUNT(*) FROM ISSUE_REPORTS
UNION ALL
SELECT 'ISSUE_SUPPORTERS', COUNT(*) FROM ISSUE_SUPPORTERS
UNION ALL
SELECT 'REPORT_AUTHORS', COUNT(*) FROM REPORT_AUTHORS
UNION ALL
SELECT 'STATUS_HISTORY', COUNT(*) FROM STATUS_HISTORY
UNION ALL
SELECT 'ADMIN_RESPONSES', COUNT(*) FROM ADMIN_RESPONSES;
SELECT DATABASE();

DELETE FROM ADMIN_RESPONSES
WHERE response_id > 0;DELETE FROM STATUS_HISTORY;
DELETE FROM STATUS_HISTORY
WHERE history_id > 0;
DELETE FROM ISSUE_SUPPORTERS
WHERE issue_id > 0;
DELETE FROM ISSUE_REPORTS
WHERE issue_id > 0;
DELETE FROM REPORT_AUTHORS
WHERE report_id > 0;
DELETE FROM ISSUES
WHERE issue_id > 0;
DELETE FROM REPORTS
WHERE report_id > 0;
DELETE FROM USERS
WHERE user_id > 0;
DELETE FROM CATEGORIES
WHERE category_id > 0;
SELECT
    'USERS' AS table_name, COUNT(*) AS row_count FROM USERS
UNION ALL
SELECT 'CATEGORIES', COUNT(*) FROM CATEGORIES
UNION ALL
SELECT 'REPORTS', COUNT(*) FROM REPORTS
UNION ALL
SELECT 'ISSUES', COUNT(*) FROM ISSUES
UNION ALL
SELECT 'ISSUE_REPORTS', COUNT(*) FROM ISSUE_REPORTS
UNION ALL
SELECT 'ISSUE_SUPPORTERS', COUNT(*) FROM ISSUE_SUPPORTERS
UNION ALL
SELECT 'REPORT_AUTHORS', COUNT(*) FROM REPORT_AUTHORS
UNION ALL
SELECT 'STATUS_HISTORY', COUNT(*) FROM STATUS_HISTORY
UNION ALL
SELECT 'ADMIN_RESPONSES', COUNT(*) FROM ADMIN_RESPONSES;

SELECT DATABASE();

INSERT INTO USERS (name, email, password_hash, role)
VALUES (
    'WhisperNet Admin',
    'admin@whispernet.com',
    '$2b$10$UmoiLsb86DTj7pXD/4ROR.kiOouvcleXB7M9IGVRFbhqXwmfuYMBi',
    'ADMIN'
);
SELECT
    user_id,
    name,
    email,
    role,
    created_at
FROM USERS
WHERE role = 'ADMIN';

INSERT INTO CATEGORIES (name, description) VALUES
('Academics', 'Courses, exams, faculty, curriculum and academic resources'),
('Infrastructure', 'Classrooms, labs, buildings and campus facilities'),
('Hostel', 'Hostel rooms, maintenance, water and accommodation'),
('Transport', 'Campus buses and transportation'),
('Canteen', 'Food quality, pricing and canteen facilities'),
('Other', 'Issues that do not fit the other categories');
SELECT
    category_id,
    name,
    description
FROM CATEGORIES
ORDER BY category_id;

SHOW TABLES;
SHOW TRIGGERS;

SELECT
    DATABASE() AS database_name,
    USER() AS connected_user,
    VERSION() AS mysql_version;
