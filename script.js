const form = document.getElementById("signup-form");
const message = document.getElementById("form-message");

if (form && message) {
    form.addEventListener("submit", (event) => {
        event.preventDefault();

        const data = new FormData(form);
        const nom = (data.get("nom") || "").toString().trim();

        message.textContent = `${nom || "Votre inscription"} a bien ete prise en compte. Un conseiller vous contactera pour valider votre adhesion et votre bonus de 300 FR.`;
        message.classList.add("is-success");
        form.reset();
    });
}
