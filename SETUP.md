# Kelajak Markazi Chirchiq

Chirchiq shahridagi 26 ta maktab koordinatorlari uchun yagona reyting platformasi: umumiy peshtaxta, shaxsiy portfolio, haftalik/umumiy ballar, ogohlantirishlar, rasmli hisobotlar lentasi va faqat Bosh Koordinator uchun admin panel.

## Imkoniyatlar

- Bitta super admin (Bosh Koordinator), qolgan barcha foydalanuvchilar — oddiy koordinatorlar.
- 26 ta maktab: ro'yxatdan o'tishda maktab tanlanadi va `10-Maktab Koordinator` kabi teg beriladi.
- Umumiy dashbord: ism, maktab/teg, haftalik va umumiy ball, o'rin, ogohlantirishlar, qo'shilgan sana.
- Profil/portfolio: avatar, bio, yutuqlar, qiziqishlar, shaxsiy o'rin va ballar.
- **Hisobotlar**: ishtirokchi rasm va matn yuboradi → Bosh Koordinator tekshiradi → tasdiqlansa ball beriladi va post ommaviy lentada chiqadi. Postlarni yoqtirish (layk) mumkin.
- Admin panel: hisobotlarni tasdiqlash/rad etish, ball berish (sabab bilan), xato ball yozuvlarini, ogohlantirishlarni va foydalanuvchilarni o'chirish, tarixni ko'rish.
- Parolni o'zgartirish — boshqa qurilmalardagi sessiyalar avtomatik yopiladi.
- Mobil qurilmalar uchun moslashgan interfeys.
- **Tema almashish**: asosiy ko'k/qorong'u tema va oq tema; tanlov brauzerda saqlanadi, logotip ham temaga moslashadi.

## Texnologiyalar

- Backend: Python 3.10+, Flask 3, SQLite, Gunicorn, Pillow (rasmni qayta ishlash)
- Frontend: HTML, CSS, vanilla JavaScript (build talab qilinmaydi)

## Loyiha tuzilishi

```
backend/
  app.py          # Flask API va marshrutlar
  database.py     # SQLite sxemasi va boshlang'ich ma'lumotlar
frontend/
  index.html
  style.css
  script.js
  assets/         # logo va favicon
database/         # SQLite fayli (gitga tushmaydi)
uploads/reports/  # yuklangan rasmlar (gitga tushmaydi, avtomatik yaratiladi)
wsgi.py           # Gunicorn uchun kirish nuqtasi
requirements.txt
.env.example
```

## Lokal ishga tushirish

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# .env ichida SECRET_KEY va ADMIN_PASSWORD ni o'zgartiring

python backend/app.py
```

Sayt: http://localhost:5000

Birinchi ishga tushishda baza yaratiladi va `.env` dagi `ADMIN_USERNAME` / `ADMIN_PASSWORD` bilan admin qo'shiladi. Keyingi ishga tushishlarda mavjud adminning paroli va roli **o'zgartirilmaydi**.

## Muhit o'zgaruvchilari

| O'zgaruvchi | Tavsif |
|---|---|
| `SECRET_KEY` | Sessiyalarni imzolash kaliti. Kamida 32 belgi. Hostingda albatta o'rnatiladi. |
| `ADMIN_USERNAME` | Admin logini (standart: `nmrxx`). |
| `ADMIN_PASSWORD` | Admin paroli. Faqat baza birinchi marta yaratilganda ishlatiladi. |
| `ADMIN_FULL_NAME` | Adminning to'liq ismi. |
| `DATABASE_PATH` | SQLite fayli manzili. Standart: `database/chirchiq_rating.db`. |
| `COOKIE_SECURE` | HTTPS sayt uchun `1` qiling. |
| `PORT` | Server porti (hosting odatda o'zi beradi). |

## GitHubga yuklash

Repo allaqachon git bilan tayyorlangan. Faqat maxfiy fayllar chiqmasligiga ishonch hosil qiling:

```bash
git status
```

`git status` da `.env`, `*.db`, `*.sql`, `.venv` ko'rinmasligi kerak — ular `.gitignore` da.

```bash
git add .
git commit -m "Kelajak Markazi Chirchiq: productionga tayyor"
git branch -M main
git remote add origin https://github.com/USERNAME/kelajak-markazi-chirchiq.git
git push -u origin main
```

> **Muhim:** GitHub Pages faqat statik saytlarni ko'rsatadi. Bu loyihada Flask backend va SQLite bor, shuning uchun Pages emas, Python hosting kerak (quyida).

## Hosting

### 1) PythonAnywhere (bepul, SQLite saqlanadi) — tavsiya etiladi

1. [pythonanywhere.com](https://www.pythonanywhere.com) da bepul akkaunt oching.
2. **Consoles → Bash** orqali repo klon qiling:
   ```bash
   git clone https://github.com/USERNAME/kelajak-markazi-chirchiq.git
   cd kelajak-markazi-chirchiq
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```
3. **Web → Add a new web app → Manual configuration → Python 3.12**.
4. **Source code** va **Working directory** ni loyiha papkasiga qo'ying.
5. WSGI konfiguratsiya faylini tahrirlang:
   ```python
   import os
   import sys

   path = "/home/USERNAME/kelajak-markazi-chirchiq"
   if path not in sys.path:
       sys.path.insert(0, path)

   os.environ["SECRET_KEY"] = "uzun-tasodifiy-kalit"
   os.environ["ADMIN_USERNAME"] = "nmrxx"
   os.environ["ADMIN_PASSWORD"] = "kuchli-parol"
   os.environ["ADMIN_FULL_NAME"] = "Kosimov Otabek"
   os.environ["DATABASE_PATH"] = path + "/database/chirchiq_rating.db"
   os.environ["COOKIE_SECURE"] = "1"

   from wsgi import app as application
   ```
6. **Reload** tugmasini bosing. Sayt `https://USERNAME.pythonanywhere.com` da ochiladi.

### Yangilanishni o'rnatish (PythonAnywhere)

```bash
cd ~/kelajak-markazi-chirchiq
git pull
source ~/.virtualenvs/kelajak/bin/activate
pip install -r requirements.txt
```

Keyin **Web → Reload**. `init_db()` ishga tushganda yangi jadvallar (`reports`, `report_likes`) va `user_scores.report_id` ustuni avtomatik qo'shiladi. `uploads/` papkasi ham avtomatik yaratiladi — u gitda saqlanmaydi, shuning uchun yangilashda o'chirib yubormang.

### 2) Render (bepul, lekin SQLite vaqtinchalik)

1. GitHub repo ni Render ga ulang.
2. `render.yaml` avtomatik aniqlanadi yoki qo'lda:
   - Build: `pip install -r requirements.txt`
   - Start: `gunicorn wsgi:app --bind 0.0.0.0:$PORT --workers 2 --threads 4`
3. Environment bo'limida `ADMIN_PASSWORD` va `SECRET_KEY` ni kiriting.
4. Environment bo'limida `COOKIE_SECURE=1` qiling.

> **Diqqat:** Render bepul tarifida doimiy disk yo'q. Har deploy/restart da SQLite fayli o'chib ketadi. Doimiy ma'lumot kerak bo'lsa PythonAnywhere yoki pullik disk (`DATABASE_PATH=/var/data/chirchiq_rating.db`) ishlating.

### 3) Docker

```bash
docker build -t kelajak-markazi .
docker run -p 8000:8000 --env-file .env \
  -v "$PWD/database:/app/database" \
  -v "$PWD/uploads:/app/uploads" kelajak-markazi
```

Sayt: http://localhost:8000

## Xavfsizlik

- Parollar `scrypt` bilan hashlanadi (Werkzeug).
- Login uchun urinishlar cheklangan: 10 daqiqada 6 marta xato → `429`.
- Login xatosi login mavjudligini oshkor qilmaydi.
- Sessiya cookie: `HttpOnly`, `SameSite=Lax`, HTTPS da `Secure`.
- Parol o'zgarganda barcha eski sessiyalar bekor qilinadi (`session_version`).
- Barcha o'zgartiruvchi so'rovlar `Origin` tekshiruvi orqali himoyalangan (CSRF).
- CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy` sarlavhalari qo'shilgan.
- Yuklangan rasmlar Pillow bilan qayta ishlanadi: faqat JPG/PNG/WEBP, 8 MB gacha, EXIF tozalanadi, o'lchami cheklanadi. Rasm yo'llari tasodifiy nom bilan saqlanadi.
- SQL so'rovlari parametrlangan; foydalanuvchi kiritmalari uzunligi va formati tekshiriladi.
- Ro'yxatdan o'tishda faqat `user` roli beriladi; admin loginlari (`admin`, `root`, `nmrxx` va h.k.) band qilinmaydi.
- `.env`, baza fayllari va SQL dump lar `.gitignore` orqali yopilgan.

## Foydali buyruqlar

```bash
# Admin parolini almashtirish (sayt orqali Profil → Parolni o'zgartirish)
# Baza va rasmlar zaxira nusxasi (uy papkasiga)
cp database/chirchiq_rating.db ~/chirchiq-backup-$(date +%F).db
tar -czf ~/chirchiq-uploads-$(date +%F).tar.gz uploads/

# Sinxron ishga tushirish
python backend/app.py
```
