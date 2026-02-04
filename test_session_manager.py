"""Tests for the SessionManager class."""

import time

from session_manager import SessionManager


def test_session_creation():
    """Test creating a new session and verifying its attributes."""
    sm = SessionManager()
    sm.attribution("user1")
    session_id = sm.new_session()

    assert session_id is not None
    assert sm.get_session(session_id) is not None
    assert sm.current_session_id == session_id
    assert sm.current_user_id == "user1"


def test_get_user_sessions():
    """Test retrieving all sessions for a specific user."""
    sm = SessionManager()
    sm.attribution("user1")
    s1 = sm.new_session()
    s2 = sm.new_session()

    sm.attribution("user2")
    s3 = sm.new_session()

    sessions1 = sm.get_user_sessions("user1")
    assert len(sessions1) == 2
    assert {s.session_id for s in sessions1} == {s1, s2}

    sessions2 = sm.get_user_sessions("user2")
    assert len(sessions2) == 1
    assert sessions2[0].session_id == s3


def test_clear_user_sessions():
    """Test clearing all sessions for a specific user."""
    sm = SessionManager()
    sm.attribution("user1")
    sm.new_session()
    sm.new_session()

    assert len(sm.get_user_sessions("user1")) == 2

    count = sm.clear_user_sessions("user1")
    assert count == 2
    assert len(sm.get_user_sessions("user1")) == 0


def test_expiration_cleanup():
    """Test that expired sessions are cleaned up."""
    # Use a short TTL for testing
    sm = SessionManager(ttl=0.1)
    sm.attribution("user1")
    s1 = sm.new_session()

    assert sm.get_session(s1) is not None

    time.sleep(0.2)

    # Session should be gone from main cache
    assert sm.get_session(s1) is None

    # Session should also be cleaned up from user list upon access
    sessions = sm.get_user_sessions("user1")
    assert len(sessions) == 0


def test_clear_all():
    """Test clearing all sessions and state."""
    sm = SessionManager()
    sm.attribution("user1")
    sm.new_session()
    sm.clear_all()

    assert len(sm.get_user_sessions("user1")) == 0
    assert sm.current_user_id is None
    assert sm.current_session_id is None


def test_lazy_cleanup_logic():
    """Test the lazy cleanup mechanism during session retrieval."""
    # Manually simulate a scenario where index has stale ID
    # We rely on expiration to simulate staleness
    sm = SessionManager(ttl=0.1)
    sm.attribution("user1")
    sm.new_session()

    time.sleep(0.2)

    # Should return empty list (implicit boolean check)
    assert not sm.get_user_sessions("user1")

    # If we add a new session now
    s2 = sm.new_session()
    sessions = sm.get_user_sessions("user1")
    assert len(sessions) == 1
    assert sessions[0].session_id == s2
