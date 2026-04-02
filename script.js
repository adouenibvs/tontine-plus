const form = document.getElementById("signup-form");
const message = document.getElementById("form-message");

if (form && message) {
    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const endpoint = form.dataset.formspreeEndpoint;
        const data = new FormData(form);
        const nom = (data.get("nom") || "").toString().trim();

        if (!endpoint || endpoint.includes("TON_ID_ICI")) {
            message.textContent = "Ajoute d'abord ton endpoint Formspree dans le fichier index.html pour recevoir les adhesions par e-mail.";
            message.classList.remove("is-success");
            return;
        }

        message.textContent = "Envoi en cours...";
        message.classList.remove("is-success");

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

            message.textContent = `${nom || "Votre inscription"} a bien ete prise en compte. Verifie ton e-mail et ta boite Formspree pour suivre l'adhesion.`;
            message.classList.add("is-success");
            form.reset();
        } catch (error) {
            message.textContent = "L'envoi a echoue. Verifie l'endpoint Formspree et reessaie.";
            message.classList.remove("is-success");
        }
    });
}
