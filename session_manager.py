"""Lightweight session and user tracking for chatbot conversations.

This module provides simple session management using in-memory caching
with TTL expiration. Replaces the heavy Memori dependency (6GB) with
a minimal implementation using cachetools.
"""

from __future__ import annotations

import threading
import time
from collections import defaultdict
from dataclasses import dataclass, field
from typing import ClassVar
from uuid import uuid4

from cachetools import TTLCache


@dataclass
class Session:
    """Represents a conversation session.

    Attributes:
        session_id: Unique identifier for this session.
        user_id: User identifier associated with this session.
        process_id: Process/application identifier.
        created_at: Unix timestamp when session was created.
        last_accessed: Unix timestamp of last access.
    """

    session_id: str
    user_id: str
    process_id: str
    created_at: float = field(default_factory=time.time)
    last_accessed: float = field(default_factory=time.time)

    def touch(self) -> None:
        """Update last accessed timestamp."""
        self.last_accessed = time.time()


class SessionManager:
    """Lightweight session manager for user and conversation tracking.

    Uses TTL cache to automatically expire old sessions. Thread-safe for
    async usage within a single process.

    Attributes:
        DEFAULT_TTL: Default session TTL in seconds (1 hour).
        MAX_SESSIONS: Maximum number of cached sessions.
    """

    DEFAULT_TTL: ClassVar[int] = 3600  # 1 hour
    MAX_SESSIONS: ClassVar[int] = 10000

    def __init__(self, ttl: int = DEFAULT_TTL, max_sessions: int = MAX_SESSIONS):
        """Initialize session manager.

        Args:
            ttl: Session time-to-live in seconds.
            max_sessions: Maximum number of sessions to cache.
        """
        self._sessions: TTLCache[str, Session] = TTLCache(maxsize=max_sessions, ttl=ttl)
        self._user_sessions: dict[str, set[str]] = defaultdict(set)
        self._lock = threading.Lock()
        self._current_user_id: str | None = None
        self._current_session_id: str | None = None
        self._current_process_id: str = "gemini-chatbot"

    def attribution(self, entity_id: str, process_id: str = "gemini-chatbot") -> None:
        """Set the current user attribution.

        Args:
            entity_id: User identifier.
            process_id: Process/application identifier.
        """
        self._current_user_id = entity_id
        self._current_process_id = process_id

    def new_session(self) -> str:
        """Create a new session for the current user.

        Returns:
            The new session ID.

        Raises:
            ValueError: If attribution not set (no current user).
        """
        if not self._current_user_id:
            raise ValueError("Must call attribution() before creating a session")

        session_id = str(uuid4())
        session = Session(
            session_id=session_id,
            user_id=self._current_user_id,
            process_id=self._current_process_id,
        )
        self._sessions[session_id] = session
        self._user_sessions[self._current_user_id].add(session_id)
        self._current_session_id = session_id
        return session_id

    def set_session(self, session_id: str) -> None:
        """Set the current session ID.

        Args:
            session_id: Session identifier to set as current.
        """
        self._current_session_id = session_id
        # Touch the session to update last accessed time
        if session_id in self._sessions:
            self._sessions[session_id].touch()

    def get_session(self, session_id: str) -> Session | None:
        """Get a session by ID.

        Args:
            session_id: Session identifier.

        Returns:
            Session object if found and not expired, None otherwise.
        """
        session: Session | None = self._sessions.get(session_id)
        if session:
            session.touch()
        return session

    @property
    def current_session_id(self) -> str | None:
        """Get the current session ID."""
        return self._current_session_id

    @property
    def current_user_id(self) -> str | None:
        """Get the current user ID."""
        return self._current_user_id

    def get_user_sessions(self, user_id: str) -> list[Session]:
        """Get all active sessions for a user.

        Args:
            user_id: User identifier.

        Returns:
            List of active sessions for the user.
        """
        if user_id not in self._user_sessions:
            return []

        active_sessions = []
        valid_ids = set()

        # Iterate over the user's known session IDs
        for sid in self._user_sessions[user_id]:
            # Check if the session is still active (not expired/evicted)
            session = self._sessions.get(sid)
            if session:
                active_sessions.append(session)
                valid_ids.add(sid)

        # Lazy cleanup: update the index if sessions have expired/evicted
        if not valid_ids:
            del self._user_sessions[user_id]
        elif len(valid_ids) < len(self._user_sessions[user_id]):
            self._user_sessions[user_id] = valid_ids

        return active_sessions

    def clear_user_sessions(self, user_id: str) -> int:
        """Clear all sessions for a user.

        Args:
            user_id: User identifier.

        Returns:
            Number of sessions cleared.
        """
        if user_id not in self._user_sessions:
            return 0

        count = 0
        for sid in self._user_sessions[user_id]:
            if sid in self._sessions:
                del self._sessions[sid]
                count += 1

        del self._user_sessions[user_id]
        return count

    def clear_all(self) -> None:
        """Clear all sessions."""
        self._sessions.clear()
        self._user_sessions.clear()
        self._current_user_id = None
        self._current_session_id = None
