/* =========================================
   Kelajak Markazi Chirchiq — frontend
   ========================================= */

const API = "/api";

const app = {
    currentUser: null,
    currentSection: "dashboard",
    schools: [],
    clockTimer: null,
    reportTab: "feed",
    adminReportStatus: "pending",
    reportsFeed: [],
    reportsTotal: 0,
    myReports: [],

    /* ============== INIT ============== */
    init() {
        this.bindUI();
        this.bindForms();
        this.startClock();
        this.checkAuth();
    },

    $(id) {
        return document.getElementById(id);
    },

    async api(path, options = {}) {
        const opts = { credentials: "include", ...options };
        if (opts.body && typeof opts.body !== "string" && !(opts.body instanceof FormData)) {
            opts.headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
            opts.body = JSON.stringify(opts.body);
        }
        const res = await fetch(API + path, opts);
        let data = null;
        try {
            data = await res.json();
        } catch (_) {}
        return { res, data };
    },

    /* ============== HELPERS ============== */
    esc(value) {
        return String(value ?? "").replace(/[&<>"']/g, (c) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
        }[c]));
    },

    getInitials(name) {
        const clean = String(name || "U").trim();
        const parts = clean.split(/\s+/).filter(Boolean);
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        return clean.slice(0, 2).toUpperCase() || "U";
    },

    colorFor(value) {
        const palettes = [
            ["#9fef00", "#4f8a00"],
            ["#8b5cf6", "#4c1d95"],
            ["#38bdf8", "#075985"],
            ["#f472b6", "#9d174d"],
            ["#fbbf24", "#92400e"],
            ["#34d399", "#065f46"],
        ];
        let hash = 0;
        const text = String(value || "x");
        for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
        return palettes[hash % palettes.length];
    },

    safeImageUrl(value) {
        const raw = String(value || "").trim();
        if (!/^https?:\/\/\S+$/i.test(raw)) return "";
        return raw.replace(/[\\'"()\s]/g, (ch) => encodeURIComponent(ch));
    },

    avatarMarkup(user, size = "avatar-sm") {
        const name = user?.full_name || user?.username || "U";
        const url = this.safeImageUrl(user?.avatar_url);
        if (url) {
            return `<span class="avatar ${size}" style="background-image:url('${url}')"></span>`;
        }
        const [a, b] = this.colorFor(user?.username || name);
        return `<span class="avatar ${size}" style="background:linear-gradient(135deg,${a},${b})">${this.esc(this.getInitials(name))}</span>`;
    },

    setAvatar(el, user) {
        if (!el) return;
        const name = user?.full_name || user?.username || "U";
        const url = this.safeImageUrl(user?.avatar_url);
        const [a, b] = this.colorFor(user?.username || name);
        el.style.background = `linear-gradient(135deg,${a},${b})`;
        el.style.backgroundSize = "cover";
        el.style.backgroundPosition = "center";
        if (url) {
            el.style.backgroundImage = `url('${url}')`;
            el.textContent = "";
        } else {
            el.style.backgroundImage = "";
            el.textContent = this.getInitials(name);
        }
    },

    fmtPoints(value) {
        const n = Number(value) || 0;
        if (n > 0) return `+${n}`;
        return String(n);
    },

    pointsClass(value) {
        const n = Number(value) || 0;
        return n > 0 ? "pos" : n < 0 ? "neg" : "zero";
    },

    parseDate(value) {
        if (!value) return null;
        const date = new Date(String(value).replace(" ", "T"));
        return Number.isNaN(date.getTime()) ? null : date;
    },

    fmtDate(value) {
        const date = this.parseDate(value);
        if (!date) return "—";
        return date.toLocaleDateString("uz-UZ");
    },

    fmtDateTime(value) {
        const date = this.parseDate(value);
        if (!date) return "—";
        return `${date.toLocaleDateString("uz-UZ")} · ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    },

    startClock() {
        if (this.clockTimer) clearInterval(this.clockTimer);
        const months = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];
        const tick = () => {
            const el = this.$("live-date");
            if (!el) return;
            const d = new Date();
            el.textContent = `${d.getDate()}-${months[d.getMonth()]}, ${d.getFullYear()} · ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
        };
        tick();
        this.clockTimer = setInterval(tick, 30000);
    },

    setLoading(btn, loading, label) {
        if (!btn) return;
        const text = btn.querySelector(".btn-text");
        const loader = btn.querySelector(".btn-loader");
        if (loading) {
            btn.dataset.prevText = text ? text.textContent : "";
            if (text) text.textContent = label || "Yuklanmoqda...";
            loader?.classList.remove("hidden");
            btn.disabled = true;
        } else {
            if (text && btn.dataset.prevText) text.textContent = btn.dataset.prevText;
            loader?.classList.add("hidden");
            btn.disabled = false;
        }
    },

    showMsg(id, text, type = "error") {
        const el = this.$(id);
        if (!el) return;
        el.classList.remove("hidden");
        el.className = `msg ${type === "error" ? "msg-error" : "msg-success"}`;
        el.textContent = text;
        clearTimeout(el._timer);
        el._timer = setTimeout(() => el.classList.add("hidden"), 5000);
    },

    toast(text, type = "success") {
        const el = document.createElement("div");
        el.className = `toast toast-${type}`;
        el.textContent = text;
        document.body.appendChild(el);
        setTimeout(() => {
            el.classList.add("toast-out");
            setTimeout(() => el.remove(), 250);
        }, 2400);
    },

    /* ============== UI BIND ============== */
    bindUI() {
        this.$("nav-toggle")?.addEventListener("click", () => {
            this.$("topnav")?.classList.toggle("open");
        });
        this.$("user-menu-btn")?.addEventListener("click", (e) => {
            e.stopPropagation();
            this.$("user-menu")?.classList.toggle("hidden");
        });
        document.addEventListener("click", (e) => {
            if (!e.target.closest("#user-menu") && !e.target.closest("#user-menu-btn")) {
                this.closeUserMenu();
            }
        });
        document.querySelectorAll(".nav-link").forEach((link) => {
            link.addEventListener("click", () => {
                this.$("topnav")?.classList.remove("open");
                this.closeUserMenu();
            });
        });
        document.querySelectorAll("[data-admin-report-status]").forEach((btn) => {
            btn.addEventListener("click", () => this.loadAdminReports(btn.dataset.adminReportStatus));
        });
        window.addEventListener("scroll", () => this.closeUserMenu(), { passive: true });
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") this.closeModal();
        });
    },

    closeUserMenu() {
        this.$("user-menu")?.classList.add("hidden");
    },

    bindForms() {
        this.$("login-form")?.addEventListener("submit", (e) => {
            e.preventDefault();
            this.login(this.$("login-username").value, this.$("login-password").value);
        });

        this.$("register-form")?.addEventListener("submit", (e) => {
            e.preventDefault();
            const pw1 = this.$("reg-password").value;
            const pw2 = this.$("reg-password2").value;
            if (pw1 !== pw2) {
                this.showMsg("reg-msg", "Parollar bir xil emas", "error");
                return;
            }
            this.register({
                fullname: this.$("reg-fullname").value,
                username: this.$("reg-username").value,
                password: pw1,
                schoolId: this.$("reg-school").value,
            });
        });

        this.$("reg-school")?.addEventListener("change", () => this.updateTagPreview());

        document.querySelectorAll(".toggle-password").forEach((btn) => {
            btn.addEventListener("click", () => {
                const input = btn.closest(".form-group")?.querySelector("input");
                const icon = btn.querySelector("i");
                if (!input || !icon) return;
                if (input.type === "password") {
                    input.type = "text";
                    icon.classList.replace("fa-eye-slash", "fa-eye");
                } else {
                    input.type = "password";
                    icon.classList.replace("fa-eye", "fa-eye-slash");
                }
            });
        });

        const regPwd = this.$("reg-password");
        if (regPwd) {
            regPwd.addEventListener("input", () => {
                const val = regPwd.value;
                const fill = this.$("strength-fill");
                const text = this.$("strength-text");
                if (!fill || !text) return;
                let score = 0;
                if (val.length >= 4) score++;
                if (val.length >= 8) score++;
                if (/[A-Z]/.test(val)) score++;
                if (/[0-9]/.test(val)) score++;
                if (/[^A-Za-z0-9]/.test(val)) score++;

                fill.className = "strength-fill";
                if (!val) {
                    fill.style.width = "0%";
                    text.textContent = "Kam";
                } else if (score <= 1) {
                    fill.style.width = "33%";
                    fill.classList.add("weak");
                    text.textContent = "Kam";
                } else if (score <= 3) {
                    fill.style.width = "66%";
                    fill.classList.add("medium");
                    text.textContent = "O'rta";
                } else {
                    fill.style.width = "100%";
                    fill.classList.add("strong");
                    text.textContent = "Kuchli";
                }
            });
        }
    },

    /* ============== AUTH ============== */
    async checkAuth() {
        try {
            const { res, data } = await this.api("/auth/me");
            if (res.ok && data?.user) {
                this.currentUser = data.user;
                this.showApp();
                return;
            }
        } catch (_) {}

        this.showPage("login");
        this.loadSchools();
        this.loadPublicUsers();
    },

    showPage(page) {
        document.querySelectorAll(".auth-page").forEach((p) => {
            p.classList.remove("active");
            p.classList.add("hidden");
        });
        const target = this.$(`page-${page}`);
        if (target) {
            target.classList.remove("hidden");
            target.classList.add("active");
        }
        const auth = this.$("auth-pages");
        if (auth) auth.style.display = "flex";
        this.$("main-app")?.classList.add("hidden");
    },

    switchPage(page) {
        this.showPage(page);
        this.$("login-msg")?.classList.add("hidden");
        this.$("reg-msg")?.classList.add("hidden");
        if (page === "register") this.loadSchools();
    },

    async login(username, password) {
        username = (username || "").trim();
        if (!username || !password) {
            this.showMsg("login-msg", "Login va parolni kiriting", "error");
            return;
        }
        const btn = this.$("login-btn");
        this.setLoading(btn, true, "Kirish...");
        try {
            const { res, data } = await this.api("/auth/login", {
                method: "POST",
                body: { username, password },
            });
            if (res.ok && data?.user) {
                this.currentUser = data.user;
                this.$("login-msg")?.classList.add("hidden");
                this.showApp();
                this.loadPublicUsers();
            } else {
                this.showMsg("login-msg", data?.error || "Kirishda xatolik", "error");
            }
        } catch (_) {
            this.showMsg("login-msg", "Server bilan aloqa yo'q", "error");
        } finally {
            this.setLoading(btn, false);
        }
    },

    async register({ fullname, username, password, schoolId }) {
        fullname = (fullname || "").trim();
        username = (username || "").trim();
        if (fullname.length < 2) return this.showMsg("reg-msg", "Ism va familiyani kiriting", "error");
        if (username.length < 3) return this.showMsg("reg-msg", "Login kamida 3 belgi bo'lsin", "error");
        if ((password || "").length < 6) return this.showMsg("reg-msg", "Parol kamida 6 belgi bo'lsin", "error");
        if (!schoolId) return this.showMsg("reg-msg", "Maktabni tanlang", "error");

        const btn = this.$("reg-btn");
        this.setLoading(btn, true, "Yaratilmoqda...");
        try {
            const { res, data } = await this.api("/auth/register", {
                method: "POST",
                body: {
                    full_name: fullname,
                    username,
                    password,
                    school_id: parseInt(schoolId, 10),
                },
            });
            if (res.ok && data?.user) {
                this.currentUser = data.user;
                this.showMsg("reg-msg", "Akkaunt yaratildi!", "success");
                setTimeout(() => {
                    this.showApp();
                    this.loadPublicUsers();
                }, 450);
            } else {
                this.showMsg("reg-msg", data?.error || "Ro'yxatdan o'tishda xatolik", "error");
            }
        } catch (_) {
            this.showMsg("reg-msg", "Server bilan aloqa yo'q", "error");
        } finally {
            this.setLoading(btn, false);
        }
    },

    async logout() {
        try {
            await this.api("/auth/logout", { method: "POST" });
        } catch (_) {}
        this.currentUser = null;
        this.currentSection = "dashboard";
        this.reportTab = "feed";
        this.reportsFeed = [];
        this.reportsTotal = 0;
        this.myReports = [];
        this.$("login-form")?.reset();
        this.closeUserMenu();
        this.showPage("login");
        this.loadPublicUsers();
        this.loadSchools();
    },

    /* ============== DATA ============== */
    async loadSchools() {
        if (this.schools.length) {
            this.fillSchoolSelect();
            return;
        }
        try {
            const { res, data } = await this.api("/schools");
            if (res.ok && Array.isArray(data)) {
                this.schools = data;
                this.fillSchoolSelect();
            }
        } catch (_) {}
    },

    fillSchoolSelect() {
        const sel = this.$("reg-school");
        if (!sel) return;
        const current = sel.value;
        sel.innerHTML = '<option value="">Maktabni tanlang</option>';
        this.schools.forEach((s) => {
            const opt = document.createElement("option");
            opt.value = s.id;
            opt.textContent = `${s.school_number}-Maktab`;
            sel.appendChild(opt);
        });
        if (current) sel.value = current;
    },

    updateTagPreview() {
        const el = this.$("register-tag-preview");
        const sel = this.$("reg-school");
        if (!el || !sel) return;
        const school = this.schools.find((s) => String(s.id) === String(sel.value));
        el.textContent = school ? `${school.school_number}-Maktab Koordinator` : "Maktabni tanlang";
    },

    async loadPublicUsers() {
        const container = this.$("users-list");
        try {
            const { res, data } = await this.api("/users/public");
            if (!container) return;
            if (!res.ok || !Array.isArray(data)) {
                container.innerHTML = '<div class="users-empty">Yuklanmadi</div>';
                return;
            }
            if (data.length === 0) {
                container.innerHTML = '<div class="users-empty">Hozircha ishtirokchilar yo\'q</div>';
                return;
            }
            container.innerHTML = data.map((u) => `
                <div class="user-item">
                    ${this.avatarMarkup(u, "avatar-sm")}
                    <div style="min-width:0;">
                        <div class="user-name">${this.esc(u.full_name || u.username)}</div>
                        <div class="user-role">${this.esc(u.tag || "Koordinator")}</div>
                    </div>
                </div>
            `).join("");
        } catch (_) {
            if (container) container.innerHTML = '<div class="users-empty">Yuklanmadi</div>';
        }
    },

    /* ============== APP SHELL ============== */
    showApp() {
        const auth = this.$("auth-pages");
        if (auth) auth.style.display = "none";
        this.$("main-app")?.classList.remove("hidden");

        const user = this.currentUser || {};
        const name = user.full_name || user.username || "Foydalanuvchi";
        const tag = user.tag || (user.role === "super_admin" ? "Bosh Koordinator" : "Koordinator");
        const isAdmin = user.role === "super_admin";

        this.$("nav-admin")?.classList.toggle("hidden", !isAdmin);

        const setText = (id, value) => { const el = this.$(id); if (el) el.textContent = value; };
        setText("topbar-name", name);
        setText("topbar-tag", tag);
        setText("menu-name", name);
        setText("menu-tag", tag);
        setText("admin-badge-name", name);
        this.setAvatar(this.$("topbar-avatar"), user);
        this.setAvatar(this.$("profile-avatar"), user);

        this.loadSchools();
        this.showSection(this.currentSection || "dashboard");
    },

    sectionMeta(name) {
        const meta = {
            dashboard: ["Bosh sahifa", "Kelajak Markazi Chirchiq"],
            reports: ["Hisobotlar", "Postlar va hisobotlar lentasi"],
            profile: ["Profil", "Portfolio va shaxsiy natijalar"],
            history: ["Ball tarixi", "Berilgan ballar va sabablar"],
            admin: ["Admin panel", "Bosh Koordinator boshqaruvi"],
        };
        return meta[name] || ["Kelajak Markazi Chirchiq", ""];
    },

    showSection(name) {
        if (name === "admin" && this.currentUser?.role !== "super_admin") {
            this.toast("Bu bo'lim faqat Bosh Koordinator uchun", "error");
            return;
        }
        this.currentSection = name;
        document.querySelectorAll(".nav-link").forEach((l) => {
            l.classList.toggle("active", l.dataset.section === name);
        });
        document.querySelectorAll(".section").forEach((s) => {
            s.classList.remove("active");
            s.classList.add("hidden");
        });
        const section = this.$(`section-${name}`);
        if (section) {
            section.classList.remove("hidden");
            section.classList.add("active");
        }

        const [title] = this.sectionMeta(name);
        document.title = `${title} · Kelajak Markazi Chirchiq`;
        this.$("topnav")?.classList.remove("open");
        this.closeUserMenu();
        this.$("content-area")?.scrollTo({ top: 0 });

        if (name === "dashboard") this.loadDashboard();
        else if (name === "reports") this.loadReports();
        else if (name === "profile") this.loadProfile();
        else if (name === "history") this.loadHistory();
        else if (name === "admin") this.loadAdmin();
    },

    refresh() {
        this.showSection(this.currentSection);
        this.toast("Ma'lumotlar yangilandi");
    },

    /* ============== DASHBOARD ============== */
    async loadDashboard() {
        try {
            const [statsRes, boardRes] = await Promise.all([
                this.api("/dashboard/stats"),
                this.api("/leaderboard"),
            ]);
            if (!statsRes.res.ok || !boardRes.res.ok) throw new Error("load");

            const stats = statsRes.data || {};
            const board = boardRes.data?.users || [];

            const setText = (id, value) => {
                const el = this.$(id);
                if (el) el.textContent = value;
            };
            setText("stat-users", stats.total_users ?? 0);
            setText("stat-schools", stats.total_schools ?? 26);
            setText("stat-points", stats.total_points ?? 0);
            setText("stat-week", stats.points_this_week ?? 0);
            setText("week-range", `${this.fmtDate(stats.week_start)} — ${this.fmtDate(stats.week_end)}`);

            const displayName = this.currentUser?.full_name || this.currentUser?.username || "ishtirokchi";
            setText("welcome-title", `Salom, ${displayName}!`);

            const pending = Number(stats.pending_reports) || 0;
            const dot = this.$("nav-pending-dot");
            if (dot) dot.classList.toggle("hidden", !(this.currentUser?.role === "super_admin" && pending > 0));

            this.renderPodium(board);
            this.renderLeaderboard(board);
        } catch (err) {
            console.error("[dashboard]", err);
        }
    },

    renderPodium(users) {
        const el = this.$("podium");
        if (!el) return;
        const top = users.slice(0, 3);
        if (top.length === 0) {
            el.innerHTML = '<div class="empty-state"><i class="fa-solid fa-trophy"></i>Hozircha ishtirokchilar yo\'q</div>';
            return;
        }
        el.innerHTML = top.map((u) => `
            <div class="podium-row place-${u.rank}">
                <span class="podium-rank">${u.rank}</span>
                ${this.avatarMarkup(u, "avatar-sm")}
                <div class="podium-id">
                    <div class="podium-name">${this.esc(u.full_name || u.username)}</div>
                    <div class="podium-tag">${this.esc(u.tag)}</div>
                </div>
                <div class="podium-points">${this.fmtPoints(u.total_points)}<span> ball</span></div>
            </div>
        `).join("");
    },

    renderLeaderboard(users) {
        const body = this.$("leaderboard-body");
        const cards = this.$("leaderboard-cards");
        if (!body) return;
        if (users.length === 0) {
            body.innerHTML = '<tr><td colspan="6" class="empty-cell">Hozircha ishtirokchilar yo\'q</td></tr>';
            if (cards) cards.innerHTML = '<div class="empty-state"><i class="fa-solid fa-users"></i>Hozircha ishtirokchilar yo\'q</div>';
            return;
        }
        body.innerHTML = users.map((u) => {
            const topClass = u.rank <= 3 ? `top-${u.rank}` : "";
            const warnClass = u.warns_count > 0 ? "" : "zero";
            return `
                <tr>
                    <td><span class="rank ${topClass}">${u.rank}</span></td>
                    <td>
                        <div class="person">
                            ${this.avatarMarkup(u, "avatar-sm")}
                            <div style="min-width:0;">
                                <div class="person-name">${this.esc(u.full_name || u.username)}</div>
                                <div class="person-sub">@${this.esc(u.username)}</div>
                            </div>
                        </div>
                    </td>
                    <td><span class="role-tag ${u.role === "super_admin" ? "admin" : ""}">${this.esc(u.tag)}</span></td>
                    <td><span class="points ${this.pointsClass(u.week_points)}">${this.fmtPoints(u.week_points)}</span></td>
                    <td><span class="points ${this.pointsClass(u.total_points)}">${this.fmtPoints(u.total_points)}</span></td>
                    <td><span class="warn-pill ${warnClass}"><i class="fa-solid fa-triangle-exclamation"></i>${u.warns_count}</span></td>
                </tr>
            `;
        }).join("");

        if (cards) {
            cards.innerHTML = users.map((u) => {
                const topClass = u.rank <= 3 ? `top-${u.rank}` : "";
                const warnClass = u.warns_count > 0 ? "" : "zero";
                return `
                    <div class="lb-card">
                        <div class="lb-card-head">
                            <span class="rank ${topClass}">${u.rank}</span>
                            ${this.avatarMarkup(u, "avatar-sm")}
                            <div class="lb-card-id">
                                <div class="person-name">${this.esc(u.full_name || u.username)}</div>
                                <div class="person-sub">@${this.esc(u.username)}</div>
                            </div>
                        </div>
                        <div class="lb-card-tag"><span class="role-tag ${u.role === "super_admin" ? "admin" : ""}">${this.esc(u.tag)}</span></div>
                        <div class="lb-card-stats">
                            <div><span>Haftalik</span><strong class="points ${this.pointsClass(u.week_points)}">${this.fmtPoints(u.week_points)}</strong></div>
                            <div><span>Umumiy</span><strong class="points ${this.pointsClass(u.total_points)}">${this.fmtPoints(u.total_points)}</strong></div>
                            <div><span>Ogohl.</span><strong class="warn-pill ${warnClass}">${u.warns_count}</strong></div>
                        </div>
                    </div>
                `;
            }).join("");
        }
    },

    /* ============== PROFILE ============== */
    async loadProfile() {
        try {
            const { res, data } = await this.api("/profile");
            if (!res.ok || !data) return;

            const name = data.full_name || data.username || "Foydalanuvchi";
            const nameEl = this.$("profile-name");
            const tagEl = this.$("profile-tag");
            const usernameEl = this.$("profile-username");
            if (nameEl) nameEl.textContent = name;
            if (usernameEl) usernameEl.textContent = `@${data.username || ""}`;
            if (tagEl) {
                tagEl.textContent = data.tag || "Koordinator";
                tagEl.classList.toggle("admin", data.role === "super_admin");
            }
            this.setAvatar(this.$("profile-avatar"), data);

            const setText = (id, value) => {
                const el = this.$(id);
                if (el) el.textContent = value;
            };
            setText("profile-rank", data.rank ? `#${data.rank}` : "—");
            setText("profile-points", this.fmtPoints(data.total_points));
            setText("profile-reports-count", data.reports_count ?? 0);
            setText("profile-warns-count", data.warns?.length ?? 0);

            const fullnameInput = this.$("pf-fullname");
            const avatarInput = this.$("pf-avatar");
            const bioInput = this.$("pf-bio");
            const achInput = this.$("pf-achievements");
            const intInput = this.$("pf-interests");
            if (fullnameInput) fullnameInput.value = name;
            if (avatarInput) avatarInput.value = data.avatar_url || "";
            if (bioInput) bioInput.value = data.bio || "";
            if (achInput) achInput.value = (data.achievements || []).join(", ");
            if (intInput) intInput.value = (data.interests || []).join(", ");

            this.renderWarns(this.$("profile-warns-list"), data.warns || [], true);

            const bioEl = this.$("profile-bio");
            if (bioEl) bioEl.textContent = data.bio || "Bio hali kiritilmagan.";
            this.renderChips(this.$("profile-ach-chips"), data.achievements, "Yutuqlar hali kiritilmagan");
            this.renderChips(this.$("profile-int-chips"), data.interests, "Qiziqishlar hali kiritilmagan");
        } catch (err) {
            console.error("[profile]", err);
        }
    },

    async saveProfile() {
        const achievements = (this.$("pf-achievements")?.value || "").split(",").map((s) => s.trim()).filter(Boolean);
        const interests = (this.$("pf-interests")?.value || "").split(",").map((s) => s.trim()).filter(Boolean);

        try {
            const { res, data } = await this.api("/profile", {
                method: "PUT",
                body: {
                    full_name: this.$("pf-fullname")?.value || "",
                    avatar_url: this.$("pf-avatar")?.value || "",
                    bio: this.$("pf-bio")?.value || "",
                    achievements,
                    interests,
                },
            });
            if (!res.ok) {
                this.showMsg("profile-msg", data?.error || "Saqlanmadi", "error");
                return;
            }
            this.showMsg("profile-msg", "Profil saqlandi", "success");
            this.toast("Profil yangilandi");

            this.currentUser.full_name = this.$("pf-fullname")?.value || this.currentUser.full_name;
            this.currentUser.avatar_url = this.$("pf-avatar")?.value || "";
            this.setAvatar(this.$("topbar-avatar"), this.currentUser);
            this.setAvatar(this.$("profile-avatar"), this.currentUser);
            this.setAvatar(this.$("menu-avatar"), this.currentUser);
            const bioEl = this.$("profile-bio");
            if (bioEl) bioEl.textContent = this.$("pf-bio")?.value || "Bio hali kiritilmagan.";
            this.renderChips(this.$("profile-ach-chips"), achievements, "Yutuqlar hali kiritilmagan");
            this.renderChips(this.$("profile-int-chips"), interests, "Qiziqishlar hali kiritilmagan");
            const nameEl = this.$("profile-name");
            const topName = this.$("topbar-name");
            const menuName = this.$("menu-name");
            if (nameEl) nameEl.textContent = this.currentUser.full_name;
            if (topName) topName.textContent = this.currentUser.full_name;
            if (menuName) menuName.textContent = this.currentUser.full_name;
        } catch (_) {
            this.showMsg("profile-msg", "Server xatosi", "error");
        }
    },

    renderWarns(container, warns, compact = false) {
        if (!container) return;
        if (!warns.length) {
            container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-circle-check"></i>Ogohlantirishlar yo\'q</div>';
            return;
        }
        container.innerHTML = warns.map((w) => `
            <div class="warn-item">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <div class="warn-reason">
                    <div>${this.esc(w.reason)}</div>
                    ${compact && w.issuer_name ? `<div class="warn-meta">${this.esc(w.issuer_name)} · ${this.fmtDate(w.created_at)}</div>` : ""}
                </div>
                ${compact ? "" : `<span class="warn-meta">${this.fmtDate(w.created_at)}</span>`}
            </div>
        `).join("");
    },

    renderChips(container, items, emptyText) {
        if (!container) return;
        const list = Array.isArray(items) ? items.filter(Boolean) : [];
        if (!list.length) {
            container.innerHTML = `<span class="chip empty">${this.esc(emptyText)}</span>`;
            return;
        }
        container.innerHTML = list.map((item) => `<span class="chip">${this.esc(item)}</span>`).join("");
    },

    async changePassword() {
        const oldP = this.$("cp-old")?.value || "";
        const newP = this.$("cp-new")?.value || "";
        const newP2 = this.$("cp-new2")?.value || "";
        if (!oldP || !newP || !newP2) return this.showMsg("password-msg", "Barcha maydonlarni to'ldiring", "error");
        if (newP !== newP2) return this.showMsg("password-msg", "Yangi parollar bir xil emas", "error");
        if (newP.length < 6) return this.showMsg("password-msg", "Parol kamida 6 belgi bo'lsin", "error");

        try {
            const { res, data } = await this.api("/auth/change-password", {
                method: "POST",
                body: { old_password: oldP, new_password: newP },
            });
            if (res.ok) {
                this.showMsg("password-msg", data?.message || "Parol yangilandi", "success");
                ["cp-old", "cp-new", "cp-new2"].forEach((id) => { const el = this.$(id); if (el) el.value = ""; });
            } else {
                this.showMsg("password-msg", data?.error || "Xatolik", "error");
            }
        } catch (_) {
            this.showMsg("password-msg", "Server xatosi", "error");
        }
    },

    /* ============== HISTORY ============== */
    async loadHistory() {
        const body = this.$("history-body");
        if (!body) return;
        const isAdmin = this.currentUser?.role === "super_admin";
        const colspan = isAdmin ? 6 : 5;
        this.$("history-actions-head")?.classList.toggle("hidden", !isAdmin);
        try {
            const { res, data } = await this.api("/history");
            if (!res.ok || !Array.isArray(data)) throw new Error("history");
            if (data.length === 0) {
                body.innerHTML = `<tr><td colspan="${colspan}" class="empty-cell">Hozircha ball tarixi yo'q</td></tr>`;
                return;
            }
            body.innerHTML = data.map((item) => `
                <tr>
                    <td>${this.fmtDateTime(item.created_at)}</td>
                    <td><strong style="color:var(--text)">${this.esc(item.target_name || item.target_username)}</strong><div class="person-sub">@${this.esc(item.target_username)}</div></td>
                    <td><span class="points ${this.pointsClass(item.points)}">${this.fmtPoints(item.points)}</span></td>
                    <td>${this.esc(item.reason)}</td>
                    <td>${this.esc(item.issued_by_name || item.issued_by)}</td>
                    ${isAdmin ? `<td><button type="button" class="warn-delete" data-score-delete="${item.id}" title="Ball yozuvini o'chirish" aria-label="O'chirish"><i class="fa-solid fa-trash"></i></button></td>` : ""}
                </tr>
            `).join("");

            if (isAdmin) {
                body.querySelectorAll("[data-score-delete]").forEach((btn) => {
                    const item = data.find((row) => row.id === parseInt(btn.dataset.scoreDelete, 10));
                    if (item) btn.addEventListener("click", () => this.openScoreDeleteModal(item));
                });
            }
        } catch (err) {
            body.innerHTML = `<tr><td colspan="${colspan}" class="empty-cell">Yuklashda xatolik</td></tr>`;
        }
    },

    /* ============== REPORTS ============== */
    switchReportTab(tab) {
        this.reportTab = tab;
        document.querySelectorAll("[data-report-tab]").forEach((b) => {
            b.classList.toggle("active", b.dataset.reportTab === tab);
        });
        this.$("reports-feed")?.classList.toggle("hidden", tab !== "feed");
        this.$("reports-mine")?.classList.toggle("hidden", tab !== "mine");
        this.$("feed-more-wrap")?.classList.toggle("hidden", tab !== "feed" || this.reportsFeed.length >= this.reportsTotal);
        if (tab === "feed") this.loadReportsFeed(false);
        else this.loadMyReports();
    },

    loadReports() {
        if (this.reportTab === "feed") this.loadReportsFeed(false);
        else this.loadMyReports();
    },

    async loadReportsFeed(append = false) {
        const wrap = this.$("reports-feed");
        if (!wrap) return;
        const offset = append ? this.reportsFeed.length : 0;
        if (!append) {
            wrap.innerHTML = '<div class="report-skeleton"></div><div class="report-skeleton"></div><div class="report-skeleton"></div>';
        }
        try {
            const { res, data } = await this.api(`/reports/feed?limit=9&offset=${offset}`);
            if (!res.ok || !data) throw new Error("feed");
            const items = data.reports || [];
            this.reportsTotal = data.total ?? items.length;
            this.reportsFeed = append ? this.reportsFeed.concat(items) : items;

            if (!this.reportsFeed.length) {
                wrap.innerHTML = `<div class="empty-state" style="grid-column:1/-1;padding:60px 16px;">
                    <i class="fa-solid fa-images"></i>
                    <div>Hozircha hisobotlar yo'q. Birinchi bo'lib yuboring!</div>
                    <button class="btn btn-primary btn-sm" onclick="app.openReportComposer()"><i class="fa-solid fa-plus"></i> Hisobot yuborish</button>
                </div>`;
            } else {
                wrap.innerHTML = this.reportsFeed.map((r) => this.reportCard(r)).join("");
                wrap.querySelectorAll(".report-card").forEach((card) => {
                    const report = this.reportsFeed.find((r) => r.id === parseInt(card.dataset.reportId, 10));
                    if (!report) return;
                    card.addEventListener("click", (e) => {
                        if (e.target.closest("[data-like]")) return;
                        this.openReportDetail(report);
                    });
                });
                this.bindLikeButtons(wrap);
            }

            const more = this.$("feed-more-wrap");
            if (more) more.classList.toggle("hidden", this.reportsFeed.length >= this.reportsTotal || this.reportTab !== "feed");
        } catch (err) {
            wrap.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><i class="fa-solid fa-triangle-exclamation"></i>Yuklashda xatolik</div>';
        }
    },

    bindLikeButtons(scope) {
        scope.querySelectorAll("[data-like]").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                this.toggleLike(parseInt(btn.dataset.like, 10), btn);
            });
        });
    },

    async toggleLike(reportId, btn) {
        try {
            const { res, data } = await this.api(`/reports/${reportId}/like`, { method: "POST" });
            if (!res.ok || !data) return;
            const report = this.reportsFeed.find((r) => r.id === reportId);
            if (report) {
                report.liked = data.liked;
                report.likes = data.likes;
            }
            const detail = this.myReports.find((r) => r.id === reportId);
            if (detail) detail.likes = data.likes;
            document.querySelectorAll(`[data-like="${reportId}"]`).forEach((el) => {
                el.classList.toggle("liked", data.liked);
                const icon = el.querySelector("i");
                if (icon) icon.className = `${data.liked ? "fa-solid" : "fa-regular"} fa-heart`;
                const count = el.querySelector("span");
                if (count) count.textContent = data.likes;
            });
            if (btn) btn.classList.toggle("liked", data.liked);
        } catch (_) {}
    },

    reportCard(r) {
        const body = String(r.body || "").replace(/\s+/g, " ").trim();
        return `
            <article class="report-card" data-report-id="${r.id}">
                <div class="report-cover">
                    <img src="${this.esc(r.image_url)}" alt="${this.esc(r.title)}" loading="lazy">
                    ${r.points_awarded ? `<span class="report-points">+${r.points_awarded} ball</span>` : ""}
                </div>
                <div class="report-body">
                    <div class="report-head">
                        ${this.avatarMarkup({ username: r.username, full_name: r.author_name, avatar_url: r.avatar_url }, "avatar-sm")}
                        <span class="report-author">${this.esc(r.author_name)}</span>
                        <span class="report-time">${this.fmtDate(r.created_at)}</span>
                    </div>
                    <h3>${this.esc(r.title)}</h3>
                    <p class="report-excerpt">${this.esc(body)}</p>
                    <div class="report-foot">
                        <span class="role-tag">${this.esc(r.tag)}</span>
                        <button type="button" class="like-btn ${r.liked ? "liked" : ""}" data-like="${r.id}" aria-label="Yoqdi">
                            <i class="${r.liked ? "fa-solid" : "fa-regular"} fa-heart"></i><span>${r.likes || 0}</span>
                        </button>
                    </div>
                </div>
            </article>
        `;
    },

    openReportDetail(report) {
        const approved = report.status === "approved";
        const statusText = { pending: "Kutilmoqda", approved: "Tasdiqlangan", rejected: "Rad etilgan" };
        const html = `
            <img class="report-detail-cover" src="${this.esc(report.image_url)}" alt="${this.esc(report.title)}">
            <div class="report-detail-meta">
                ${this.avatarMarkup({ username: report.username, full_name: report.author_name, avatar_url: report.avatar_url }, "avatar-sm")}
                <div style="min-width:0;">
                    <div class="person-name">${this.esc(report.author_name)}</div>
                    <div class="person-sub">${this.esc(report.tag)} · ${this.fmtDateTime(report.created_at)}</div>
                </div>
                <span class="report-points" style="position:static;margin-left:auto;">${report.points_awarded ? `+${report.points_awarded} ball` : "Hisobot"}</span>
            </div>
            <h3 style="font-size:1.15rem;margin-bottom:10px;">${this.esc(report.title)}</h3>
            <div class="report-detail-text">${this.esc(report.body).replace(/\n/g, "<br>")}</div>
            ${report.review_note ? `<div class="mod-note" style="margin-top:12px;">${this.esc(report.review_note)}</div>` : ""}
            <div class="detail-actions">
                ${approved
                    ? `<button type="button" class="like-btn ${report.liked ? "liked" : ""}" data-like="${report.id}">
                           <i class="${report.liked ? "fa-solid" : "fa-regular"} fa-heart"></i><span>${report.likes || 0}</span>
                       </button>`
                    : `<span class="status-chip ${report.status}">${statusText[report.status] || report.status}</span>`}
            </div>
        `;
        const modal = this.showModal("Hisobot", html, [
            { label: "Yopish", cls: "btn-ghost", onClick: () => this.closeModal() },
        ]);
        modal.classList.add("modal-wide");
        if (approved) this.bindLikeButtons(modal);
    },

    openReportComposer() {
        const html = `
            <form id="report-form" autocomplete="off">
                <div class="form-group">
                    <label for="report-title">Sarlavha</label>
                    <input type="text" id="report-title" maxlength="100" placeholder="Masalan: Haftalik faoliyat hisoboti">
                </div>
                <div class="form-group">
                    <label for="report-body">Matn</label>
                    <textarea id="report-body" rows="5" maxlength="2000" placeholder="Nima qildingiz, qanday natijaga erishdingiz?"></textarea>
                </div>
                <div class="form-group">
                    <label>Rasm</label>
                    <label class="file-drop" for="report-image">
                        <i class="fa-solid fa-cloud-arrow-up"></i>
                        <span>Rasm tanlang</span>
                        <small>JPG, PNG yoki WEBP · 8 MB gacha</small>
                        <input type="file" id="report-image" accept="image/jpeg,image/png,image/webp" hidden>
                    </label>
                    <img id="report-preview" class="report-preview hidden" alt="Ko'rinish">
                </div>
                <p class="composer-note"><i class="fa-solid fa-circle-info"></i> Hisobot Bosh Koordinator tekshiruvidan keyin lentada chiqadi.</p>
            </form>
        `;
        const modal = this.showModal("Yangi hisobot", html, [
            { label: "Bekor qilish", cls: "btn-ghost", onClick: () => this.closeModal() },
            { label: "Yuborish", cls: "btn-primary", onClick: () => this.submitReport() },
        ]);
        const input = modal.querySelector("#report-image");
        const preview = modal.querySelector("#report-preview");
        const drop = modal.querySelector(".file-drop");
        input?.addEventListener("change", () => {
            const file = input.files && input.files[0];
            if (!file) {
                preview?.classList.add("hidden");
                return;
            }
            if (preview) {
                preview.src = URL.createObjectURL(file);
                preview.classList.remove("hidden");
            }
            if (drop) drop.classList.add("has-file");
        });
    },

    async submitReport() {
        const title = (this.$("report-title")?.value || "").trim();
        const body = (this.$("report-body")?.value || "").trim();
        const file = this.$("report-image")?.files?.[0];
        if (title.length < 3) return this.toast("Sarlavhani kiriting", "error");
        if (body.length < 10) return this.toast("Matn kamida 10 belgi bo'lsin", "error");
        if (!file) return this.toast("Rasm yuklang", "error");

        const fd = new FormData();
        fd.append("title", title);
        fd.append("body", body);
        fd.append("image", file);

        try {
            const { res, data } = await this.api("/reports", { method: "POST", body: fd });
            if (!res.ok) {
                this.toast(data?.error || "Yuborilmadi", "error");
                return;
            }
            this.closeModal();
            this.toast("Hisobot yuborildi. Tekshiruvdan keyin e'lon qilinadi");
            this.reportTab = "mine";
            this.showSection("reports");
            this.switchReportTab("mine");
        } catch (_) {
            this.toast("Server bilan aloqa yo'q", "error");
        }
    },

    async loadMyReports() {
        const wrap = this.$("reports-mine");
        if (!wrap) return;
        wrap.innerHTML = '<div class="empty-state"><i class="fa-solid fa-circle-notch fa-spin"></i>Yuklanmoqda...</div>';
        try {
            const { res, data } = await this.api("/reports/mine");
            if (!res.ok || !Array.isArray(data)) throw new Error("mine");
            this.myReports = data;
            const countEl = this.$("my-report-count");
            if (countEl) {
                const pending = data.filter((r) => r.status === "pending").length;
                countEl.textContent = String(data.length);
                countEl.classList.toggle("hidden", data.length === 0);
                countEl.classList.toggle("lime", pending > 0);
            }
            if (!data.length) {
                wrap.innerHTML = `<div class="empty-state" style="padding:50px 16px;">
                    <i class="fa-solid fa-images"></i>
                    <div>Siz hali hisobot yubormagansiz.</div>
                    <button class="btn btn-primary btn-sm" onclick="app.openReportComposer()"><i class="fa-solid fa-plus"></i> Birinchi hisobotni yuborish</button>
                </div>`;
                return;
            }
            const statusText = { pending: "Kutilmoqda", approved: "Tasdiqlangan", rejected: "Rad etilgan" };
            wrap.innerHTML = data.map((r) => `
                <div class="report-row">
                    <img class="report-thumb" src="${this.esc(r.image_url)}" alt="${this.esc(r.title)}" loading="lazy">
                    <div class="report-row-body">
                        <h4>${this.esc(r.title)}</h4>
                        <div class="report-row-meta">
                            <span class="status-chip ${r.status}">${statusText[r.status] || r.status}</span>
                            <span>${this.fmtDateTime(r.created_at)}</span>
                            ${r.points_awarded ? `<span class="points pos">+${r.points_awarded} ball</span>` : ""}
                            ${r.status === "approved" ? `<span><i class="fa-regular fa-heart"></i> ${r.likes || 0}</span>` : ""}
                        </div>
                        ${r.review_note ? `<div class="report-row-note"><i class="fa-solid fa-comment-dots"></i> ${this.esc(r.review_note)}</div>` : ""}
                    </div>
                    <div class="report-row-side">
                        ${r.status === "approved"
                            ? `<button type="button" class="btn btn-ghost btn-sm" data-open-report="${r.id}"><i class="fa-solid fa-eye"></i></button>`
                            : `<button type="button" class="warn-delete" data-del-report="${r.id}" title="Hisobotni o'chirish" aria-label="O'chirish"><i class="fa-solid fa-trash"></i></button>`}
                    </div>
                </div>
            `).join("");

            wrap.querySelectorAll("[data-open-report]").forEach((btn) => {
                const report = data.find((r) => r.id === parseInt(btn.dataset.openReport, 10));
                if (report) btn.addEventListener("click", () => this.openReportDetail(report));
            });
            wrap.querySelectorAll("[data-del-report]").forEach((btn) => {
                const report = data.find((r) => r.id === parseInt(btn.dataset.delReport, 10));
                if (report) btn.addEventListener("click", () => this.deleteReport(report, false));
            });
        } catch (_) {
            wrap.innerHTML = '<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i>Yuklashda xatolik</div>';
        }
    },

    deleteReport(report, asAdmin) {
        const html = `
            <div class="modal-user">
                <div class="stat-icon red"><i class="fa-solid fa-trash"></i></div>
                <div>
                    <strong>${this.esc(report.title)}</strong>
                    <span>${this.esc(report.author_name || "Sizning hisobotingiz")}</span>
                </div>
            </div>
            <p class="modal-text">Hisobot butunlay o'chiriladi${report.points_awarded ? " va u uchun berilgan ball ham olib tashlanadi" : ""}. Davom etasizmi?</p>
        `;
        this.showModal("Hisobotni o'chirish", html, [
            { label: "Bekor qilish", cls: "btn-ghost", onClick: () => this.closeModal() },
            {
                label: "O'chirish",
                cls: "btn-danger",
                onClick: async () => {
                    const { res, data } = await this.api(`/reports/${report.id}`, { method: "DELETE" });
                    if (!res.ok) {
                        this.toast(data?.error || "O'chirilmadi", "error");
                        return;
                    }
                    this.closeModal();
                    this.toast("Hisobot o'chirildi");
                    if (asAdmin) this.loadAdmin();
                    else this.loadMyReports();
                },
            },
        ]);
    },

    /* ============== ADMIN ============== */
    async loadAdmin() {
        if (this.currentUser?.role !== "super_admin") return;
        try {
            const [boardRes, warnRes, statsRes, historyRes] = await Promise.all([
                this.api("/leaderboard"),
                this.api("/warns"),
                this.api("/dashboard/stats"),
                this.api("/history"),
            ]);

            const users = boardRes.res.ok ? (boardRes.data?.users || []) : [];
            const warns = warnRes.res.ok ? (warnRes.data || []) : [];
            const stats = statsRes.res.ok ? (statsRes.data || {}) : {};
            const scores = historyRes.res.ok ? (historyRes.data || []) : [];

            const setText = (id, value) => { const el = this.$(id); if (el) el.textContent = value; };
            setText("admin-stat-users", stats.total_users ?? users.length);
            setText("admin-stat-points", stats.total_points ?? 0);
            setText("admin-stat-warns", stats.total_warns ?? warns.length);
            setText("admin-stat-pending", stats.pending_reports ?? 0);
            const dot = this.$("nav-pending-dot");
            if (dot) dot.classList.toggle("hidden", !(Number(stats.pending_reports) > 0));

            const body = this.$("admin-users-body");
            if (body) {
                if (users.length === 0) {
                    body.innerHTML = '<tr><td colspan="6" class="empty-cell">Ishtirokchilar yo\'q</td></tr>';
                } else {
                    body.innerHTML = users.map((u) => {
                        const self = u.id === this.currentUser.id;
                        const actions = self
                            ? '<span class="person-sub">Siz</span>'
                            : `<div style="display:flex;gap:7px;flex-wrap:wrap;">
                                   <button class="btn btn-primary btn-sm" data-score-id="${u.id}"><i class="fa-solid fa-plus"></i> Ball</button>
                                   <button class="btn btn-ghost btn-sm" data-warn-id="${u.id}"><i class="fa-solid fa-triangle-exclamation"></i> Ogohl.</button>
                                   <button type="button" class="warn-delete" data-user-del="${u.id}" title="Foydalanuvchini o'chirish" aria-label="O'chirish"><i class="fa-solid fa-trash"></i></button>
                               </div>`;
                        return `
                            <tr>
                                <td>
                                    <div class="person">
                                        ${this.avatarMarkup(u, "avatar-sm")}
                                        <div style="min-width:0;"><div class="person-name">${this.esc(u.full_name || u.username)}</div><div class="person-sub">@${this.esc(u.username)}</div></div>
                                    </div>
                                </td>
                                <td><span class="role-tag ${u.role === "super_admin" ? "admin" : ""}">${this.esc(u.tag)}</span></td>
                                <td><span class="points ${this.pointsClass(u.total_points)}">${this.fmtPoints(u.total_points)}</span></td>
                                <td>${u.reports_count || 0}</td>
                                <td><span class="warn-pill ${u.warns_count ? "" : "zero"}">${u.warns_count}</span></td>
                                <td>${actions}</td>
                            </tr>
                        `;
                    }).join("");

                    body.querySelectorAll("[data-score-id]").forEach((btn) => {
                        const user = users.find((u) => u.id === parseInt(btn.dataset.scoreId, 10));
                        if (user) btn.addEventListener("click", () => this.openScoreModal(user));
                    });
                    body.querySelectorAll("[data-warn-id]").forEach((btn) => {
                        const user = users.find((u) => u.id === parseInt(btn.dataset.warnId, 10));
                        if (user) btn.addEventListener("click", () => this.openWarnModal(user));
                    });
                    body.querySelectorAll("[data-user-del]").forEach((btn) => {
                        const user = users.find((u) => u.id === parseInt(btn.dataset.userDel, 10));
                        if (user) btn.addEventListener("click", () => this.openUserDeleteModal(user));
                    });
                }
            }

            const cards = this.$("admin-users-cards");
            if (cards) {
                if (users.length === 0) {
                    cards.innerHTML = '<div class="empty-state"><i class="fa-solid fa-users"></i>Ishtirokchilar yo\'q</div>';
                } else {
                    cards.innerHTML = users.map((u) => {
                        const self = u.id === this.currentUser.id;
                        const actions = self
                            ? '<span class="person-sub">Bu sizning akkauntingiz</span>'
                            : `<button class="btn btn-primary btn-sm" data-score-id="${u.id}"><i class="fa-solid fa-plus"></i> Ball</button>
                               <button class="btn btn-ghost btn-sm" data-warn-id="${u.id}"><i class="fa-solid fa-triangle-exclamation"></i></button>
                               <button type="button" class="warn-delete" data-user-del="${u.id}" title="Foydalanuvchini o'chirish" aria-label="O'chirish"><i class="fa-solid fa-trash"></i></button>`;
                        return `
                            <div class="admin-card">
                                <div class="admin-card-head">
                                    ${this.avatarMarkup(u, "avatar-md")}
                                    <div class="admin-card-id">
                                        <div class="person-name">${this.esc(u.full_name || u.username)}</div>
                                        <div class="person-sub">@${this.esc(u.username)}</div>
                                        <span class="role-tag ${u.role === "super_admin" ? "admin" : ""}">${this.esc(u.tag)}</span>
                                    </div>
                                </div>
                                <div class="admin-card-stats">
                                    <div><span>Ball</span><strong class="points ${this.pointsClass(u.total_points)}">${this.fmtPoints(u.total_points)}</strong></div>
                                    <div><span>Hisobot</span><strong>${u.reports_count || 0}</strong></div>
                                    <div><span>Ogohl.</span><strong class="warn-pill ${u.warns_count ? "" : "zero"}">${u.warns_count}</strong></div>
                                </div>
                                <div class="admin-card-actions">${actions}</div>
                            </div>
                        `;
                    }).join("");

                    cards.querySelectorAll("[data-score-id]").forEach((btn) => {
                        const user = users.find((u) => u.id === parseInt(btn.dataset.scoreId, 10));
                        if (user) btn.addEventListener("click", () => this.openScoreModal(user));
                    });
                    cards.querySelectorAll("[data-warn-id]").forEach((btn) => {
                        const user = users.find((u) => u.id === parseInt(btn.dataset.warnId, 10));
                        if (user) btn.addEventListener("click", () => this.openWarnModal(user));
                    });
                    cards.querySelectorAll("[data-user-del]").forEach((btn) => {
                        const user = users.find((u) => u.id === parseInt(btn.dataset.userDel, 10));
                        if (user) btn.addEventListener("click", () => this.openUserDeleteModal(user));
                    });
                }
            }

            const warnList = this.$("admin-warns-list");
            if (warnList) {
                if (!warns.length) {
                    warnList.innerHTML = '<div class="empty-state"><i class="fa-solid fa-circle-check"></i>Ogohlantirishlar yo\'q</div>';
                } else {
                    warnList.innerHTML = warns.map((w) => `
                        <div class="warn-item">
                            <i class="fa-solid fa-triangle-exclamation"></i>
                            <div class="warn-reason">
                                <strong style="color:var(--text)">${this.esc(w.target_name || w.target_username)}</strong> — ${this.esc(w.reason)}
                                <div class="warn-meta">${this.esc(w.issuer_name || "Admin")} · ${this.fmtDateTime(w.created_at)}</div>
                            </div>
                            <button type="button" class="warn-delete" data-warn-delete="${w.id}" title="Ogohlantirishni o'chirish" aria-label="O'chirish">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    `).join("");
                    warnList.querySelectorAll("[data-warn-delete]").forEach((btn) => {
                        const warn = warns.find((w) => w.id === parseInt(btn.dataset.warnDelete, 10));
                        if (warn) btn.addEventListener("click", () => this.openWarnDeleteModal(warn));
                    });
                }
            }

            const scoreList = this.$("admin-scores-list");
            if (scoreList) {
                if (!scores.length) {
                    scoreList.innerHTML = '<div class="empty-state"><i class="fa-solid fa-star"></i>Hozircha ball tarixi yo\'q</div>';
                } else {
                    scoreList.innerHTML = scores.slice(0, 12).map((item) => `
                        <div class="score-item">
                            <div class="score-icon"><i class="fa-solid fa-star"></i></div>
                            <div class="warn-reason">
                                <strong style="color:var(--text)">${this.esc(item.target_name || item.target_username)}</strong> — ${this.esc(item.reason)}
                                <div class="warn-meta">${this.esc(item.issued_by_name || "Admin")} · ${this.fmtDateTime(item.created_at)}</div>
                            </div>
                            <span class="points ${this.pointsClass(item.points)}">${this.fmtPoints(item.points)}</span>
                            <button type="button" class="warn-delete" data-score-del="${item.id}" title="Ball yozuvini o'chirish" aria-label="O'chirish">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    `).join("");
                    scoreList.querySelectorAll("[data-score-del]").forEach((btn) => {
                        const item = scores.find((row) => row.id === parseInt(btn.dataset.scoreDel, 10));
                        if (item) btn.addEventListener("click", () => this.openScoreDeleteModal(item));
                    });
                }
            }

            this.loadAdminReports(this.adminReportStatus);
        } catch (err) {
            console.error("[admin]", err);
        }
    },

    async loadAdminReports(status = this.adminReportStatus) {
        this.adminReportStatus = status;
        document.querySelectorAll("[data-admin-report-status]").forEach((btn) => {
            btn.classList.toggle("active", btn.dataset.adminReportStatus === status);
        });
        const wrap = this.$("admin-reports-list");
        if (!wrap) return;
        wrap.innerHTML = '<div class="empty-state"><i class="fa-solid fa-circle-notch fa-spin"></i>Yuklanmoqda...</div>';
        try {
            const { res, data } = await this.api(`/reports?status=${status}`);
            if (!res.ok || !data) throw new Error("reports");
            const reports = data.reports || [];
            const counts = data.counts || {};
            const setText = (id, value) => { const el = this.$(id); if (el) el.textContent = value; };
            setText("count-pending", counts.pending || 0);
            setText("count-approved", counts.approved || 0);
            setText("count-rejected", counts.rejected || 0);
            setText("admin-stat-pending", counts.pending || 0);
            const dot = this.$("nav-pending-dot");
            if (dot) dot.classList.toggle("hidden", !(counts.pending > 0));

            if (!reports.length) {
                const label = { pending: "Kutilayotgan hisobotlar yo'q", approved: "Tasdiqlangan hisobotlar yo'q", rejected: "Rad etilgan hisobotlar yo'q" }[status] || "Hisobotlar yo'q";
                wrap.innerHTML = `<div class="empty-state"><i class="fa-solid fa-circle-check"></i>${label}</div>`;
                return;
            }

            const statusText = { pending: "Kutilmoqda", approved: "Tasdiqlangan", rejected: "Rad etilgan" };
            wrap.innerHTML = reports.map((r) => `
                <div class="mod-card">
                    <img class="mod-cover" src="${this.esc(r.image_url)}" alt="${this.esc(r.title)}" loading="lazy">
                    <div class="mod-body">
                        <div class="mod-by">
                            ${this.avatarMarkup({ username: r.username, full_name: r.author_name, avatar_url: r.avatar_url }, "avatar-sm")}
                            <div>
                                <div class="mod-by-name">${this.esc(r.author_name)} <span class="person-sub">@${this.esc(r.username)}</span></div>
                                <div class="mod-by-sub">${this.esc(r.tag)} · ${this.fmtDateTime(r.created_at)}</div>
                            </div>
                            <span class="status-chip ${r.status}" style="margin-left:auto;">${statusText[r.status] || r.status}</span>
                        </div>
                        <h4>${this.esc(r.title)}</h4>
                        <div class="mod-text">${this.esc(r.body)}</div>
                        ${r.status === "approved" && r.points_awarded ? `<div class="points pos">+${r.points_awarded} ball berildi</div>` : ""}
                        ${r.review_note ? `<div class="mod-note">${this.esc(r.review_note)}</div>` : ""}
                        <div class="mod-actions">
                            <button type="button" class="btn btn-ghost btn-sm" data-view-report="${r.id}"><i class="fa-solid fa-eye"></i> Ko'rish</button>
                            ${r.status === "pending" ? `
                                <button type="button" class="btn btn-primary btn-sm" data-approve="${r.id}"><i class="fa-solid fa-check"></i> Tasdiqlash</button>
                                <button type="button" class="btn btn-danger btn-sm" data-reject="${r.id}"><i class="fa-solid fa-xmark"></i> Rad etish</button>
                            ` : ""}
                            <button type="button" class="btn btn-ghost btn-sm" data-del-admin-report="${r.id}" style="margin-left:auto;"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>
                </div>
            `).join("");

            const find = (id) => reports.find((r) => r.id === parseInt(id, 10));
            wrap.querySelectorAll("[data-view-report]").forEach((btn) => {
                const report = find(btn.dataset.viewReport);
                if (report) btn.addEventListener("click", () => this.openReportDetail(report));
            });
            wrap.querySelectorAll("[data-approve]").forEach((btn) => {
                const report = find(btn.dataset.approve);
                if (report) btn.addEventListener("click", () => this.openReviewModal(report, "approve"));
            });
            wrap.querySelectorAll("[data-reject]").forEach((btn) => {
                const report = find(btn.dataset.reject);
                if (report) btn.addEventListener("click", () => this.openReviewModal(report, "reject"));
            });
            wrap.querySelectorAll("[data-del-admin-report]").forEach((btn) => {
                const report = find(btn.dataset.delAdminReport);
                if (report) btn.addEventListener("click", () => this.deleteReport(report, true));
            });
        } catch (_) {
            wrap.innerHTML = '<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i>Yuklashda xatolik</div>';
        }
    },

    openReviewModal(report, action) {
        const isApprove = action === "approve";
        const html = `
            <div class="modal-user">
                <img class="review-thumb" src="${this.esc(report.image_url)}" alt="${this.esc(report.title)}">
                <div>
                    <strong>${this.esc(report.title)}</strong>
                    <span>${this.esc(report.author_name)} · ${this.esc(report.tag)}</span>
                </div>
            </div>
            ${isApprove ? `
                <div class="form-group">
                    <label for="review-points">Beriladigan ball (1–100)</label>
                    <input type="number" id="review-points" min="1" max="100" value="10">
                </div>` : ""}
            <div class="form-group">
                <label for="review-note">${isApprove ? "Izoh (ixtiyoriy)" : "Rad etish sababi"}</label>
                <textarea id="review-note" rows="3" placeholder="${isApprove ? "Masalan: ajoyib hisobot" : "Nima uchun rad etildi?"}"></textarea>
            </div>
        `;
        this.showModal(isApprove ? "Hisobotni tasdiqlash" : "Hisobotni rad etish", html, [
            { label: "Bekor qilish", cls: "btn-ghost", onClick: () => this.closeModal() },
            {
                label: isApprove ? "Tasdiqlash" : "Rad etish",
                cls: isApprove ? "btn-primary" : "btn-danger",
                onClick: async () => {
                    const payload = { action, note: (this.$("review-note")?.value || "").trim() };
                    if (isApprove) {
                        const points = parseInt(this.$("review-points")?.value, 10);
                        if (!points || points < 1 || points > 100) return this.toast("Ball 1–100 oralig'ida bo'lsin", "error");
                        payload.points = points;
                    }
                    const { res, data } = await this.api(`/reports/${report.id}/review`, { method: "POST", body: payload });
                    if (!res.ok) {
                        this.toast(data?.error || "Xatolik", "error");
                        return;
                    }
                    this.closeModal();
                    this.toast(data?.message || "Saqlandi");
                    this.loadAdmin();
                },
            },
        ]);
    },

    /* ============== MODALS: SCORE / WARN / USER ============== */
    openScoreModal(user) {
        const html = `
            <div class="modal-user">
                ${this.avatarMarkup(user, "avatar-md")}
                <div><strong>${this.esc(user.full_name || user.username)}</strong><span>${this.esc(user.tag)}</span></div>
            </div>
            <div class="form-group">
                <label for="score-points">Ball (-100 dan 100 gacha)</label>
                <input type="number" id="score-points" min="-100" max="100" value="5" required>
            </div>
            <div class="form-group">
                <label for="score-reason">Sabab</label>
                <textarea id="score-reason" rows="3" placeholder="Nima uchun ball berilmoqda?"></textarea>
            </div>
        `;
        this.showModal("Ball berish", html, [
            { label: "Bekor qilish", cls: "btn-ghost", onClick: () => this.closeModal() },
            {
                label: "Saqlash",
                cls: "btn-primary",
                onClick: async () => {
                    const points = parseInt(this.$("score-points")?.value, 10);
                    const reason = (this.$("score-reason")?.value || "").trim();
                    if (!points || Number.isNaN(points)) return this.toast("Ballni kiriting", "error");
                    if (!reason) return this.toast("Sababni kiriting", "error");
                    const { res, data } = await this.api("/score", {
                        method: "POST",
                        body: { user_id: user.id, points, reason },
                    });
                    if (res.ok) {
                        this.closeModal();
                        this.toast("Ball saqlandi");
                        this.loadAdmin();
                        if (this.currentSection === "dashboard") this.loadDashboard();
                    } else {
                        this.toast(data?.error || "Xatolik", "error");
                    }
                },
            },
        ]);
    },

    openWarnModal(user) {
        const html = `
            <div class="modal-user">
                ${this.avatarMarkup(user, "avatar-md")}
                <div><strong>${this.esc(user.full_name || user.username)}</strong><span>${this.esc(user.tag)}</span></div>
            </div>
            <div class="form-group">
                <label for="warn-reason">Ogohlantirish sababi</label>
                <textarea id="warn-reason" rows="3" placeholder="Masalan: haftalik hisobotni topshirmadi"></textarea>
            </div>
        `;
        this.showModal("Ogohlantirish yuborish", html, [
            { label: "Bekor qilish", cls: "btn-ghost", onClick: () => this.closeModal() },
            {
                label: "Yuborish",
                cls: "btn-primary",
                onClick: async () => {
                    const reason = (this.$("warn-reason")?.value || "").trim();
                    if (!reason) return this.toast("Sababni kiriting", "error");
                    const { res, data } = await this.api("/warns", {
                        method: "POST",
                        body: { user_id: user.id, reason },
                    });
                    if (res.ok) {
                        this.closeModal();
                        this.toast("Ogohlantirish yuborildi");
                        this.loadAdmin();
                        if (this.currentSection === "dashboard") this.loadDashboard();
                    } else {
                        this.toast(data?.error || "Xatolik", "error");
                    }
                },
            },
        ]);
    },

    openWarnDeleteModal(warn) {
        const html = `
            <div class="modal-user">
                <div class="stat-icon red"><i class="fa-solid fa-triangle-exclamation"></i></div>
                <div>
                    <strong>${this.esc(warn.target_name || warn.target_username || "Ishtirokchi")}</strong>
                    <span>${this.esc(warn.reason)}</span>
                </div>
            </div>
            <p class="modal-text">Bu ogohlantirish butunlay o'chiriladi va foydalanuvchining ogohlantirishlar soni kamayadi. Davom etasizmi?</p>
        `;
        this.showModal("Ogohlantirishni o'chirish", html, [
            { label: "Bekor qilish", cls: "btn-ghost", onClick: () => this.closeModal() },
            {
                label: "O'chirish",
                cls: "btn-danger",
                onClick: async () => {
                    const { res, data } = await this.api(`/warns/${warn.id}`, { method: "DELETE" });
                    if (res.ok) {
                        this.closeModal();
                        this.toast("Ogohlantirish o'chirildi");
                        this.loadAdmin();
                        if (this.currentSection === "dashboard") this.loadDashboard();
                    } else {
                        this.toast(data?.error || "O'chirilmadi", "error");
                    }
                },
            },
        ]);
    },

    openUserDeleteModal(user) {
        const html = `
            <div class="modal-user">
                ${this.avatarMarkup(user, "avatar-md")}
                <div>
                    <strong>${this.esc(user.full_name || user.username)}</strong>
                    <span>@${this.esc(user.username)} · ${this.esc(user.tag)}</span>
                </div>
            </div>
            <div class="admin-card-stats" style="margin-bottom:12px;">
                <div><span>Ball</span><strong class="points ${this.pointsClass(user.total_points)}">${this.fmtPoints(user.total_points)}</strong></div>
                <div><span>Hisobot</span><strong>${user.reports_count || 0}</strong></div>
                <div><span>Ogohl.</span><strong class="warn-pill ${user.warns_count ? "" : "zero"}">${user.warns_count}</strong></div>
            </div>
            <p class="modal-text">Bu foydalanuvchi <strong style="color:var(--red)">butunlay o'chiriladi</strong>: akkaunt, barcha ballari, hisobotlari va ogohlantirishlari. Bu amalni bekor qilib bo'lmaydi. Davom etasizmi?</p>
        `;
        this.showModal("Foydalanuvchini o'chirish", html, [
            { label: "Bekor qilish", cls: "btn-ghost", onClick: () => this.closeModal() },
            {
                label: "O'chirish",
                cls: "btn-danger",
                onClick: async () => {
                    const { res, data } = await this.api(`/users/${user.id}`, { method: "DELETE" });
                    if (res.ok) {
                        this.closeModal();
                        this.toast("Foydalanuvchi o'chirildi");
                        this.loadAdmin();
                        if (this.currentSection === "history") this.loadHistory();
                        if (this.currentSection === "dashboard") this.loadDashboard();
                    } else {
                        this.toast(data?.error || "O'chirilmadi", "error");
                    }
                },
            },
        ]);
    },

    openScoreDeleteModal(score) {
        const html = `
            <div class="modal-user">
                <div class="stat-icon gold"><i class="fa-solid fa-star"></i></div>
                <div>
                    <strong>${this.esc(score.target_name || score.target_username || "Ishtirokchi")}</strong>
                    <span>${this.fmtPoints(score.points)} ball · ${this.esc(score.reason)}</span>
                </div>
            </div>
            <p class="modal-text">Bu ball yozuvi butunlay o'chiriladi va foydalanuvchining umumiy balli shu miqdorga kamayadi. Davom etasizmi?</p>
        `;
        this.showModal("Ball yozuvini o'chirish", html, [
            { label: "Bekor qilish", cls: "btn-ghost", onClick: () => this.closeModal() },
            {
                label: "O'chirish",
                cls: "btn-danger",
                onClick: async () => {
                    const { res, data } = await this.api(`/score/${score.id}`, { method: "DELETE" });
                    if (res.ok) {
                        this.closeModal();
                        this.toast("Ball yozuvi o'chirildi");
                        if (this.currentSection === "admin") this.loadAdmin();
                        if (this.currentSection === "history") this.loadHistory();
                        if (this.currentSection === "dashboard") this.loadDashboard();
                    } else {
                        this.toast(data?.error || "O'chirilmadi", "error");
                    }
                },
            },
        ]);
    },

    /* ============== MODAL ============== */
    showModal(title, contentHtml, buttons = []) {
        const buttonsHtml = buttons.length
            ? `<div class="modal-footer">${buttons.map((b, i) => `<button type="button" class="btn ${b.cls || "btn-primary"}" data-btn-index="${i}">${this.esc(b.label)}</button>`).join("")}</div>`
            : "";

        const modal = document.createElement("div");
        modal.className = "modal";
        modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${this.esc(title)}</h3>
                    <button type="button" class="modal-close" data-close aria-label="Yopish"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="modal-body">${contentHtml}</div>
                ${buttonsHtml}
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector(".modal-backdrop")?.addEventListener("click", () => modal.remove());
        modal.querySelector("[data-close]")?.addEventListener("click", () => modal.remove());
        modal.querySelector(".modal-content")?.addEventListener("click", (e) => e.stopPropagation());
        modal.addEventListener("submit", (e) => e.preventDefault());

        modal.querySelectorAll("[data-btn-index]").forEach((btn) => {
            btn.addEventListener("click", () => {
                const item = buttons[parseInt(btn.dataset.btnIndex, 10)];
                if (item && typeof item.onClick === "function") item.onClick();
            });
        });
        return modal;
    },

    closeModal() {
        document.querySelectorAll(".modal").forEach((m) => m.remove());
    },
};

window.app = app;
document.addEventListener("DOMContentLoaded", () => app.init());
