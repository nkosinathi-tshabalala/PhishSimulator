# How an email address is shown on screen, in exports and in messages. The demo's test players all
# use plus-aliases of the owner's inbox (DEMO_EMAIL), so the owner's own address is hidden there.

from flask import current_app

HIDDEN = "•••"


def shown_email(address):
    """The address to display. A plus-alias of DEMO_EMAIL keeps only its alias
    (owner+zanele.mashaba@gmail.com -> •••+zanele.mashaba@gmail.com); every other address, including
    DEMO_EMAIL itself, is shown as it is. Only for display: sending and signing in use the real address."""
    address = address or ""
    base = current_app.config.get("DEMO_EMAIL") or ""
    if "@" not in base or "@" not in address:
        return address
    mailbox, domain = base.split("@", 1)
    owner = f"{mailbox.split('+', 1)[0]}+"
    local, address_domain = address.rsplit("@", 1)
    if address_domain.lower() == domain.lower() and local.lower().startswith(owner) and len(local) > len(owner):
        return f"{HIDDEN}+{local[len(owner):]}@{address_domain}"
    return address
