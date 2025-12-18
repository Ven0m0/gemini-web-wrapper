#!/usr/bin/env python3
"""Cookie management module for Gemini API with browser-cookie3 and aiosqlite.

This module provides cookie extraction from browsers, persistent storage in SQLite,
and multi-profile support inspired by Electron-based wrappers.

Features:
- Automatic cookie extraction from Chrome, Firefox, Edge, Safari
- Async SQLite storage with aiosqlite
- Multi-profile support for different users/accounts
- Cookie refresh and validation
- Thread-safe operations
"""

import asyncio
import json
import logging
import time
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, ClassVar, Literal

import aiosqlite
import browser_cookie3

logger = logging.getLogger(__name__)

BrowserType = Literal["chrome", "firefox", "edge", "safari", "chromium", "all"]


@dataclass
class CookieData:
    """Represents a cookie with all necessary attributes.

    Attributes:
        name: Cookie name (e.g., __Secure-1PSID).
        value: Cookie value/token.
        domain: Cookie domain (e.g., .google.com).
        path: Cookie path (e.g., /).
        expires: Expiration timestamp (Unix time).
        secure: Whether cookie requires HTTPS.
        http_only: Whether cookie is HTTP-only.
    """

    name: str
    value: str
    domain: str
    path: str
    expires: float | None
    secure: bool
    http_only: bool

    def is_expired(self) -> bool:
        """Check if the cookie has expired.

        Returns:
            True if cookie is expired or has no expiration, False otherwise.
        """
        if self.expires is None:
            return False
        return time.time() > self.expires

    def to_dict(self) -> dict[str, Any]:
        """Convert cookie to dictionary format.

        Returns:
            Dict representation of the cookie.
        """
        return {
            "name": self.name,
            "value": self.value,
            "domain": self.domain,
            "path": self.path,
            "expires": self.expires,
            "secure": self.secure,
            "http_only": self.http_only,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "CookieData":
        """Create CookieData from mapping with permissive keys."""
        return cls(
            name=data["name"],
            value=data["value"],
            domain=data["domain"],
            path=data["path"],
            expires=data.get("expires"),
            secure=bool(data.get("secure")),
            http_only=bool(data.get("http_only")),
        )


@dataclass
class Profile:
    """Represents a user profile with associated cookies.

    Attributes:
        name: Profile name/identifier.
        browser: Browser type the cookies were extracted from.
        cookies: Dictionary of cookie name to CookieData.
        created_at: Profile creation timestamp.
        updated_at: Last update timestamp.
    """

    name: str
    browser: str
    cookies: dict[str, CookieData]
    created_at: float
    updated_at: float


class CookieManager:
    """Manages cookie extraction, storage, and retrieval for Gemini API.

    This class handles:
    - Extracting cookies from various browsers using browser-cookie3
    - Storing cookies in SQLite database with aiosqlite
    - Managing multiple profiles for different accounts
    - Refreshing and validating cookies
    - Thread-safe async operations

    Attributes:
        db_path: Path to SQLite database file.
    """

    # Required Gemini cookies for authentication
    REQUIRED_COOKIES: ClassVar[list[str]] = [
        "__Secure-1PSID",
        "__Secure-1PSIDTS",
    ]
    GEMINI_DOMAIN: ClassVar[str] = ".google.com"

    def __init__(self, db_path: str = "gemini_cookies.db") -> None:
        """Initialize the cookie manager.

        Args:
            db_path: Path to SQLite database file for cookie storage.
        """
        self.db_path = Path(db_path)
        self._lock = asyncio.Lock()

    async def init_db(self) -> None:
        """Initialize the SQLite database schema.

        Creates the profiles and cookies tables if they don't exist.
        Uses WITHOUT ROWID optimization for better performance.
        Enables WAL mode for concurrent read access.
        """
        async with aiosqlite.connect(self.db_path) as db:
            # Enable WAL mode for better concurrent access
            # This allows multiple readers to access the DB while a writer is active
            await db.execute("PRAGMA journal_mode=WAL")

            await db.execute("""
                CREATE TABLE IF NOT EXISTS profiles (
                    name TEXT PRIMARY KEY,
                    browser TEXT NOT NULL,
                    created_at REAL NOT NULL,
                    updated_at REAL NOT NULL
                ) WITHOUT ROWID
            """)

            await db.execute("""
                CREATE TABLE IF NOT EXISTS cookies (
                    profile_name TEXT NOT NULL,
                    name TEXT NOT NULL,
                    value TEXT NOT NULL,
                    domain TEXT NOT NULL,
                    path TEXT NOT NULL,
                    expires REAL,
                    secure INTEGER NOT NULL,
                    http_only INTEGER NOT NULL,
                    PRIMARY KEY (profile_name, name),
                    FOREIGN KEY (profile_name) REFERENCES profiles(name)
                        ON DELETE CASCADE
                ) WITHOUT ROWID
            """)

            # Create index for profile_name to optimize JOIN queries
            await db.execute("""
                CREATE INDEX IF NOT EXISTS idx_cookies_profile
                ON cookies(profile_name)
            """)

            await db.commit()

    @asynccontextmanager
    async def _db_connection(
        self,
        write: bool = False,
    ) -> AsyncGenerator[aiosqlite.Connection, None]:
        """Async context manager for database connections.

        Args:
            write: If True, acquires lock for write operations. Read operations
                   don't need locks due to WAL mode's concurrent read support.

        Yields:
            SQLite connection with row factory enabled.
        """
        if write:
            # Write operations need lock to serialize writes
            async with self._lock, aiosqlite.connect(self.db_path) as db:
                db.row_factory = aiosqlite.Row
                yield db
        else:
            # Read operations can proceed concurrently thanks to WAL mode
            async with aiosqlite.connect(self.db_path) as db:
                db.row_factory = aiosqlite.Row
                yield db

    def _extract_cookies_from_browser(
        self,
        browser: BrowserType = "chrome",
        domain: str = GEMINI_DOMAIN,
    ) -> list[CookieData]:
        """Extract cookies from browser cookie store.

        This is a blocking I/O operation and should be run in a thread pool.

        Args:
            browser: Browser type to extract from.
            domain: Domain to filter cookies by.

        Returns:
            List of CookieData objects extracted from the browser.

        Raises:
            RuntimeError: If cookie extraction fails.
        """
        try:
            # Map browser type to browser_cookie3 function
            browser_funcs = {
                "chrome": browser_cookie3.chrome,
                "firefox": browser_cookie3.firefox,
                "edge": browser_cookie3.edge,
                "safari": browser_cookie3.safari,
                "chromium": browser_cookie3.chromium,
            }

            if browser == "all":
                # Try all browsers and merge results
                cookies = []
                for func in browser_funcs.values():
                    try:
                        cookies.extend(func(domain_name=domain))
                    except Exception:
                        # Skip browsers that fail
                        continue
            elif browser in browser_funcs:
                cookies = browser_funcs[browser](domain_name=domain)
            else:
                raise ValueError(f"Unsupported browser: {browser}")

            # Convert to CookieData objects
            return [
                CookieData(
                    name=c.name,
                    value=c.value,
                    domain=c.domain,
                    path=c.path,
                    expires=c.expires,
                    secure=c.secure,
                    http_only=hasattr(c, "http_only") and c.http_only,
                )
                for c in cookies
            ]

        except Exception as e:
            raise RuntimeError(f"Failed to extract cookies from {browser}: {e}") from e

    async def extract_cookies(
        self,
        browser: BrowserType = "chrome",
        domain: str = GEMINI_DOMAIN,
        timeout: float = 10.0,
    ) -> list[CookieData]:
        """Extract cookies from browser asynchronously with timeout.

        Args:
            browser: Browser type to extract from.
            domain: Domain to filter cookies by.
            timeout: Maximum time to wait for extraction (default 10 seconds).

        Returns:
            List of extracted CookieData objects.

        Raises:
            RuntimeError: If extraction times out or fails.
        """
        try:
            # Run blocking browser_cookie3 operation in thread pool with timeout
            return await asyncio.wait_for(
                asyncio.to_thread(
                    self._extract_cookies_from_browser,
                    browser,
                    domain,
                ),
                timeout=timeout,
            )
        except TimeoutError as e:
            raise RuntimeError(
                f"Cookie extraction from {browser} timed out after {timeout}s"
            ) from e

    async def save_profile(
        self,
        profile_name: str,
        cookies: list[CookieData],
        browser: str,
    ) -> None:
        """Save a profile with its cookies to the database.

        Args:
            profile_name: Name/identifier for the profile.
            cookies: List of cookies to save.
            browser: Browser the cookies were extracted from.

        Raises:
            ValueError: If required cookies are missing.
        """
        # Validate required cookies are present
        cookie_names = {c.name for c in cookies}
        missing = set(self.REQUIRED_COOKIES) - cookie_names
        if missing:
            raise ValueError(f"Missing required cookies: {missing}")

        now = time.time()

        async with self._db_connection(write=True) as db:
            # Insert or update profile
            await db.execute(
                """
                INSERT INTO profiles (name, browser, created_at, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(name) DO UPDATE SET
                    browser = excluded.browser,
                    updated_at = excluded.updated_at
                """,
                (profile_name, browser, now, now),
            )

            # Delete existing cookies for this profile
            await db.execute(
                "DELETE FROM cookies WHERE profile_name = ?",
                (profile_name,),
            )

            # Batch insert new cookies using executemany for performance
            cookie_data = [
                (
                    profile_name,
                    cookie.name,
                    cookie.value,
                    cookie.domain,
                    cookie.path,
                    cookie.expires,
                    int(cookie.secure),
                    int(cookie.http_only),
                )
                for cookie in cookies
            ]

            await db.executemany(
                """
                INSERT INTO cookies
                (profile_name, name, value, domain, path, expires, secure, http_only)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                cookie_data,
            )

            await db.commit()

        logger.info(
            f"Saved profile '{profile_name}' with {len(cookies)} cookies from {browser}"
        )

    async def load_profile(self, profile_name: str) -> Profile | None:
        """Load a profile and its cookies from the database using a single JOIN query.

        Args:
            profile_name: Name of the profile to load.

        Returns:
            Profile object if found, None otherwise.
        """
        async with self._db_connection() as db:
            # Get profile and cookies in a single JOIN query
            cursor = await db.execute(
                """
                SELECT
                    p.name as profile_name,
                    p.browser,
                    p.created_at,
                    p.updated_at,
                    c.name as cookie_name,
                    c.value,
                    c.domain,
                    c.path,
                    c.expires,
                    c.secure,
                    c.http_only
                FROM profiles p
                LEFT JOIN cookies c ON p.name = c.profile_name
                WHERE p.name = ?
                """,
                (profile_name,),
            )
            rows = await cursor.fetchall()

            if not rows:
                return None

            # Build profile from first row (all rows have same profile data)
            first_row = rows[0]
            profile_name_val = first_row["profile_name"]
            browser = first_row["browser"]
            created_at = first_row["created_at"]
            updated_at = first_row["updated_at"]

            # Build cookies dict from all rows
            cookies: dict[str, CookieData] = {}
            for row in rows:
                # LEFT JOIN might have NULL cookie columns if profile has no cookies
                if row["cookie_name"] is not None:
                    cookies[row["cookie_name"]] = CookieData(
                        name=row["cookie_name"],
                        value=row["value"],
                        domain=row["domain"],
                        path=row["path"],
                        expires=row["expires"],
                        secure=bool(row["secure"]),
                        http_only=bool(row["http_only"]),
                    )

            return Profile(
                name=profile_name_val,
                browser=browser,
                cookies=cookies,
                created_at=created_at,
                updated_at=updated_at,
            )

    async def list_profiles(self) -> list[dict[str, Any]]:
        """List all stored profiles.

        Returns:
            List of profile metadata dictionaries.
        """
        async with self._db_connection() as db:
            cursor = await db.execute(
                """
                SELECT name, browser, created_at, updated_at,
                       COUNT(c.name) as cookie_count
                FROM profiles p
                LEFT JOIN cookies c ON p.name = c.profile_name
                GROUP BY p.name
                ORDER BY updated_at DESC
                """
            )
            rows = await cursor.fetchall()

            return [
                {
                    "name": row["name"],
                    "browser": row["browser"],
                    "created_at": datetime.fromtimestamp(row["created_at"]).isoformat(),
                    "updated_at": datetime.fromtimestamp(row["updated_at"]).isoformat(),
                    "cookie_count": row["cookie_count"],
                }
                for row in rows
            ]

    async def delete_profile(self, profile_name: str) -> bool:
        """Delete a profile and its cookies.

        Args:
            profile_name: Name of the profile to delete.

        Returns:
            True if profile was deleted, False if it didn't exist.
        """
        async with self._db_connection(write=True) as db:
            cursor = await db.execute(
                "DELETE FROM profiles WHERE name = ?",
                (profile_name,),
            )
            await db.commit()

            return cursor.rowcount > 0

    async def get_gemini_cookies(self, profile_name: str) -> dict[str, str] | None:
        """Get required Gemini cookies for a profile efficiently.

        This method queries only the required cookies instead of loading
        the entire profile for better performance.

        Args:
            profile_name: Name of the profile.

        Returns:
            Dict with cookie names as keys and values, or None if profile not found
            or required cookies are missing/expired.
        """
        async with self._db_connection() as db:
            # Query only the required cookies
            placeholders = ", ".join("?" * len(self.REQUIRED_COOKIES))
            cursor = await db.execute(
                f"""
                SELECT name, value, expires
                FROM cookies
                WHERE profile_name = ?
                  AND name IN ({placeholders})
                """,
                (profile_name, *self.REQUIRED_COOKIES),
            )
            rows = await cursor.fetchall()

            if not rows:
                return None

            # Check we got all required cookies
            found_cookies = {row["name"] for row in rows}
            missing = set(self.REQUIRED_COOKIES) - found_cookies
            if missing:
                logger.warning(
                    f"Profile '{profile_name}' missing required cookies: {missing}"
                )
                return None

            # Build result and check expiration
            result = {}
            current_time = time.time()
            for row in rows:
                cookie_name = row["name"]
                expires = row["expires"]

                # Check if expired
                if expires is not None and current_time > expires:
                    logger.warning(
                        f"Cookie {cookie_name} in profile '{profile_name}' has expired"
                    )
                    return None

                result[cookie_name] = row["value"]

            return result

    async def refresh_profile(
        self,
        profile_name: str,
        browser: BrowserType | None = None,
    ) -> bool:
        """Refresh cookies for an existing profile.

        Args:
            profile_name: Name of the profile to refresh.
            browser: Browser to extract from, or None to use profile's browser.

        Returns:
            True if refresh succeeded, False otherwise.
        """
        # Load existing profile to get browser type
        profile = await self.load_profile(profile_name)
        if not profile and not browser:
            logger.error(f"Profile '{profile_name}' not found and no browser specified")
            return False

        browser_type = browser or (profile.browser if profile else "chrome")

        try:
            # Extract fresh cookies
            cookies = await self.extract_cookies(browser_type)  # type: ignore

            if not cookies:
                logger.error(f"No cookies extracted from {browser_type}")
                return False

            # Save with updated timestamp
            await self.save_profile(profile_name, cookies, browser_type)  # type: ignore
            return True

        except Exception as e:
            logger.error(f"Failed to refresh profile '{profile_name}': {e}")
            return False

    async def create_profile_from_browser(
        self,
        profile_name: str,
        browser: BrowserType = "chrome",
    ) -> bool:
        """Create a new profile by extracting cookies from browser.

        Args:
            profile_name: Name for the new profile.
            browser: Browser to extract cookies from.

        Returns:
            True if profile was created successfully, False otherwise.
        """
        try:
            cookies = await self.extract_cookies(browser)

            if not cookies:
                logger.error(f"No cookies found in {browser}")
                return False

            await self.save_profile(profile_name, cookies, browser)
            return True

        except Exception as e:
            logger.error(f"Failed to create profile '{profile_name}': {e}")
            return False

    async def export_profile(self, profile_name: str, output_path: str) -> bool:
        """Export a profile to a JSON file.

        Args:
            profile_name: Name of the profile to export.
            output_path: Path to save the JSON file.

        Returns:
            True if export succeeded, False otherwise.
        """
        profile = await self.load_profile(profile_name)
        if not profile:
            return False

        data = {
            "name": profile.name,
            "browser": profile.browser,
            "created_at": profile.created_at,
            "updated_at": profile.updated_at,
            "cookies": [cookie.to_dict() for cookie in profile.cookies.values()],
        }

        try:
            await asyncio.to_thread(
                Path(output_path).write_text,
                json.dumps(data, indent=2),
            )
            return True
        except Exception as e:
            logger.error(f"Failed to export profile: {e}")
            return False

    async def import_profile(self, profile_name: str, input_path: str) -> bool:
        """Import a profile from a JSON file.

        Args:
            profile_name: Name for the imported profile.
            input_path: Path to the JSON file.

        Returns:
            True if import succeeded, False otherwise.
        """
        try:
            content = await asyncio.to_thread(Path(input_path).read_text)
            data = json.loads(content)

            cookies = [CookieData.from_dict(c) for c in data["cookies"]]

            await self.save_profile(profile_name, cookies, data["browser"])
            return True

        except Exception as e:
            logger.error(f"Failed to import profile: {e}")
            return False
