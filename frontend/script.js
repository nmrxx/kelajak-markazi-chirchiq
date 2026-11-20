/* =========================================
   Kelajak Markazi Chirchiq — frontend
   ========================================= */

const API = "/api";

const app = {
    currentUser: null,
    currentSection: "dashboard",
    schools: [],
    clockTimer: null,

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
        if (opts.body && typeof opts.body !== "string") {
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
            ["#2f7bff", "#0b3fae"],
            ["#4fc3f7", "#0b6fa8"],
            ["#7a8cff", "#3b4fd8"],
            ["#2ec4a6", "#0b7d6c"],
            ["#5b95ff", "#1140a0"],
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
            return `<div class="avatar ${size}" style="background-image:url('${url}')"></div>`;
        }
        const [a, b] = this.colorFor(user?.username || name);
        return `<div class="avatar ${size}" style="background:linear-gradient(135deg,${a},${b})">${this.esc(this.getInitials(name))}</div>`;
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
        const closeSidebar = () => {
            this.$("sidebar")?.classList.remove("open");
            this.$("sidebar-overlay")?.classList.remove("open");
        };
        this.$("mobile-menu-btn")?.addEventListener("click", () => {
            this.$("sidebar")?.classList.add("open");
            this.$("sidebar-overlay")?.classList.add("open");
        });
        this.$("close-sidebar")?.addEventListener("click", closeSidebar);
        this.$("sidebar-overlay")?.addEventListener("click", closeSidebar);
        document.querySelector(".sidebar-user")?.addEventListener("click", () => this.showSection("profile"));
        document.querySelectorAll(".sidebar-nav .nav-link").forEach((link) => {
            link.addEventListener("click", closeSidebar);
        });
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
        this.$("login-form")?.reset();
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
                    ${this.avatarMarkup(u, "avatar")}
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

        const sidebarName = this.$("sidebar-user-name");
        const sidebarTag = this.$("sidebar-user-tag");
        if (sidebarName) sidebarName.textContent = name;
        if (sidebarTag) sidebarTag.textContent = tag;
        this.setAvatar(this.$("sidebar-avatar"), user);
        this.setAvatar(this.$("topbar-avatar"), user);
        this.setAvatar(this.$("profile-avatar"), user);

        const topName = this.$("topbar-name");
        const topTag = this.$("topbar-tag");
        if (topName) topName.textContent = name;
        if (topTag) topTag.textContent = tag;

        this.loadSchools();
        this.showSection(this.currentSection || "dashboard");
    },

    sectionMeta(name) {
        const meta = {
            dashboard: ["Umumiy dashbord", "Kelajak Markazi Chirchiq"],
            profile: ["Mening profilim", "Portfolio va shaxsiy natijalar"],
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

        const [title, subtitle] = this.sectionMeta(name);
        const titleEl = this.$("page-title");
        const subEl = this.$("page-subtitle");
        if (titleEl) titleEl.textContent = title;
        if (subEl) subEl.textContent = subtitle;
        document.title = `${title} · Kelajak Markazi Chirchiq`;

        this.$("sidebar")?.classList.remove("open");
        this.$("sidebar-overlay")?.classList.remove("open");
        this.$("content-area")?.scrollTo({ top: 0 });

        if (name === "dashboard") this.loadDashboard();
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
        el.classList.toggle("podium-two", top.length === 2);
        el.classList.toggle("podium-one", top.length === 1);
        if (top.length === 0) {
            el.innerHTML = '<div class="card empty-state podium-empty"><i class="fa-solid fa-trophy"></i>Hozircha ishtirokchilar yo\'q</div>';
            return;
        }
        const order = top.length >= 3 ? [top[1], top[0], top[2]] : top;
        el.innerHTML = order.map((u) => {
            const place = u.rank;
            return `
                <div class="podium-card place-${place}">
                    <div class="podium-medal">${place}</div>
                    ${this.avatarMarkup(u, "avatar-lg")}
                    <div class="podium-name">${this.esc(u.full_name || u.username)}</div>
                    <div class="podium-tag">${this.esc(u.tag)}</div>
                    <div class="podium-points">${this.fmtPoints(u.total_points)} <span>ball</span></div>
                </div>
            `;
        }).join("");
    },

    renderLeaderboard(users) {
        const body = this.$("leaderboard-body");
        const cards = this.$("leaderboard-cards");
        if (!body) return;
        if (users.length === 0) {
            body.innerHTML = '<tr><td colspan="7" class="empty-cell">Hozircha ishtirokchilar yo\'q</td></tr>';
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
                    <td>${this.fmtDate(u.created_at)}</td>
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
                            <div><span>Ogohlantirish</span><strong class="warn-pill ${warnClass}">${u.warns_count}</strong></div>
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
            if (nameEl) nameEl.textContent = name;
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
            this.setAvatar(this.$("sidebar-avatar"), this.currentUser);
            this.setAvatar(this.$("topbar-avatar"), this.currentUser);
            this.setAvatar(this.$("profile-avatar"), this.currentUser);
            const bioEl = this.$("profile-bio");
            if (bioEl) bioEl.textContent = this.$("pf-bio")?.value || "Bio hali kiritilmagan.";
            this.renderChips(this.$("profile-ach-chips"), achievements, "Yutuqlar hali kiritilmagan");
            this.renderChips(this.$("profile-int-chips"), interests, "Qiziqishlar hali kiritilmagan");
            const nameEl = this.$("profile-name");
            const topName = this.$("topbar-name");
            const sidebarName = this.$("sidebar-user-name");
            if (nameEl) nameEl.textContent = this.currentUser.full_name;
            if (topName) topName.textContent = this.currentUser.full_name;
            if (sidebarName) sidebarName.textContent = this.currentUser.full_name;
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
                    <td><strong style="color:var(--ink)">${this.esc(item.target_name || item.target_username)}</strong><div class="person-sub">@${this.esc(item.target_username)}</div></td>
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
            setText("admin-stat-warns", warns.length);

            const body = this.$("admin-users-body");
            if (body) {
                if (users.length === 0) {
                    body.innerHTML = '<tr><td colspan="5" class="empty-cell">Ishtirokchilar yo\'q</td></tr>';
                } else {
                    body.innerHTML = users.map((u) => {
                        const self = u.id === this.currentUser.id;
                        const actions = self
                            ? '<span class="person-sub">Siz</span>'
                            : `<div style="display:flex;gap:7px;flex-wrap:wrap;">
                                   <button class="btn btn-primary btn-sm" data-score-id="${u.id}"><i class="fa-solid fa-plus"></i> Ball</button>
                                   <button class="btn btn-ghost btn-sm" data-warn-id="${u.id}"><i class="fa-solid fa-triangle-exclamation"></i> Ogohlantirish</button>
                               </div>`;
                        return `
                            <tr>
                                <td>
                                    <div class="person">
                                        ${this.avatarMarkup(u, "avatar-sm")}
                                        <div><div class="person-name">${this.esc(u.full_name || u.username)}</div><div class="person-sub">@${this.esc(u.username)}</div></div>
                                    </div>
                                </td>
                                <td><span class="role-tag ${u.role === "super_admin" ? "admin" : ""}">${this.esc(u.tag)}</span></td>
                                <td><span class="points ${this.pointsClass(u.total_points)}">${this.fmtPoints(u.total_points)}</span></td>
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
                               <button class="btn btn-ghost btn-sm" data-warn-id="${u.id}"><i class="fa-solid fa-triangle-exclamation"></i> Ogohlantirish</button>`;
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
                                    <div><span>Ogohlantirish</span><strong class="warn-pill ${u.warns_count ? "" : "zero"}">${u.warns_count}</strong></div>
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
                                <strong style="color:var(--ink)">${this.esc(w.target_name || w.target_username)}</strong> — ${this.esc(w.reason)}
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
                                <strong style="color:var(--ink)">${this.esc(item.target_name || item.target_username)}</strong> — ${this.esc(item.reason)}
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
        } catch (err) {
            console.error("[admin]", err);
        }
    },

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
            <p style="font-size:0.86rem;color:var(--muted);line-height:1.6;">
                Bu ogohlantirish butunlay o'chiriladi va foydalanuvchining ogohlantirishlar soni kamayadi. Davom etasizmi?
            </p>
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

    openScoreDeleteModal(score) {
        const html = `
            <div class="modal-user">
                <div class="stat-icon gold"><i class="fa-solid fa-star"></i></div>
                <div>
                    <strong>${this.esc(score.target_name || score.target_username || "Ishtirokchi")}</strong>
                    <span>${this.fmtPoints(score.points)} ball · ${this.esc(score.reason)}</span>
                </div>
            </div>
            <p style="font-size:0.86rem;color:var(--muted);line-height:1.6;">
                Bu ball yozuvi butunlay o'chiriladi va foydalanuvchining umumiy balli shu miqdorga kamayadi. Davom etasizmi?
            </p>
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
                    <button type="button" class="modal-close" data-close><i class="fa-solid fa-xmark"></i></button>
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
