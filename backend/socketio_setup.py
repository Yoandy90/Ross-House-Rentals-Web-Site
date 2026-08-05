"""
socketio_setup.py — Socket.IO server creation and event handlers.
Extracted from server.py for cleaner architecture.
"""

import logging
import socketio


def create_socketio_server(allowed_origins: list):
    """Create and configure the Socket.IO server with event handlers."""

    sio = socketio.AsyncServer(
        async_mode='asgi',
        cors_allowed_origins=allowed_origins,
        logger=True,
        engineio_logger=True,
    )

    # ─── Event Handlers ────────────────────────────────────────

    @sio.event
    async def connect(sid, environ):
        logging.info(f'Client connected: {sid}')

    @sio.event
    async def disconnect(sid):
        logging.info(f'Client disconnected: {sid}')

    @sio.event
    async def join_room(sid, data):
        room_id = data.get('room_id')
        await sio.enter_room(sid, room_id)
        logging.info(f'Client {sid} joined room {room_id}')

    @sio.event
    async def join_user_room(sid, data):
        """Join user-specific room for real-time notifications."""
        user_id = data.get('user_id')
        if user_id:
            room_id = f'user_{user_id}'
            await sio.enter_room(sid, room_id)
            logging.info(f'Client {sid} joined user room {room_id}')
            return {'success': True, 'room': room_id}
        return {'success': False, 'error': 'No user_id provided'}

    @sio.event
    async def send_message(sid, data):
        from models import ChatMessage
        db_ref = sio.environ.get('db')
        message = ChatMessage(**data)
        if db_ref:
            await db_ref.chat_messages.insert_one(message.dict())
        await sio.emit('new_message', message.dict(), room=message.room_id)

    return sio


def create_socket_app(sio, fastapi_app):
    """Wrap the FastAPI app with Socket.IO ASGI app."""
    return socketio.ASGIApp(sio, fastapi_app)
