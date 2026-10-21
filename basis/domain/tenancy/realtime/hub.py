"""Per-workspace WebSocket fan-out for graph projection events."""

from __future__ import annotations

import asyncio
import logging
from collections import defaultdict
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class GraphWsHub:
    def __init__(self) -> None:
        self._rooms: dict[str, set[WebSocket]] = defaultdict(set)
        self._socket_users: dict[WebSocket, tuple[str, str]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, workspace_id: str, websocket: WebSocket, user_id: str) -> None:
        await websocket.accept()
        async with self._lock:
            self._rooms[workspace_id].add(websocket)
            self._socket_users[websocket] = (workspace_id, user_id)

    async def disconnect(self, workspace_id: str, websocket: WebSocket) -> None:
        async with self._lock:
            self._socket_users.pop(websocket, None)
            room = self._rooms.get(workspace_id)
            if room and websocket in room:
                room.discard(websocket)
            if room is not None and not room:
                self._rooms.pop(workspace_id, None)

    async def _revoke_sockets(
        self,
        targets: list[tuple[WebSocket, str]],
        message: dict[str, Any],
    ) -> int:
        closed = 0
        for socket, kid in targets:
            try:
                await socket.send_json(message)
                await socket.close(code=4403)
            except Exception:
                logger.debug("ws revoke close failed", exc_info=True)
            await self.disconnect(kid, socket)
            closed += 1
        return closed

    async def disconnect_user_from_workspace(self, workspace_id: str, user_id: str) -> int:
        message = {"type": "access_revoked", "workspace_id": workspace_id}
        async with self._lock:
            targets = [
                (socket, kid)
                for socket, (kid, uid) in self._socket_users.items()
                if kid == workspace_id and uid == user_id
            ]
        return await self._revoke_sockets(targets, message)

    async def disconnect_user(self, user_id: str, *, reason: str = "user_deactivated") -> int:
        message = {"type": "access_revoked", "reason": reason}
        async with self._lock:
            targets = [
                (socket, kid)
                for socket, (kid, uid) in self._socket_users.items()
                if uid == user_id
            ]
        return await self._revoke_sockets(targets, message)

    def try_disconnect_user_from_workspace(self, workspace_id: str, user_id: str) -> None:
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            return
        loop.create_task(self.disconnect_user_from_workspace(workspace_id, user_id))

    def try_disconnect_user(self, user_id: str, *, reason: str = "user_deactivated") -> None:
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            return
        loop.create_task(self.disconnect_user(user_id, reason=reason))

    async def broadcast(self, workspace_id: str, message: dict[str, Any]) -> None:
        async with self._lock:
            sockets = list(self._rooms.get(workspace_id, set()))
        for socket in sockets:
            try:
                await socket.send_json(message)
            except Exception:
                logger.debug("ws send failed", exc_info=True)
                await self.disconnect(workspace_id, socket)

    def try_broadcast(self, workspace_id: str, message: dict[str, Any]) -> None:
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            return
        loop.create_task(self.broadcast(workspace_id, message))
