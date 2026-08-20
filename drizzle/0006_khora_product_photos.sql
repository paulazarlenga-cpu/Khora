PRAGMA foreign_keys = ON;

ALTER TABLE products ADD COLUMN photo_url TEXT;

PRAGMA optimize;
