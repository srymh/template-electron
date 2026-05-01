sqlite3 ./kakeibo.db "VACUUM;"
sqlite3 ./kakeibo.db ".read ./0001_init.sql"
sqlite3 ./kakeibo.db ".read ./0002_sample.sql"
