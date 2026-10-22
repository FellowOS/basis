"""IMAP/SMTP mail protocol adapter."""

from basis.domain.connector.adapters.mail.adapter import MailAdapter
from basis.domain.connector.adapters.mail.credentials import MAIL_CREDENTIAL_READERS

__all__ = ["MailAdapter", "MAIL_CREDENTIAL_READERS"]
