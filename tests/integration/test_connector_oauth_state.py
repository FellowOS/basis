"""OAuth state helpers for end_user connector flows."""

from basis.domain.connector.connector_oauth_state import (
    pack_connector_oauth_state,
    unpack_connector_oauth_state,
)


def test_pack_unpack_roundtrip() -> None:
    state = pack_connector_oauth_state("github", "user-42")
    parsed = unpack_connector_oauth_state(state)
    assert parsed == {"service": "github", "subject_id": "user-42"}
