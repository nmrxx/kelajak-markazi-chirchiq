import os
import sqlite3

from dotenv import load_dotenv
from werkzeug.security import generate_password_hash

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(BASE_DIR)

_default_db = os.path.join(PROJECT_DIR, "database", "chirchiq_rating.db")
_env_db = os.getenv("DATABASE_PATH")
if _env_db and not os.path.isabs(_env_db):
    DB_PATH = os.path.join(PROJECT_DIR, _env_db)
else:
    DB_PATH = os.path.abspath(_env_db or _default_db)
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)


def get_db():
    db = sqlite3.connect(DB_PATH, timeout=10)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    db.execute("PRAGMA busy_timeout = 5000")
    return db


def init_db():
    db = get_db()
    c = db.cursor()
    c.execute("PRAGMA journal_mode = WAL")

    c.execute("""
        CREATE TABLE IF NOT EXISTS schools (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            school_number INT UNIQUE NOT NULL,
            school_name TEXT NOT NULL
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            full_name TEXT DEFAULT '',
            role TEXT DEFAULT 'user',
            school_id INT,
            avatar_url TEXT DEFAULT '',
            bio TEXT DEFAULT '',
            achievements TEXT DEFAULT '[]',
            interests TEXT DEFAULT '[]',
            session_version INT DEFAULT 0,
            active BOOLEAN DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (school_id) REFERENCES schools(id)
        )
    """)

    # Eski bazalar uchun migratsiyalar
    existing = {r[1] for r in c.execute("PRAGMA table_info(users)").fetchall()}
    for column, ddl in (
        ("full_name", "ALTER TABLE users ADD COLUMN full_name TEXT DEFAULT ''"),
        ("bio", "ALTER TABLE users ADD COLUMN bio TEXT DEFAULT ''"),
        ("achievements", "ALTER TABLE users ADD COLUMN achievements TEXT DEFAULT '[]'"),
        ("interests", "ALTER TABLE users ADD COLUMN interests TEXT DEFAULT '[]'"),
        ("avatar_url", "ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT ''"),
        ("session_version", "ALTER TABLE users ADD COLUMN session_version INT DEFAULT 0"),
    ):
        if column not in existing:
            c.execute(ddl)

    c.execute("""
        CREATE TABLE IF NOT EXISTS user_scores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INT NOT NULL,
            issued_by INT NOT NULL,
            points INT NOT NULL,
            reason TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (issued_by) REFERENCES users(id)
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS warns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INT NOT NULL,
            issued_by INT NOT NULL,
            reason TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (issued_by) REFERENCES users(id)
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            setting_key TEXT UNIQUE NOT NULL,
            setting_value TEXT NOT NULL
        )
    """)

    # Chirchiq shahri 26 ta maktab
    c.executemany(
        """INSERT INTO schools (school_number, school_name) VALUES (?, ?)
           ON CONFLICT(school_number) DO UPDATE SET school_name = excluded.school_name""",
        [(i, f"{i}-Maktab") for i in range(1, 27)],
    )

    # Yagona super admin faqat baza bo'sh bo'lganda yaratiladi.
    # Mavjud adminning paroli yoki roli har ishga tushishda o'zgartirilmaydi.
    admin_username = (os.getenv("ADMIN_USERNAME") or "nmrxx").strip().lower()
    exists = c.execute("SELECT id FROM users WHERE role = 'super_admin' LIMIT 1").fetchone()
    if not exists:
        admin_password = os.getenv("ADMIN_PASSWORD")
        if not admin_password:
            raise RuntimeError(
                "ADMIN_PASSWORD topilmadi. Hostingda ADMIN_PASSWORD env o'zgaruvchisini o'rnating."
            )
        c.execute(
            """INSERT INTO users (username, password_hash, full_name, role, active)
               VALUES (?, ?, ?, 'super_admin', 1)""",
            (admin_username, generate_password_hash(admin_password), os.getenv("ADMIN_FULL_NAME", "Kosimov Otabek")),
        )

    c.execute("INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES ('app_name', 'Kelajak Markazi Chirchiq')")

    db.commit()
    c.close()
    db.close()
    print("Database ready:", DB_PATH)


if __name__ == "__main__":
    init_db()
