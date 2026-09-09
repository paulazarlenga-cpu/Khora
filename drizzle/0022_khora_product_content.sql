PRAGMA foreign_keys = ON;

ALTER TABLE products ADD COLUMN store_description TEXT;

PRAGMA optimize;
