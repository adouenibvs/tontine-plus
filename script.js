import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import {
    createUserWithEmailAndPassword,
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
    updateProfile,
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import {
    doc,
    getDoc,
    getFirestore,
    serverTimestamp,
    setDoc,
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const form = document.getElementById("signup-form");
const message = document.getElementById("form-message");
const loginForm = document.getElementById("login-form");
const loginMessage = document.getElementById("login-message");
const registerForm = document.getElementById("register-form");
const registerMessage = document.getElementById("register-message");
const memberName = document.getElementById("member-name");
const memberCity = document.getElementById("member-city");
const memberContact = document.getElementById("member-contact");
const memberBonus = document.getElementById("member-bonus");
const logoutButton = document.getElementById("logout-button");

function firebaseConfigured() {
    return !Object.values(firebaseConfig).some((value) => value.startsWith("REMPLACE_"));
}

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

async function loadMemberProfile(uid) {
    const snapshot = await getDoc(doc(db, "users", uid));
    return snapshot.exists() ? snapshot.data() : null;
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

        if (!firebaseConfigured()) {
            setStatus(registerMessage, "Complete d'abord le fichier firebase-config.js avec les informations de ton projet Firebase.");
            return;
        }

        const data = new FormData(registerForm);
        const nom = (data.get("nom") || "").toString().trim();
        const email = (data.get("email") || "").toString().trim();
        const telephone = (data.get("telephone") || "").toString().trim();
        const ville = (data.get("ville") || "").toString().trim();
        const motdepasse = (data.get("motdepasse") || "").toString();
        const confirmation = (data.get("confirmation") || "").toString();

        if (motdepasse !== confirmation) {
            setStatus(registerMessage, "Les mots de passe ne correspondent pas.");
            return;
        }

        setButtonLoading(registerForm, true, "Creation en cours...");
        setStatus(registerMessage, "Creation du compte en ligne en cours. Patiente quelques secondes...");

        try {
            const credentials = await createUserWithEmailAndPassword(auth, email, motdepasse);
            const { user } = credentials;

            await updateProfile(user, {
                displayName: nom,
            });

            await setDoc(doc(db, "users", user.uid), {
                nom,
                email,
                telephone,
                ville,
                bonus: "300 FR",
                createdAt: serverTimestamp(),
            });

            setStatus(registerMessage, `${nom}, ton compte a ete cree avec succes.`, true);
            registerForm.reset();
            window.setTimeout(() => {
                window.location.href = "bienvenue.html";
            }, 700);
        } catch (error) {
            setStatus(registerMessage, "Impossible de creer le compte. Verifie l'e-mail, le mot de passe ou la configuration Firebase.");
        } finally {
            setButtonLoading(registerForm, false, "Creation en cours...");
        }
    });
}

if (loginForm && loginMessage) {
    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (!firebaseConfigured()) {
            setStatus(loginMessage, "Complete d'abord le fichier firebase-config.js avec les informations de ton projet Firebase.");
            return;
        }

        const data = new FormData(loginForm);
        const identifiant = (data.get("identifiant") || "").toString().trim();
        const motdepasse = (data.get("motdepasse") || "").toString();

        setButtonLoading(loginForm, true, "Connexion en cours...");
        setStatus(loginMessage, "Connexion a ton espace en cours. Patiente quelques secondes...");

        try {
            await signInWithEmailAndPassword(auth, identifiant, motdepasse);
            setStatus(loginMessage, "Connexion reussie.", true);

            window.setTimeout(() => {
                window.location.href = "espace.html";
            }, 700);
        } catch (error) {
            setStatus(loginMessage, "Connexion impossible. Verifie ton e-mail, ton mot de passe et la configuration Firebase.");
        } finally {
            setButtonLoading(loginForm, false, "Connexion en cours...");
        }
    });
}

if (memberName && memberCity && memberContact && memberBonus) {
    onAuthStateChanged(auth, async (user) => {
        if (!firebaseConfigured()) {
            memberName.textContent = "configuration requise";
            memberCity.textContent = "Firebase";
            memberContact.textContent = "Complete le fichier firebase-config.js pour activer l'espace membre.";
            return;
        }

        if (!user) {
            window.location.href = "connexion.html";
            return;
        }

        try {
            const profile = await loadMemberProfile(user.uid);

            memberName.textContent = profile?.nom || user.displayName || "membre";
            memberCity.textContent = profile?.ville || "Ville";
            memberContact.textContent = `${profile?.email || user.email || ""} | ${profile?.telephone || "Telephone non renseigne"}`;
            memberBonus.textContent = profile?.bonus || "300 FR";
        } catch (error) {
            memberContact.textContent = "Impossible de charger le profil membre.";
        }
    });
}

if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
        await signOut(auth);
        window.location.href = "connexion.html";
    });
}
