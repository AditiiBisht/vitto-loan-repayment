// Integration tests must never touch the real DB: use TEST_DATABASE_URL only.
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
