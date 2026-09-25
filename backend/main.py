import asyncio
import json
import random
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List
import sheets

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ConnectionManager:
    def __init__(self):
        # room_id -> list of active websockets
        self.rooms: Dict[str, List[WebSocket]] = {}
        # room_id -> set of active usernames
        self.active_users: Dict[str, set] = {}

    def get_unique_username(self, room_id: str, username: str) -> str:
        if room_id not in self.active_users:
            self.active_users[room_id] = set()

        final_name = username
        counter = 1
        # Agar naam already active hai, toh unique number attach karein
        while final_name in self.active_users[room_id]:
            final_name = f"{username}_{counter}"
            counter += 1
        
        self.active_users[room_id].add(final_name)
        return final_name

    async def connect(self, room_id: str, websocket: WebSocket):
        await websocket.accept()
        if room_id not in self.rooms:
            self.rooms[room_id] = []
        self.rooms[room_id].append(websocket)

    def disconnect(self, room_id: str, websocket: WebSocket, username: str):
        if room_id in self.rooms and websocket in self.rooms[room_id]:
            self.rooms[room_id].remove(websocket)
            if not self.rooms[room_id]:
                del self.rooms[room_id]

        if room_id in self.active_users and username in self.active_users[room_id]:
            self.active_users[room_id].remove(username)
            if not self.active_users[room_id]:
                del self.active_users[room_id]

    async def broadcast(self, room_id: str, message: dict):
        if room_id in self.rooms:
            for connection in self.rooms[room_id]:
                await connection.send_json(message)

manager = ConnectionManager()

@app.get("/history/{room_id}")
def get_history(room_id: str):
    return sheets.get_recent_messages(room_id)

@app.websocket("/ws/{room_id}/{username}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, username: str):
    # Unique username decide karein
    assigned_name = manager.get_unique_username(room_id, username)
    await manager.connect(room_id, websocket)

    # User ko batayein ki uska assigned name kya hai
    await websocket.send_json({
        "type": "NAME_ASSIGNED",
        "username": assigned_name,
        "is_changed": (assigned_name != username)
    })

    # Sabhi ko inform karein naye user ke join hone par
    await manager.broadcast(room_id, {
        "user": "System",
        "text": f"{assigned_name} joined the room.",
        "senderId": "system"
    })

    try:
        while True:
            raw_data = await websocket.receive_text()
            data = json.loads(raw_data)
            msg_type = data.get("type", "message")

            # 1. Typing Indicator event
            if msg_type == "typing":
                await manager.broadcast(room_id, {
                    "type": "typing",
                    "user": assigned_name,
                    "is_typing": data.get("is_typing", False),
                    "senderId": data.get("senderId", "")
                })

            # 2. Normal Chat message
            elif msg_type == "message":
                message_text = data.get("text", "")
                sender_id = data.get("senderId", "")

                await manager.broadcast(room_id, {
                    "type": "message",
                    "user": assigned_name,
                    "text": message_text,
                    "senderId": sender_id
                })

                # Google Sheet me save karein
                asyncio.create_task(
                    asyncio.to_thread(sheets.save_message, room_id, assigned_name, message_text)
                )

    except WebSocketDisconnect:
        manager.disconnect(room_id, websocket, assigned_name)
        await manager.broadcast(room_id, {
            "user": "System",
            "text": f"{assigned_name} left the room.",
            "senderId": "system"
        })