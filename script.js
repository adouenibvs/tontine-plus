const API_BASE = `${window.location.origin}/api`;

const form = document.getElementById("signup-form");
const message = document.getElementById("form-message");
const loginForm = document.getElementById("login-form");
const loginMessage = document.getElementById("login-message");
const registerForm = document.getElementById("register-form");
const registerMessage = document.getElementById("register-message");
const resetForm = document.getElementById("reset-form");
const resetMessage = document.getElementById("reset-message");
const memberName = document.getElementById("member-name");
const memberCity = document.getElementById("member-city");
const memberContact = document.getElementById("member-contact");
const memberBonus = document.getElementById("member-bonus");
const profileForm = document.getElementById("profile-form");
const profileMessage = document.getElementById("profile-message");
const cotisationForm = document.getElementById("cotisation-form");
const cotisationMessage = document.getElementById("cotisation-message");
const cotisationsBody = document.getElementById("cotisations-body");
const toursBody = document.getElementById("tours-body");
const adminName = document.getElementById("admin-name");
const adminStatus = document.getElementById("admin-status");
const adminUsersBody = document.getElementById("admin-users-body");
const adminCotisationsBody = document.getElementById("admin-cotisations-body");
const adminToursBody = document.getElementById("admin-tours-body");
const adminUserCount = document.getElementById("admin-user-count");
const adminCotisationCount = document.getElementById("admin-cotisation-count");
const adminTotalAmount = document.getElementById("admin-total-amount");
const profileNameInput = document.getElementById("profile-name");
const profilePhoneInput = document.getElementById("profile-phone");
const profileCityInput = document.getElementById("profile-city");
const logoutButton = document.getElementById("logout-button");

const TOKEN_KEY = "tontine-plus-token";
let currentUser = null;

function setStatus(element, text, success = false) {
    if (!element) {
        return;
    }

    element.textContent = text;
    element.classList.toggle("is-success", success);
}

function setButtonLoading(formElement, isLoading, loadingText) {
    if (!formElement) {
        return;
    }

    const button = formElement.querySelector('button[type="submit"]');
    if (!button) {
        return;
    }

    if (!button.dataset.defaultText) {
        button.dataset.defaultText = button.textContent || "";
    }

    button.disabled = isLoading;
    button.textContent = isLoading ? loadingText : button.dataset.defaultText;
}

function saveToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
}

function loadToken() {
    return localStorage.getItem(TOKEN_KEY);
}

function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
}

async function apiRequest(path, options = {}) {
    const token = loadToken();
    const headers = new Headers(options.headers || {});

    if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
        headers.set("Content-Type", "application/json");
    }

    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
    });

    if (response.status === 204) {
        return null;
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.detail || "Requete impossible");
    }

    return data;
}

function formatAmount(value) {
    const amount = Number(value || 0);
    return `${amount.toLocaleString("fr-FR")} FR`;
}

function fillTableBody(body, rows, colspan) {
    if (!body) {
        return;
    }

    if (!rows.length) {
        body.innerHTML = `<tr><td colspan="${colspan}">Aucune donnee pour le moment.</td></tr>`;
        return;
    }

    body.innerHTML = rows.join("");
}

async function fetchMe() {
    const token = loadToken();
    if (!token) {
        return null;
    }

    try {
        currentUser = await apiRequest("/me");
        return currentUser;
    } catch (error) {
        clearToken();
        currentUser = null;
        return null;
    }
}

async function loadTours(body) {
    if (!body) {
        return;
    }

    try {
        const tours = await apiRequest("/tours");
        const rows = tours.map((tour) => `
            <tr>
                <td>${tour.tour}</td>
                <td>${tour.beneficiaire}</td>
                <td>${tour.date_prevue}</td>
                <td>${formatAmount(tour.montant)}</td>
                <td>${tour.statut}</td>
            </tr>
        `);
        fillTableBody(body, rows, 5);
    } catch (error) {
        fillTableBody(body, [], 5);
    }
}

if (form && message) {
    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const endpoint = form.dataset.formspreeEndpoint;
        const data = new FormData(form);
        const nom = (data.get("nom") || "").toString().trim();

        if (!endpoint || endpoint.includes("TON_ID_ICI")) {
            setStatus(message, "Ajoute d'abord ton endpoint Formspree dans le fichier index.html pour recevoir les adhesions par e-mail.");
            return;
        }

        setStatus(message, "Envoi en cours...");

        try {
            const response = await fetch(endpoint, {
                method: "POST",
                body: data,
                headers: {
                    Accept: "application/json",
                },
            });

            if (!response.ok) {
                throw new Error("Formulaire non envoye");
            }

            setStatus(message, `${nom || "Votre inscription"} a bien ete prise en compte. Verifie ton e-mail et ta boite Formspree pour suivre l'adhesion.`, true);
            form.reset();
        } catch (error) {
            setStatus(message, "L'envoi a echoue. Verifie l'endpoint Formspree et reessaie.");
        }
    });
}

if (registerForm && registerMessage) {
    registerForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const data = new FormData(registerForm);
        const payload = {
            nom: (data.get("nom") || "").toString().trim(),
            email: (data.get("email") || "").toString().trim(),
            telephone: (data.get("telephone") || "").toString().trim(),
            ville: (data.get("ville") || "").toString().trim(),
            motdepasse: (data.get("motdepasse") || "").toString(),
            confirmation: (data.get("confirmation") || "").toString(),
        };

        if (payload.motdepasse !== payload.confirmation) {
            setStatus(registerMessage, "Les mots de passe ne correspondent pas.");
            return;
        }

        setButtonLoading(registerForm, true, "Creation en cours...");
        setStatus(registerMessage, "Creation du compte en cours. Patiente quelques secondes...");

        try {
            const result = await apiRequest("/register", {
                method: "POST",
                body: JSON.stringify(payload),
            });

            saveToken(result.token);
            setStatus(registerMessage, `${payload.nom}, ton compte a ete cree avec succes.`, true);
            registerForm.reset();
            window.setTimeout(() => {
                window.location.href = "bienvenue.html";
            }, 700);
        } catch (error) {
            setStatus(registerMessage, error.message || "Impossible de creer le compte.");
        } finally {
            setButtonLoading(registerForm, false, "Creation en cours...");
        }
    });
}

if (loginForm && loginMessage) {
    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const data = new FormData(loginForm);
        const payload = {
            email: (data.get("identifiant") || "").toString().trim(),
            motdepasse: (data.get("motdepasse") || "").toString(),
        };

        setButtonLoading(loginForm, true, "Connexion en cours...");
        setStatus(loginMessage, "Connexion a ton espace en cours. Patiente quelques secondes...");

        try {
            const result = await apiRequest("/login", {
                method: "POST",
                body: JSON.stringify(payload),
            });

            saveToken(result.token);
            setStatus(loginMessage, "Connexion reussie.", true);

            window.setTimeout(() => {
                window.location.href = result.user.role === "admin" ? "admin.html" : "espace.html";
            }, 700);
        } catch (error) {
            setStatus(loginMessage, error.message || "Connexion impossible.");
        } finally {
            setButtonLoading(loginForm, false, "Connexion en cours...");
        }
    });
}

if (resetForm && resetMessage) {
    resetForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const data = new FormData(resetForm);
        const payload = {
            email: (data.get("email") || "").toString().trim(),
        };

        setButtonLoading(resetForm, true, "Envoi en cours...");
        setStatus(resetMessage, "Generation du message en cours...");

        try {
            const result = await apiRequest("/password-reset", {
                method: "POST",
                body: JSON.stringify(payload),
            });

            setStatus(resetMessage, result.message, true);
            resetForm.reset();
        } catch (error) {
            setStatus(resetMessage, error.message || "Impossible de traiter la demande.");
        } finally {
            setButtonLoading(resetForm, false, "Envoi en cours...");
        }
    });
}

if (memberName && memberCity && memberContact && memberBonus) {
    (async () => {
        const user = await fetchMe();
        if (!user) {
            window.location.href = "connexion.html";
            return;
        }

        memberName.textContent = user.nom || "membre";
        memberCity.textContent = user.ville || "Ville";
        memberContact.textContent = `${user.email} | ${user.telephone || "Telephone non renseigne"}`;
        memberBonus.textContent = user.bonus || "300 FR";

        if (profileNameInput) {
            profileNameInput.value = user.nom || "";
        }
        if (profilePhoneInput) {
            profilePhoneInput.value = user.telephone || "";
        }
        if (profileCityInput) {
            profileCityInput.value = user.ville || "";
        }

        try {
            const cotisations = await apiRequest("/cotisations");
            const rows = cotisations.map((item) => `
                <tr>
                    <td>${formatAmount(item.montant)}</td>
                    <td>${item.date_cotisation}</td>
                    <td>${item.statut}</td>
                </tr>
            `);
            fillTableBody(cotisationsBody, rows, 3);
        } catch (error) {
            fillTableBody(cotisationsBody, [], 3);
        }

        await loadTours(toursBody);
    })();
}

if (profileForm && profileMessage) {
    profileForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const data = new FormData(profileForm);
        const payload = {
            nom: (data.get("nom") || "").toString().trim(),
            telephone: (data.get("telephone") || "").toString().trim(),
            ville: (data.get("ville") || "").toString().trim(),
        };

        setButtonLoading(profileForm, true, "Enregistrement...");
        setStatus(profileMessage, "Mise a jour du profil en cours...");

        try {
            const user = await apiRequest("/profile", {
                method: "PUT",
                body: JSON.stringify(payload),
            });

            currentUser = user;
            memberName.textContent = user.nom;
            memberCity.textContent = user.ville;
            memberContact.textContent = `${user.email} | ${user.telephone}`;
            setStatus(profileMessage, "Profil mis a jour avec succes.", true);
        } catch (error) {
            setStatus(profileMessage, error.message || "Impossible de mettre le profil a jour.");
        } finally {
            setButtonLoading(profileForm, false, "Enregistrement...");
        }
    });
}

if (cotisationForm && cotisationMessage) {
    cotisationForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const data = new FormData(cotisationForm);
        const payload = {
            montant: Number((data.get("montant") || "0").toString()),
            date_cotisation: (data.get("dateCotisation") || "").toString(),
            statut: (data.get("statut") || "").toString(),
        };

        setButtonLoading(cotisationForm, true, "Ajout en cours...");
        setStatus(cotisationMessage, "Enregistrement de la cotisation en cours...");

        try {
            await apiRequest("/cotisations", {
                method: "POST",
                body: JSON.stringify(payload),
            });

            setStatus(cotisationMessage, "Cotisation ajoutee avec succes.", true);
            cotisationForm.reset();

            const cotisations = await apiRequest("/cotisations");
            const rows = cotisations.map((item) => `
                <tr>
                    <td>${formatAmount(item.montant)}</td>
                    <td>${item.date_cotisation}</td>
                    <td>${item.statut}</td>
                </tr>
            `);
            fillTableBody(cotisationsBody, rows, 3);
        } catch (error) {
            setStatus(cotisationMessage, error.message || "Impossible d'ajouter la cotisation.");
        } finally {
            setButtonLoading(cotisationForm, false, "Ajout en cours...");
        }
    });
}

if (adminName && adminStatus && adminUsersBody && adminCotisationsBody) {
    (async () => {
        const user = await fetchMe();
        if (!user) {
            window.location.href = "connexion.html";
            return;
        }

        if (user.role !== "admin") {
            adminStatus.textContent = "Acces refuse. Connecte-toi avec un compte administrateur.";
            fillTableBody(adminUsersBody, [], 4);
            fillTableBody(adminCotisationsBody, [], 4);
            fillTableBody(adminToursBody, [], 5);
            return;
        }

        adminName.textContent = user.nom || user.email || "Admin";

        try {
            const dashboard = await apiRequest("/admin/dashboard");
            adminUserCount.textContent = `${dashboard.users.length}`;
            adminCotisationCount.textContent = `${dashboard.cotisations.length}`;
            adminTotalAmount.textContent = formatAmount(dashboard.total_cotisations);
            adminStatus.textContent = "Les donnees admin ont bien ete chargees.";

            const userRows = dashboard.users.map((item) => `
                <tr>
                    <td>${item.nom}</td>
                    <td>${item.email}</td>
                    <td>${item.telephone || "-"}</td>
                    <td>${item.ville || "-"}</td>
                </tr>
            `);
            fillTableBody(adminUsersBody, userRows, 4);

            const cotisationRows = dashboard.cotisations.map((item) => `
                <tr>
                    <td>${item.nom}</td>
                    <td>${formatAmount(item.montant)}</td>
                    <td>${item.date_cotisation}</td>
                    <td>${item.statut}</td>
                </tr>
            `);
            fillTableBody(adminCotisationsBody, cotisationRows, 4);

            const tourRows = dashboard.tours.map((tour) => `
                <tr>
                    <td>${tour.tour}</td>
                    <td>${tour.beneficiaire}</td>
                    <td>${tour.date_prevue}</td>
                    <td>${formatAmount(tour.montant)}</td>
                    <td>${tour.statut}</td>
                </tr>
            `);
            fillTableBody(adminToursBody, tourRows, 5);
        } catch (error) {
            adminStatus.textContent = error.message || "Impossible de charger les donnees admin.";
            fillTableBody(adminUsersBody, [], 4);
            fillTableBody(adminCotisationsBody, [], 4);
            fillTableBody(adminToursBody, [], 5);
        }
    })();
}

if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
        try {
            await apiRequest("/logout", { method: "POST" });
        } catch (error) {
            // local cleanup still matters if server session was already invalidated
        }

        clearToken();
        currentUser = null;
        window.location.href = "connexion.html";
    });
}
