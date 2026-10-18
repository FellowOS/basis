import asyncio

from basis.platform.realtime.hub import GraphWsHub


class _FakeWebSocket:
    def __init__(self) -> None:
        self.accepted = False
        self.sent: list[dict] = []
        self.closed = False
        self.close_code: int | None = None

    async def accept(self) -> None:
        self.accepted = True

    async def send_json(self, data: dict) -> None:
        self.sent.append(data)

    async def close(self, code: int = 1000) -> None:
        self.closed = True
        self.close_code = code


def test_disconnect_user_from_kb_closes_matching_sockets() -> None:
    async def run() -> None:
        hub = GraphWsHub()
        socket = _FakeWebSocket()
        await hub.connect("kb-1", socket, "user-a")
        other = _FakeWebSocket()
        await hub.connect("kb-1", other, "user-b")

        closed = await hub.disconnect_user_from_kb("kb-1", "user-a")
        assert closed == 1
        assert socket.sent[-1]["type"] == "access_revoked"
        assert socket.close_code == 4403
        assert other.closed is False

    asyncio.run(run())


def test_disconnect_user_closes_all_kb_sockets() -> None:
    async def run() -> None:
        hub = GraphWsHub()
        a = _FakeWebSocket()
        b = _FakeWebSocket()
        await hub.connect("kb-a", a, "user-x")
        await hub.connect("kb-b", b, "user-x")

        closed = await hub.disconnect_user("user-x")
        assert closed == 2
        assert a.close_code == 4403
        assert b.close_code == 4403

    asyncio.run(run())


def test_broadcast_only_reaches_target_kb_room() -> None:
    async def run() -> None:
        hub = GraphWsHub()
        a = _FakeWebSocket()
        b = _FakeWebSocket()
        await hub.connect("kb-a", a, "user-1")
        await hub.connect("kb-b", b, "user-1")

        await hub.broadcast(
            "kb-a",
            {"type": "projection_updated", "kb_id": "kb-a", "projection_revision": 3},
        )

        assert len(a.sent) == 1
        assert a.sent[0]["kb_id"] == "kb-a"
        assert b.sent == []

    asyncio.run(run())
