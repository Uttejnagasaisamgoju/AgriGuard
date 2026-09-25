"""
WebSocket manager for real-time notifications and officer dashboard updates.
"""
import json
import logging
from typing import Dict, List, Set
from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        # user_id -> list of WebSocket connections
        self._connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        if user_id not in self._connections:
            self._connections[user_id] = []
        self._connections[user_id].append(websocket)
        logger.info(f"WebSocket connected: user {user_id}")

    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self._connections:
            try:
                self._connections[user_id].remove(websocket)
            except ValueError:
                pass
            if not self._connections[user_id]:
                del self._connections[user_id]
        logger.info(f"WebSocket disconnected: user {user_id}")

    async def send_to_user(self, user_id: str, message: dict):
        """Send a message to all connections of a specific user"""
        if user_id in self._connections:
            dead_connections = []
            for ws in self._connections[user_id]:
                try:
                    await ws.send_json(message)
                except Exception:
                    dead_connections.append(ws)
            for ws in dead_connections:
                try:
                    self._connections[user_id].remove(ws)
                except ValueError:
                    pass

    async def broadcast_to_role(self, role: str, message: dict, db_session=None):
        """Broadcast to all connected users with a given role"""
        # For simplicity, broadcast to all connections
        # In production, maintain role->user_id mapping
        for user_id, connections in list(self._connections.items()):
            for ws in connections:
                try:
                    await ws.send_json(message)
                except Exception:
                    pass

    def get_connected_users(self) -> List[str]:
        return list(self._connections.keys())

    @property
    def total_connections(self) -> int:
        return sum(len(c) for c in self._connections.values())


# Global instance
manager = ConnectionManager()
