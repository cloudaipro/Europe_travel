"""Email sender — console backend by default; Resend if RESEND_API_KEY is set."""
import logging
import urllib.request
import urllib.error
import json

from .config import settings

log = logging.getLogger("mailer")


def _send_console(to: str, subject: str, body_text: str, body_html: str = "") -> None:
    print(
        "\n──────── EMAIL (console backend) ────────\n"
        f"To:      {to}\n"
        f"From:    {settings.email_from}\n"
        f"Subject: {subject}\n"
        f"{body_text}\n"
        "─────────────────────────────────────────",
        flush=True,
    )


def _send_resend(to: str, subject: str, body_text: str, body_html: str = "") -> None:
    payload = {
        "from": settings.email_from,
        "to": [to],
        "subject": subject,
        "text": body_text,
    }
    if body_html:
        payload["html"] = body_html
    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=json.dumps(payload).encode(),
        headers={
            "Authorization": f"Bearer {settings.resend_api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            resp.read()
    except urllib.error.HTTPError as e:
        log.exception("Resend HTTP error: %s — body: %s", e, e.read().decode("utf-8", "replace"))
        raise
    except Exception:
        log.exception("Resend error")
        raise


def send(to: str, subject: str, body_text: str, body_html: str = "") -> None:
    if settings.resend_api_key:
        _send_resend(to, subject, body_text, body_html)
    else:
        _send_console(to, subject, body_text, body_html)


# ───── Templates ─────

def send_verify_email(to: str, token: str) -> None:
    link = f"{settings.app_url}/?verify={token}"
    text = (
        "Welcome to Tour Companion!\n\n"
        f"Confirm your email by opening this link (valid {settings.verify_token_ttl_hours}h):\n\n"
        f"{link}\n\n"
        "If you didn't sign up, ignore this message."
    )
    send(to, "Confirm your Tour Companion email", text)


def send_reset_email(to: str, token: str) -> None:
    link = f"{settings.app_url}/?reset={token}"
    text = (
        "Tour Companion password reset\n\n"
        f"Open this link to set a new password (valid {settings.reset_token_ttl_minutes} min):\n\n"
        f"{link}\n\n"
        "If you didn't request this, you can safely ignore the message."
    )
    send(to, "Reset your Tour Companion password", text)
