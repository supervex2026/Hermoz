# database/

Reserved for the Phase 4 (long-term memory) SQLite database. Not used yet -
see [`../docs/ROADMAP.md`](../docs/ROADMAP.md). When implemented, the
actual `.sqlite` file will live in the OS app-data directory alongside
`settings.json`, not in this folder; this directory is for any bundled
schema/migration files the app ships with.
