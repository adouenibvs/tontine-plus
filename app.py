from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr, Field


BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "tontine.db"
ADMIN_EMAIL = os.getenv("TONTINE_ADMIN_EMAIL", "admin@tontineplus.local")
ADMIN_PASSWORD = os.getenv("TONTINE_ADMIN_PASSWORD", "admin12345")
ADMIN_NAME = os.getenv("TONTINE_ADMIN_NAME", "Administrateur Tontine Plus")


app = FastAPI(title="Tontine Plus API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def dict_factory(cursor: sqlite3.Cursor, row: sqlite3.Row) -> dict:
    return {column[0]: row[index] for index, column in enumerate(cursor.description)}


@contextmanager
def get_db() -> Iterator[sqlite3.Connection]:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = dict_factory
    try:
        yield connection
        connection.commit()
    finally:
        connection.close()


def hash_password(password: str, salt: str | None = None) -> tuple[str, str]:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 120000)
    return salt, digest.hex()


def verify_password(password: str, salt: str, hashed: str) -> bool:
    _, candidate = hash_password(password, salt)
    return hmac.compare_digest(candidate, hashed)


def create_token() -> str:
    return secrets.token_urlsafe(32)


def create_tables() -> None:
    with get_db() as db:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nom TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                telephone TEXT DEFAULT '',
                ville TEXT DEFAULT '',
                password_salt TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user',
                bonus TEXT NOT NULL DEFAULT '300 FR',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS cotisations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                montant REAL NOT NULL,
                date_cotisation TEXT NOT NULL,
                statut TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )


def ensure_admin_account() -> None:
    with get_db() as db:
        existing = db.execute("SELECT id FROM users WHERE email = ?", (ADMIN_EMAIL,)).fetchone()
        if existing:
            return

        salt, hashed = hash_password(ADMIN_PASSWORD)
        db.execute(
            """
            INSERT INTO users (nom, email, telephone, ville, password_salt, password_hash, role, bonus)
            VALUES (?, ?, '', 'Siege admin', ?, ?, 'admin', '300 FR')
            """,
            (ADMIN_NAME, ADMIN_EMAIL, salt, hashed),
        )


def sanitize_user(user: dict) -> dict:
    return {
        "id": user["id"],
        "nom": user["nom"],
        "email": user["email"],
        "telephone": user["telephone"],
        "ville": user["ville"],
        "role": user["role"],
        "bonus": user["bonus"],
    }


def get_user_by_token(token: str) -> dict:
    with get_db() as db:
        row = db.execute(
            """
            SELECT users.*
            FROM sessions
            JOIN users ON users.id = sessions.user_id
            WHERE sessions.token = ?
            """,
            (token,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session invalide")
        return row


def get_current_user(authorization: str | None = Header(default=None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentification requise")
    token = authorization.split(" ", 1)[1].strip()
    return get_user_by_token(token)


def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user["role"] != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acces admin requis")
    return user


class RegisterPayload(BaseModel):
    nom: str = Field(min_length=2)
    email: EmailStr
    telephone: str = ""
    ville: str = ""
    motdepasse: str = Field(min_length=6)
    confirmation: str = Field(min_length=6)


class LoginPayload(BaseModel):
    email: EmailStr
    motdepasse: str = Field(min_length=6)


class ProfilePayload(BaseModel):
    nom: str = Field(min_length=2)
    telephone: str = ""
    ville: str = ""


class CotisationPayload(BaseModel):
    montant: float = Field(gt=0)
    date_cotisation: str
    statut: str


class ResetPayload(BaseModel):
    email: EmailStr


@app.on_event("startup")
def startup() -> None:
    create_tables()
    ensure_admin_account()


@app.post("/api/register")
def register(payload: RegisterPayload) -> dict:
    if payload.motdepasse != payload.confirmation:
        raise HTTPException(status_code=400, detail="Les mots de passe ne correspondent pas")

    with get_db() as db:
        exists = db.execute("SELECT id FROM users WHERE email = ?", (payload.email,)).fetchone()
        if exists:
            raise HTTPException(status_code=400, detail="Un compte existe deja avec cet e-mail")

        salt, hashed = hash_password(payload.motdepasse)
        cursor = db.execute(
            """
            INSERT INTO users (nom, email, telephone, ville, password_salt, password_hash, role, bonus)
            VALUES (?, ?, ?, ?, ?, ?, 'user', '300 FR')
            """,
            (payload.nom, payload.email, payload.telephone, payload.ville, salt, hashed),
        )
        user_id = cursor.lastrowid
        token = create_token()
        db.execute("INSERT INTO sessions (token, user_id) VALUES (?, ?)", (token, user_id))
        user = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()

    return {"token": token, "user": sanitize_user(user)}


@app.post("/api/login")
def login(payload: LoginPayload) -> dict:
    with get_db() as db:
        user = db.execute("SELECT * FROM users WHERE email = ?", (payload.email,)).fetchone()
        if not user or not verify_password(payload.motdepasse, user["password_salt"], user["password_hash"]):
            raise HTTPException(status_code=401, detail="E-mail ou mot de passe incorrect")

        token = create_token()
        db.execute("INSERT INTO sessions (token, user_id) VALUES (?, ?)", (token, user["id"]))

    return {"token": token, "user": sanitize_user(user)}


@app.post("/api/logout", status_code=204)
def logout(authorization: str | None = Header(default=None)) -> None:
    if not authorization or not authorization.startswith("Bearer "):
        return
    token = authorization.split(" ", 1)[1].strip()
    with get_db() as db:
        db.execute("DELETE FROM sessions WHERE token = ?", (token,))


@app.get("/api/me")
def me(user: dict = Depends(get_current_user)) -> dict:
    return sanitize_user(user)


@app.put("/api/profile")
def update_profile(payload: ProfilePayload, user: dict = Depends(get_current_user)) -> dict:
    with get_db() as db:
        db.execute(
            "UPDATE users SET nom = ?, telephone = ?, ville = ? WHERE id = ?",
            (payload.nom, payload.telephone, payload.ville, user["id"]),
        )
        updated = db.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
    return sanitize_user(updated)


@app.get("/api/cotisations")
def list_cotisations(user: dict = Depends(get_current_user)) -> list[dict]:
    with get_db() as db:
        rows = db.execute(
            """
            SELECT montant, date_cotisation, statut, created_at
            FROM cotisations
            WHERE user_id = ?
            ORDER BY created_at DESC
            """,
            (user["id"],),
        ).fetchall()
    return rows


@app.post("/api/cotisations")
def add_cotisation(payload: CotisationPayload, user: dict = Depends(get_current_user)) -> dict:
    with get_db() as db:
        cursor = db.execute(
            """
            INSERT INTO cotisations (user_id, montant, date_cotisation, statut)
            VALUES (?, ?, ?, ?)
            """,
            (user["id"], payload.montant, payload.date_cotisation, payload.statut),
        )
        row = db.execute("SELECT * FROM cotisations WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return row


@app.post("/api/password-reset")
def password_reset(payload: ResetPayload) -> dict:
    with get_db() as db:
        user = db.execute("SELECT id FROM users WHERE email = ?", (payload.email,)).fetchone()
    if not user:
        raise HTTPException(status_code=404, detail="Aucun compte ne correspond a cet e-mail")
    return {"message": "Demande enregistree. Pour ce prototype, contacte l'administrateur pour reinitialiser le mot de passe."}


def build_tours() -> list[dict]:
    return [
        {"tour": 1, "beneficiaire": "Awa Traore", "date_prevue": "2026-04-10", "montant": 10000, "statut": "En cours"},
        {"tour": 2, "beneficiaire": "Kone Idriss", "date_prevue": "2026-04-17", "montant": 10000, "statut": "En attente"},
        {"tour": 3, "beneficiaire": "Mariam Coulibaly", "date_prevue": "2026-04-24", "montant": 10000, "statut": "Planifie"},
        {"tour": 4, "beneficiaire": "Fatou Sissoko", "date_prevue": "2026-05-01", "montant": 10000, "statut": "Planifie"},
    ]


@app.get("/api/tours")
def tours(user: dict = Depends(get_current_user)) -> list[dict]:
    _ = user
    return build_tours()


@app.get("/api/admin/dashboard")
def admin_dashboard(user: dict = Depends(require_admin)) -> dict:
    _ = user
    with get_db() as db:
        users = db.execute(
            "SELECT id, nom, email, telephone, ville, role, bonus FROM users ORDER BY created_at DESC"
        ).fetchall()
        cotisations = db.execute(
            """
            SELECT users.nom, users.email, cotisations.montant, cotisations.date_cotisation, cotisations.statut
            FROM cotisations
            JOIN users ON users.id = cotisations.user_id
            ORDER BY cotisations.created_at DESC
            """
        ).fetchall()

    total_cotisations = sum(float(item["montant"]) for item in cotisations)
    return {
        "users": users,
        "cotisations": cotisations,
        "tours": build_tours(),
        "total_cotisations": total_cotisations,
    }


for page in [
    "index.html",
    "inscription.html",
    "connexion.html",
    "motdepasse.html",
    "bienvenue.html",
    "espace.html",
    "admin.html",
]:
    route = "/" if page == "index.html" else f"/{page}"

    @app.get(route, include_in_schema=False)
    def serve_page(page_name: str = page) -> FileResponse:
        return FileResponse(BASE_DIR / page_name)


app.mount("/", StaticFiles(directory=BASE_DIR), name="static")
