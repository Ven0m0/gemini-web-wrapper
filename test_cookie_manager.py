import sys
import unittest
from unittest.mock import MagicMock, Mock, patch

# Mock aiosqlite as it's not installed in this environment
mock_aiosqlite = MagicMock()
sys.modules["aiosqlite"] = mock_aiosqlite

# Mock rookiepy
mock_rookiepy = MagicMock()
sys.modules["rookiepy"] = mock_rookiepy

from cookie_manager import CookieManager  # noqa: E402


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
        c.has_nonstandard_attr.return_value = True
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

if __name__ == "__main__":
    unittest.main()
