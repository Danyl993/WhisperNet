USE whispernet;

-- Apply this once to an existing database if its demo accounts were created
-- with the old literal placeholder strings instead of bcrypt password hashes.
UPDATE USERS
SET password_hash = '$2b$10$WUMW90JdcfoO77O0d5bycuXifA8zEw44di3dvLfgQQJ2JWGKE5n.G'
WHERE email IN ('user1@whispernet.test', 'user2@whispernet.test');

UPDATE USERS
SET password_hash = '$2b$10$UmoiLsb86DTj7pXD/4ROR.kiOouvcleXB7M9IGVRFbhqXwmfuYMBi'
WHERE email IN ('admin@whispernet.test', 'admin@whispernet.com');
