"""IMAP/SMTP mail protocol adapter."""

from basis.domain.integration.adapters.mail.adapter import MailAdapter
from basis.domain.integration.adapters.mail.credentials import MAIL_CREDENTIAL_READERS

__all__ = ["MailAdapter", "MAIL_CREDENTIAL_READERS"]
