import sys
import time
import unittest
from unittest.mock import AsyncMock, MagicMock, Mock, patch

# Mock aiosqlite as it's not installed in this environment
mock_aiosqlite = MagicMock()
sys.modules["aiosqlite"] = mock_aiosqlite

# Mock rookiepy
mock_rookiepy = MagicMock()
sys.modules["rookiepy"] = mock_rookiepy

from cookie_manager import CookieManager  # noqa: E402


class AsyncContextManagerMock:
    """Helper to mock async context managers."""

    def __init__(self, return_value):
        self.return_value = return_value

    async def __aenter__(self):
        return self.return_value

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass


class TestCookieManager(unittest.TestCase):
    def setUp(self):
        self.manager = CookieManager()

    def create_mock_cookie(self, name, value="v", domain=".google.com"):
        c = Mock()
        c.name = name
        c.value = value
        c.domain = domain
        c.path = "/"
        c.expires = None
        c.secure = True
        c.rest = {"HttpOnly": ""}
        return c

    @patch("cookie_manager.rookiepy")
    def test_extract_cookies_all_browsers(self, mock_rp):
        """Test extraction from all browsers sequentially (current behavior) or parallel (future behavior)."""
        # Create mock cookies
        c1 = self.create_mock_cookie("c1")
        f1 = self.create_mock_cookie("f1")

        # Mock browser functions
        mock_chrome = Mock(return_value=[c1])
        mock_firefox = Mock(return_value=[f1])
        mock_edge = Mock(side_effect=Exception("Edge failed")) # Simulate failure

        # Assign to the mock module
        mock_rp.chrome = mock_chrome
        mock_rp.firefox = mock_firefox
        mock_rp.edge = mock_edge
        mock_rp.chromium = Mock(return_value=[])

        # Test extraction
        cookies = self.manager._extract_cookies_from_browser(browser="all")

        # Verify results
        # Should contain cookies from chrome and firefox
        cookie_names = sorted([c.name for c in cookies])
        self.assertEqual(cookie_names, ["c1", "f1"])
        self.assertEqual(len(cookies), 2)

        # Verify calls were made
        mock_chrome.assert_called()
        mock_firefox.assert_called()
        mock_edge.assert_called()

    @patch("cookie_manager.rookiepy")
    def test_extract_cookies_single_browser(self, mock_rp):
        """Test extraction from a single browser."""
        c1 = self.create_mock_cookie("c1")
        mock_chrome = Mock(return_value=[c1])
        mock_rp.chrome = mock_chrome

        cookies = self.manager._extract_cookies_from_browser(browser="chrome")

        self.assertEqual(len(cookies), 1)
        self.assertEqual(cookies[0].name, "c1")
        mock_chrome.assert_called()


class TestCookieManagerAsync(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.manager = CookieManager()
        self.mock_db = MagicMock()
        self.mock_db.execute = AsyncMock()
        # Mock _db_connection to return our mock_db via the async context manager helper
        self.manager._db_connection = MagicMock(
            return_value=AsyncContextManagerMock(self.mock_db)
        )

    def _make_row(self, data):
        row = MagicMock()
        row.__getitem__.side_effect = data.__getitem__
        return row

    async def test_get_gemini_cookies_success(self):
        """Test successful retrieval of valid cookies."""
        future_time = time.time() + 3600
        rows = [
            self._make_row({"name": "__Secure-1PSID", "value": "val1", "expires": future_time}),
            self._make_row({"name": "__Secure-1PSIDTS", "value": "val2", "expires": future_time}),
        ]

        mock_cursor = MagicMock()
        mock_cursor.fetchall = AsyncMock(return_value=rows)
        self.mock_db.execute.return_value = mock_cursor

        result = await self.manager.get_gemini_cookies("test_profile")

        self.assertEqual(result, {"__Secure-1PSID": "val1", "__Secure-1PSIDTS": "val2"})
        self.mock_db.execute.assert_called()

    async def test_get_gemini_cookies_profile_not_found(self):
        """Test when profile has no cookies."""
        mock_cursor = MagicMock()
        mock_cursor.fetchall = AsyncMock(return_value=[])
        self.mock_db.execute.return_value = mock_cursor

        result = await self.manager.get_gemini_cookies("non_existent")

        self.assertIsNone(result)

    async def test_get_gemini_cookies_missing_required(self):
        """Test when some required cookies are missing."""
        rows = [
            self._make_row({"name": "__Secure-1PSID", "value": "val1", "expires": None}),
        ]

        mock_cursor = MagicMock()
        mock_cursor.fetchall = AsyncMock(return_value=rows)
        self.mock_db.execute.return_value = mock_cursor

        result = await self.manager.get_gemini_cookies("partial_profile")

        self.assertIsNone(result)

    async def test_get_gemini_cookies_expired(self):
        """Test when a required cookie is expired."""
        past_time = time.time() - 3600
        future_time = time.time() + 3600
        rows = [
            self._make_row({"name": "__Secure-1PSID", "value": "val1", "expires": future_time}),
            self._make_row({"name": "__Secure-1PSIDTS", "value": "val2", "expires": past_time}),
        ]

        mock_cursor = MagicMock()
        mock_cursor.fetchall = AsyncMock(return_value=rows)
        self.mock_db.execute.return_value = mock_cursor

        result = await self.manager.get_gemini_cookies("expired_profile")

        self.assertIsNone(result)

    async def test_get_gemini_cookies_no_expiration(self):
        """Test retrieval of cookies with no expiration (session cookies)."""
        rows = [
            self._make_row({"name": "__Secure-1PSID", "value": "val1", "expires": None}),
            self._make_row({"name": "__Secure-1PSIDTS", "value": "val2", "expires": None}),
        ]

        mock_cursor = MagicMock()
        mock_cursor.fetchall = AsyncMock(return_value=rows)
        self.mock_db.execute.return_value = mock_cursor

        result = await self.manager.get_gemini_cookies("session_profile")

        self.assertEqual(result, {"__Secure-1PSID": "val1", "__Secure-1PSIDTS": "val2"})

if __name__ == "__main__":
    unittest.main()
