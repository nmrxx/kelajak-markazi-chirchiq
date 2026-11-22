import json
import os
import re
import secrets
import threading
import time
from datetime import datetime, timedelta
from urllib.parse import urlsplit

from dotenv import load_dotenv
from flask import Flask, abort, jsonify, request, send_from_directory, session
from werkzeug.middleware.proxy_fix import ProxyFix
from werkzeug.security import check_password_hash, generate_password_hash

from database import get_db, init_db

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(BASE_DIR)


def load_secret_key():
    env_key = os.getenv("SECRET_KEY")
    if env_key and len(env_key) >= 32:
        return env_key
    # Env bo'lmasa lokal uchun barqaror kalit yaratamiz (gitga tushmaydi)
    key_path = os.path.join(PROJECT_DIR, "database", ".secret_key")
    os.makedirs(os.path.dirname(key_path), exist_ok=True)
    try:
        with open(key_path, "r", encoding="utf-8") as fh:
            saved = fh.read().strip()
        if len(saved) >= 32:
            return saved
    except FileNotFoundError:
        pass
    generated = secrets.token_hex(32)
    with open(key_path, "w", encoding="utf-8") as fh:
        fh.write(generated)
    try:
        os.chmod(key_path, 0o600)
    except OSError:
        pass
    return generated


app = Flask(__name__, static_folder="../frontend", static_url_path="")
app.secret_key = load_secret_key()
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=os.getenv("COOKIE_SECURE", "0") == "1",
    PERMANENT_SESSION_LIFETIME=timedelta(days=14),
    MAX_CONTENT_LENGTH=1 * 1024 * 1024,
)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

init_db()

USERNAME_RE = re.compile(r"^[a-z0-9_.]{3,32}$")
RESERVED_USERNAMES = {"admin", "administrator", "root", "superadmin", "moderator", "support", "system"}
LOGIN_WINDOW = 10 * 60
LOGIN_MAX_ATTEMPTS = 6
_login_attempts = {}
_login_lock = threading.Lock()


def _attempt_key():
    return f"{request.remote_addr or 'unknown'}|{(request.get_json(silent=True) or {}).get('username', '').strip().lower()}"


def login_blocked(key):
    now = time.time()
    with _login_lock:
        bucket = [stamp for stamp in _login_attempts.get(key, []) if now - stamp < LOGIN_WINDOW]
        if bucket:
            _login_attempts[key] = bucket
        else:
            _login_attempts.pop(key, None)
        return len(bucket) >= LOGIN_MAX_ATTEMPTS


def record_login_failure(key):
    with _login_lock:
        _login_attempts.setdefault(key, []).append(time.time())


def clear_login_failures(key):
    with _login_lock:
        _login_attempts.pop(key, None)


def is_safe_image_url(value):
    if not value:
        return True
    if len(value) > 500:
        return False
    parts = urlsplit(value)
    return parts.scheme in ("http", "https") and bool(parts.netloc)


@app.before_request
def guard_cross_site_writes():
    if request.method in ("POST", "PUT", "PATCH", "DELETE"):
        origin = request.headers.get("Origin")
        if origin:
            try:
                origin_host = urlsplit(origin).netloc
            except ValueError:
                abort(403)
            if origin_host != request.host:
                abort(403)


@app.after_request
def add_security_headers(response):
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
    if response.mimetype == "text/html":
        response.headers.setdefault(
            "Content-Security-Policy",
            "default-src 'self'; "
            "img-src 'self' data: https:; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; "
            "font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com; "
            "script-src 'self' 'unsafe-inline'; "
            "connect-src 'self'; "
            "frame-ancestors 'none'; "
            "base-uri 'self'; "
            "form-action 'self'",
        )
    return response


@app.errorhandler(413)
def request_too_large(_):
    return jsonify({"error": "So'rov hajmi juda katta"}), 413


@app.errorhandler(403)
def forbidden(_):
    return jsonify({"error": "Ruxsat yo'q"}), 403


@app.errorhandler(500)
def server_error(_):
    return jsonify({"error": "Server xatosi. Keyinroq urinib ko'ring"}), 500


# ---------- helpers ----------
def week_range():
    today = datetime.now()
    start = today - timedelta(days=today.weekday())
    start = start.strftime("%Y-%m-%d")
    end = (datetime.strptime(start, "%Y-%m-%d") + timedelta(days=6)).strftime("%Y-%m-%d")
    return start, end


def current_user():
    uid = session.get("user_id")
    if not uid:
        return None
    db = get_db()
    row = db.execute(
        """SELECT u.*, s.school_number, s.school_name
           FROM users u LEFT JOIN schools s ON s.id = u.school_id
           WHERE u.id = ? AND u.active = 1""",
        (uid,),
    ).fetchone()
    db.close()
    if not row:
        return None
    if int(row["session_version"] or 0) != int(session.get("sv", 0)):
        session.clear()
        return None
    return dict(row)


def auth_required():
    u = current_user()
    if not u:
        return jsonify({"error": "Tizimga kirish kerak"}), 401
    return u


def admin_required():
    u = auth_required()
    if isinstance(u, tuple):
        return u
    if u["role"] != "super_admin":
        return jsonify({"error": "Bu amal faqat Bosh Koordinator uchun"}), 403
    return u


def tag_for(user):
    if user.get("role") == "super_admin":
        return "Bosh Koordinator"
    number = user.get("school_number")
    return f"{number}-Maktab Koordinator" if number else "Koordinator"


def public_user_row(row):
    d = dict(row)
    d["tag"] = tag_for(d)
    d["full_name"] = d.get("full_name") or d["username"]
    return d


def leaderboard_rows():
    start, end = week_range()
    db = get_db()
    rows = db.execute(
        """SELECT u.id, u.username, u.full_name, u.role, u.school_id, u.avatar_url,
                  u.bio, u.achievements, u.interests, u.created_at,
                  s.school_number, s.school_name,
                  COALESCE(SUM(us.points), 0) AS total_points,
                  COUNT(us.id) AS transactions,
                  COALESCE(SUM(CASE WHEN date(us.created_at) BETWEEN ? AND ? THEN us.points ELSE 0 END), 0) AS week_points,
                  (SELECT COUNT(*) FROM warns w WHERE w.user_id = u.id) AS warns_count
           FROM users u
           LEFT JOIN schools s ON s.id = u.school_id
           LEFT JOIN user_scores us ON us.user_id = u.id
           WHERE u.active = 1
           GROUP BY u.id
           ORDER BY total_points DESC, week_points DESC, u.created_at ASC""",
        (start, end),
    ).fetchall()
    db.close()

    result = []
    for place, row in enumerate(rows, 1):
        item = public_user_row(row)
        item["rank"] = place
        result.append(item)
    return result


def parse_json_field(value, fallback):
    if value is None:
        return fallback
    if isinstance(value, (list, dict)):
        return value
    try:
        parsed = json.loads(value)
        return parsed if parsed is not None else fallback
    except Exception:
        return fallback


# ---------- static ----------
@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.route("/<path:path>")
def static_files(path):
    return send_from_directory(app.static_folder, path)


# ---------- auth ----------
@app.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip().lower()
    password = data.get("password", "")
    full_name = (data.get("full_name") or "").strip()
    school_id = data.get("school_id")

    if not username or not password:
        return jsonify({"error": "Login va parol kerak"}), 400
    if not USERNAME_RE.match(username):
        return jsonify({"error": "Login 3-32 belgi: faqat lotin harflari, raqam, _ va ."}), 400
    if username in RESERVED_USERNAMES or username == (os.getenv("ADMIN_USERNAME") or "nmrxx").strip().lower():
        return jsonify({"error": "Bu login band"}), 409
    if len(password) < 6:
        return jsonify({"error": "Parol kamida 6 belgi bo'lishi kerak"}), 400
    if len(password) > 128:
        return jsonify({"error": "Parol juda uzun"}), 400
    if not school_id:
        return jsonify({"error": "Maktabni tanlang"}), 400
    if len(full_name) < 2 or len(full_name) > 80:
        return jsonify({"error": "Ism va familiyani to'g'ri kiriting"}), 400
    try:
        school_id = int(school_id)
    except (TypeError, ValueError):
        return jsonify({"error": "Maktab noto'g'ri tanlangan"}), 400

    db = get_db()
    if db.execute("SELECT id FROM users WHERE LOWER(username) = ?", (username,)).fetchone():
        db.close()
        return jsonify({"error": "Bu login allaqachon mavjud"}), 409

    school = db.execute("SELECT * FROM schools WHERE id = ?", (school_id,)).fetchone()
    if not school:
        db.close()
        return jsonify({"error": "Maktab topilmadi"}), 404

    try:
        cur = db.execute(
            """INSERT INTO users (username, password_hash, full_name, role, school_id, active)
               VALUES (?, ?, ?, 'user', ?, 1)""",
            (username, generate_password_hash(password), full_name, school["id"]),
        )
        user_id = cur.lastrowid
        db.commit()
        db.close()

        session.clear()
        session["user_id"] = user_id
        session["username"] = username
        session["role"] = "user"
        session["sv"] = 0
        return jsonify({
            "message": "Ro'yxatdan o'tdingiz",
            "user": {
                "id": user_id,
                "username": username,
                "full_name": full_name,
                "role": "user",
                "school_number": school["school_number"],
                "tag": f"{school['school_number']}-Maktab Koordinator",
            },
        }), 201
    except Exception:
        db.rollback()
        db.close()
        return jsonify({"error": "Ro'yxatdan o'tishda xatolik. Keyinroq urinib ko'ring"}), 500


@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip().lower()
    password = data.get("password", "")
    if not username or not password:
        return jsonify({"error": "Login va parol kiriting"}), 400

    attempt_key = _attempt_key()
    if login_blocked(attempt_key):
        return jsonify({"error": "Juda ko'p urinish. 10 daqiqadan keyin qayta urinib ko'ring"}), 429

    db = get_db()
    row = db.execute(
        """SELECT u.*, s.school_number FROM users u
           LEFT JOIN schools s ON s.id = u.school_id
           WHERE LOWER(u.username) = ? AND u.active = 1""",
        (username,),
    ).fetchone()
    db.close()

    if not row or not check_password_hash(row["password_hash"], password):
        record_login_failure(attempt_key)
        return jsonify({"error": "Login yoki parol noto'g'ri"}), 401

    user = dict(row)
    clear_login_failures(attempt_key)
    session.clear()
    session.permanent = True
    session["user_id"] = user["id"]
    session["username"] = user["username"]
    session["role"] = user["role"]
    session["sv"] = int(user["session_version"] or 0)

    return jsonify({
        "message": "Xush kelibsiz",
        "user": {
            "id": user["id"],
            "username": user["username"],
            "full_name": user["full_name"] or user["username"],
            "role": user["role"],
            "school_id": user.get("school_id"),
            "school_number": user.get("school_number"),
            "tag": tag_for(user),
        },
    }), 200


@app.route("/api/auth/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "Chiqildi"}), 200


@app.route("/api/auth/me", methods=["GET"])
def me():
    u = current_user()
    if not u:
        return jsonify({"authenticated": False}), 401
    return jsonify({
        "authenticated": True,
        "user": {
            "id": u["id"],
            "username": u["username"],
            "full_name": u["full_name"] or u["username"],
            "role": u["role"],
            "school_id": u.get("school_id"),
            "school_number": u.get("school_number"),
            "school_name": u.get("school_name"),
            "avatar_url": u.get("avatar_url") or "",
            "tag": tag_for(u),
        },
    }), 200


@app.route("/api/auth/change-password", methods=["POST"])
def change_password():
    u = auth_required()
    if isinstance(u, tuple):
        return u
    data = request.get_json() or {}
    old_password = data.get("old_password", "")
    new_password = data.get("new_password", "")
    if not old_password or not new_password:
        return jsonify({"error": "Eski va yangi parolni kiriting"}), 400
    if len(new_password) < 6:
        return jsonify({"error": "Yangi parol kamida 6 belgi bo'lishi kerak"}), 400
    if len(new_password) > 128:
        return jsonify({"error": "Parol juda uzun"}), 400
    if not check_password_hash(u["password_hash"], old_password):
        return jsonify({"error": "Eski parol noto'g'ri"}), 401

    new_version = int(u["session_version"] or 0) + 1
    db = get_db()
    db.execute(
        "UPDATE users SET password_hash = ?, session_version = ? WHERE id = ?",
        (generate_password_hash(new_password), new_version, u["id"]),
    )
    db.commit()
    db.close()
    session["sv"] = new_version
    return jsonify({"message": "Parol o'zgartirildi. Boshqa qurilmalar tizimdan chiqarildi"}), 200


# ---------- schools / users ----------
@app.route("/api/schools", methods=["GET"])
def schools():
    db = get_db()
    rows = db.execute(
        "SELECT id, school_number, school_name FROM schools ORDER BY school_number ASC"
    ).fetchall()
    db.close()
    return jsonify([dict(r) for r in rows]), 200


@app.route("/api/users/public", methods=["GET"])
def public_users():
    db = get_db()
    rows = db.execute(
        """SELECT u.id, u.username, u.full_name, u.role, s.school_number, u.created_at
           FROM users u LEFT JOIN schools s ON s.id = u.school_id
           WHERE u.active = 1 ORDER BY u.created_at ASC LIMIT 100"""
    ).fetchall()
    db.close()
    return jsonify([public_user_row(r) for r in rows]), 200


@app.route("/api/users", methods=["GET"])
def list_users():
    admin = admin_required()
    if isinstance(admin, tuple):
        return admin
    db = get_db()
    rows = db.execute(
        """SELECT u.id, u.username, u.full_name, u.role, u.school_id, u.active,
                  u.created_at, u.avatar_url, s.school_number
           FROM users u LEFT JOIN schools s ON s.id = u.school_id
           ORDER BY u.created_at ASC"""
    ).fetchall()
    db.close()
    return jsonify([public_user_row(r) for r in rows]), 200


@app.route("/api/users/<int:user_id>", methods=["DELETE"])
def delete_user(user_id):
    admin = admin_required()
    if isinstance(admin, tuple):
        return admin

    if user_id == admin["id"]:
        return jsonify({"error": "O'z akkauntingizni o'chira olmaysiz"}), 400

    db = get_db()
    row = db.execute("SELECT id, role FROM users WHERE id = ?", (user_id,)).fetchone()
    if not row:
        db.close()
        return jsonify({"error": "Foydalanuvchi topilmadi"}), 404
    if row["role"] == "super_admin":
        db.close()
        return jsonify({"error": "Bosh Koordinatorni o'chirib bo'lmaydi"}), 403

    # Avval bog'langan yozuvlar, keyin foydalanuvchi (FK uchun)
    db.execute("DELETE FROM user_scores WHERE user_id = ? OR issued_by = ?", (user_id, user_id))
    db.execute("DELETE FROM warns WHERE user_id = ? OR issued_by = ?", (user_id, user_id))
    db.execute("DELETE FROM users WHERE id = ?", (user_id,))
    db.commit()
    db.close()
    return jsonify({"message": "Foydalanuvchi o'chirildi"}), 200


# ---------- dashboard / leaderboard ----------
@app.route("/api/leaderboard", methods=["GET"])
def leaderboard():
    u = auth_required()
    if isinstance(u, tuple):
        return u
    start, end = week_range()
    return jsonify({
        "week_start": start,
        "week_end": end,
        "users": leaderboard_rows(),
    }), 200


@app.route("/api/dashboard/stats", methods=["GET"])
def dashboard_stats():
    u = auth_required()
    if isinstance(u, tuple):
        return u

    start, end = week_range()
    db = get_db()
    total_users = db.execute("SELECT COUNT(*) FROM users WHERE active = 1").fetchone()[0]
    total_schools = db.execute("SELECT COUNT(*) FROM schools").fetchone()[0]
    total_points = db.execute("SELECT COALESCE(SUM(points), 0) FROM user_scores").fetchone()[0]
    week_points = db.execute(
        "SELECT COALESCE(SUM(points), 0) FROM user_scores WHERE date(created_at) BETWEEN ? AND ?",
        (start, end),
    ).fetchone()[0]
    total_warns = db.execute("SELECT COUNT(*) FROM warns").fetchone()[0]
    db.close()

    board = leaderboard_rows()
    return jsonify({
        "total_users": total_users,
        "total_schools": total_schools,
        "total_points": total_points,
        "points_this_week": week_points,
        "total_warns": total_warns,
        "week_start": start,
        "week_end": end,
        "top_user": board[0] if board else None,
    }), 200


@app.route("/api/profile", methods=["GET"])
def get_profile():
    u = auth_required()
    if isinstance(u, tuple):
        return u

    board = leaderboard_rows()
    me = next((item for item in board if item["id"] == u["id"]), None)

    db = get_db()
    warns = db.execute(
        """SELECT w.id, w.reason, w.created_at,
                  COALESCE(i.full_name, i.username, 'Admin') AS issuer_name
           FROM warns w LEFT JOIN users i ON i.id = w.issued_by
           WHERE w.user_id = ? ORDER BY w.created_at DESC""",
        (u["id"],),
    ).fetchall()
    db.close()

    if me:
        me["achievements"] = parse_json_field(me.get("achievements"), [])
        me["interests"] = parse_json_field(me.get("interests"), [])
        me["warns"] = [dict(w) for w in warns]
    return jsonify(me or {}), 200


@app.route("/api/profile", methods=["PUT"])
def update_profile():
    u = auth_required()
    if isinstance(u, tuple):
        return u

    data = request.get_json(silent=True) or {}
    full_name = (data.get("full_name") or u["full_name"] or u["username"]).strip()[:80]
    bio = (data.get("bio") or "").strip()[:1000]
    avatar_url = (data.get("avatar_url") or "").strip()[:500]
    achievements = data.get("achievements", [])
    interests = data.get("interests", [])

    if not full_name:
        return jsonify({"error": "Ism va familiyani kiriting"}), 400
    if not is_safe_image_url(avatar_url):
        return jsonify({"error": "Avatar manzili http:// yoki https:// bilan boshlanishi kerak"}), 400
    if not isinstance(achievements, list):
        achievements = []
    if not isinstance(interests, list):
        interests = []

    def clean_list(items):
        cleaned = []
        for item in items[:20]:
            text = str(item).strip()[:60]
            if text:
                cleaned.append(text)
        return cleaned

    achievements = clean_list(achievements)
    interests = clean_list(interests)

    db = get_db()
    db.execute(
        """UPDATE users SET full_name = ?, bio = ?, avatar_url = ?,
                             achievements = ?, interests = ? WHERE id = ?""",
        (
            full_name,
            bio,
            avatar_url,
            json.dumps(achievements, ensure_ascii=False),
            json.dumps(interests, ensure_ascii=False),
            u["id"],
        ),
    )
    db.commit()
    db.close()
    return jsonify({"message": "Profil saqlandi"}), 200


# ---------- scores ----------
@app.route("/api/score", methods=["POST"])
def add_score():
    admin = admin_required()
    if isinstance(admin, tuple):
        return admin

    data = request.get_json() or {}
    user_id = data.get("user_id")
    points = data.get("points")
    reason = (data.get("reason") or "").strip()

    if not user_id or points is None or not reason:
        return jsonify({"error": "Foydalanuvchi, ball va sabab kerak"}), 400
    try:
        points = int(points)
        user_id = int(user_id)
    except (TypeError, ValueError):
        return jsonify({"error": "Ball raqam bo'lishi kerak"}), 400
    if points == 0 or abs(points) > 100:
        return jsonify({"error": "Ball -100 dan 100 gacha, 0 bo'lmasin"}), 400

    db = get_db()
    target = db.execute("SELECT id FROM users WHERE id = ? AND active = 1", (user_id,)).fetchone()
    if not target:
        db.close()
        return jsonify({"error": "Foydalanuvchi topilmadi"}), 404

    db.execute(
        "INSERT INTO user_scores (user_id, issued_by, points, reason) VALUES (?, ?, ?, ?)",
        (user_id, admin["id"], points, reason[:300]),
    )
    db.commit()
    db.close()
    return jsonify({"message": "Ball saqlandi"}), 201


@app.route("/api/score/<int:score_id>", methods=["DELETE"])
def delete_score(score_id):
    admin = admin_required()
    if isinstance(admin, tuple):
        return admin

    db = get_db()
    row = db.execute("SELECT id FROM user_scores WHERE id = ?", (score_id,)).fetchone()
    if not row:
        db.close()
        return jsonify({"error": "Ball yozuvi topilmadi"}), 404

    db.execute("DELETE FROM user_scores WHERE id = ?", (score_id,))
    db.commit()
    db.close()
    return jsonify({"message": "Ball yozuvi o'chirildi"}), 200


@app.route("/api/history", methods=["GET"])
def history():
    u = auth_required()
    if isinstance(u, tuple):
        return u

    db = get_db()
    rows = db.execute(
        """SELECT us.id, us.points, us.reason, us.created_at,
                  COALESCE(target.full_name, target.username) AS target_name,
                  target.username AS target_username,
                  COALESCE(issuer.full_name, issuer.username, 'Admin') AS issued_by_name,
                  issuer.username AS issued_by
           FROM user_scores us
           JOIN users target ON target.id = us.user_id
           LEFT JOIN users issuer ON issuer.id = us.issued_by
           ORDER BY us.created_at DESC, us.id DESC LIMIT 100"""
    ).fetchall()
    db.close()
    return jsonify([dict(r) for r in rows]), 200


# ---------- warns ----------
@app.route("/api/warns", methods=["GET"])
def list_warns():
    u = auth_required()
    if isinstance(u, tuple):
        return u

    db = get_db()
    if u["role"] == "super_admin":
        rows = db.execute(
            """SELECT w.id, w.reason, w.created_at,
                      COALESCE(target.full_name, target.username) AS target_name,
                      target.username AS target_username,
                      COALESCE(issuer.full_name, issuer.username, 'Admin') AS issuer_name
               FROM warns w
               JOIN users target ON target.id = w.user_id
               LEFT JOIN users issuer ON issuer.id = w.issued_by
               ORDER BY w.created_at DESC"""
        ).fetchall()
    else:
        rows = db.execute(
            """SELECT w.id, w.reason, w.created_at,
                      COALESCE(issuer.full_name, issuer.username, 'Admin') AS issuer_name
               FROM warns w LEFT JOIN users issuer ON issuer.id = w.issued_by
               WHERE w.user_id = ? ORDER BY w.created_at DESC""",
            (u["id"],),
        ).fetchall()
    db.close()
    return jsonify([dict(r) for r in rows]), 200


@app.route("/api/warns", methods=["POST"])
def add_warn():
    admin = admin_required()
    if isinstance(admin, tuple):
        return admin

    data = request.get_json(silent=True) or {}
    target_id = data.get("user_id")
    reason = (data.get("reason") or "").strip()
    if not target_id or not reason:
        return jsonify({"error": "Foydalanuvchi va sabab kerak"}), 400
    try:
        target_id = int(target_id)
    except (TypeError, ValueError):
        return jsonify({"error": "Foydalanuvchi noto'g'ri"}), 400

    db = get_db()
    target = db.execute("SELECT id FROM users WHERE id = ? AND active = 1", (target_id,)).fetchone()
    if not target:
        db.close()
        return jsonify({"error": "Foydalanuvchi topilmadi"}), 404

    db.execute(
        "INSERT INTO warns (user_id, issued_by, reason) VALUES (?, ?, ?)",
        (target_id, admin["id"], reason[:300]),
    )
    db.commit()
    db.close()
    return jsonify({"message": "Ogohlantirish yuborildi"}), 201


@app.route("/api/warns/<int:warn_id>", methods=["DELETE"])
def delete_warn(warn_id):
    admin = admin_required()
    if isinstance(admin, tuple):
        return admin

    db = get_db()
    row = db.execute("SELECT id FROM warns WHERE id = ?", (warn_id,)).fetchone()
    if not row:
        db.close()
        return jsonify({"error": "Ogohlantirish topilmadi"}), 404

    db.execute("DELETE FROM warns WHERE id = ?", (warn_id,))
    db.commit()
    db.close()
    return jsonify({"message": "Ogohlantirish o'chirildi"}), 200


# ---------- health ----------
@app.route("/api/health", methods=["GET"])
def health():
    try:
        db = get_db()
        db.execute("SELECT 1").fetchone()
        db.close()
        return jsonify({"status": "online", "database": "connected"}), 200
    except Exception:
        return jsonify({"status": "error", "message": "Database unavailable"}), 500


if __name__ == "__main__":
    app.run(debug=False, use_reloader=False, host="0.0.0.0", port=int(os.getenv("PORT", "5000")))  # nosec B104
