# Tontine Plus

Ce projet utilise maintenant un vrai backend `FastAPI` avec une base `SQLite`.

## Installation

```powershell
cd "C:\Users\abvs\Documents\New project"
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Lancer le serveur

```powershell
uvicorn app:app --reload
```

Puis ouvre :

```text
http://127.0.0.1:8000
```

## Comptes

Le projet cree automatiquement un compte admin local au premier lancement :

- e-mail : `admin@tontineplus.local`
- mot de passe : `admin12345`

Tu peux changer ces valeurs avant le lancement :

```powershell
$env:TONTINE_ADMIN_EMAIL="tonadmin@email.com"
$env:TONTINE_ADMIN_PASSWORD="motdepassefort"
$env:TONTINE_ADMIN_NAME="Ton Nom Admin"
uvicorn app:app --reload
```

## Fonctions

- inscription utilisateur
- connexion utilisateur/admin
- mise a jour du profil
- ajout de cotisations
- tableau admin
- tours de tontine

Le formulaire d'adhesion public continue d'utiliser Formspree.
