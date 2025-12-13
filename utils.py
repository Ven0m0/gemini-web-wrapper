"""Common utilities for error handling, async operations, and validation.

This module provides reusable decorators, dependencies, and helper functions
to eliminate code duplication and ensure consistent error handling across
the application.
"""

import asyncio
from collections.abc import Awaitable, Callable
from functools import wraps
from typing import Any, ParamSpec, TypeVar

from fastapi import HTTPException, status

P = ParamSpec("P")
T = TypeVar("T")


# ----- Thread Pool Utilities -----


async def run_in_thread(
    func: Callable[P, T], *args: P.args, **kwargs: P.kwargs
) -> T:
    """Execute a blocking function in a thread pool.

    Args:
        func: Synchronous function to execute.
        *args: Positional arguments to pass to func.
        **kwargs: Keyword arguments to pass to func.

    Returns:
        Result from func execution.

    Example:
        >>> result = await run_in_thread(some_blocking_function, arg1, arg2)
    """
    return await asyncio.to_thread(func, *args, **kwargs)


# ----- Error Handling Decorators -----


def handle_generation_errors(
    func: Callable[P, Awaitable[T]],
) -> Callable[P, Awaitable[T]]:
    """Decorator to handle common model generation errors.

    Catches RuntimeError, ValueError, ConnectionError, and TimeoutError,
    converting them to HTTPException with status 500.

    Args:
        func: Async function to wrap.

    Returns:
        Wrapped function with error handling.

    Example:
        >>> @handle_generation_errors
        >>> async def generate_response(prompt: str) -> str:
        ...     return await model.generate(prompt)
    """

    @wraps(func)
    async def wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
        try:
            return await func(*args, **kwargs)
        except (
            RuntimeError,
            ValueError,
            ConnectionError,
            TimeoutError,
        ) as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Generation failed: {e}",
            ) from e

    return wrapper


def handle_api_errors(
    func: Callable[P, Awaitable[T]],
) -> Callable[P, Awaitable[T]]:
    """Decorator to handle API-level errors.

    Catches common API errors and converts them to appropriate HTTP responses.

    Args:
        func: Async function to wrap.

    Returns:
        Wrapped function with error handling.

    Example:
        >>> @handle_api_errors
        >>> async def process_request(data: dict[str, Any]) -> dict[str, Any]:
        ...     return await process(data)
    """

    @wraps(func)
    async def wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
        try:
            return await func(*args, **kwargs)
        except HTTPException:
            # Re-raise HTTPExceptions as-is
            raise
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e),
            ) from e
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Internal server error: {e}",
            ) from e

    return wrapper


# ----- Retry Utilities -----


def retry_with_backoff(
    max_attempts: int = 3,
    initial_delay: float = 0.1,
    backoff_factor: float = 2.0,
    exceptions: tuple[type[Exception], ...] = (Exception,),
) -> Callable[[Callable[P, Awaitable[T]]], Callable[P, Awaitable[T]]]:
    """Decorator for retrying async functions with exponential backoff.

    Args:
        max_attempts: Maximum number of retry attempts.
        initial_delay: Initial delay in seconds before first retry.
        backoff_factor: Multiplier for delay between retries.
        exceptions: Tuple of exception types to catch and retry.

    Returns:
        Decorator function.

    Example:
        >>> @retry_with_backoff(max_attempts=3, exceptions=(ConnectionError,))
        >>> async def fetch_data() -> dict[str, Any]:
        ...     return await api_call()
    """

    def decorator(func: Callable[P, Awaitable[T]]) -> Callable[P, Awaitable[T]]:
        @wraps(func)
        async def wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
            delay = initial_delay
            last_exception: Exception | None = None

            for attempt in range(max_attempts):
                try:
                    return await func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e
                    if attempt < max_attempts - 1:
                        await asyncio.sleep(delay)
                        delay *= backoff_factor
                    continue

            # If we exhausted all attempts, raise the last exception
            if last_exception:
                raise last_exception
            # This should never happen, but satisfy type checker
            raise RuntimeError("Retry failed without exception")

        return wrapper

    return decorator


# ----- Validation Utilities -----


def require_non_empty(value: str | None, field_name: str = "field") -> str:
    """Validate that a string value is not None or empty.

    Args:
        value: String value to validate.
        field_name: Name of the field for error messages.

    Returns:
        The validated non-empty string.

    Raises:
        HTTPException: If value is None or empty string.

    Example:
        >>> prompt = require_non_empty(request.prompt, "prompt")
    """
    if not value or not value.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{field_name} cannot be empty",
        )
    return value.strip()


def require_non_empty_list(
    value: list[Any] | None,
    field_name: str = "list",
) -> list[Any]:
    """Validate that a list is not None or empty.

    Args:
        value: List to validate.
        field_name: Name of the field for error messages.

    Returns:
        The validated non-empty list.

    Raises:
        HTTPException: If value is None or empty list.

    Example:
        >>> messages = require_non_empty_list(request.messages, "messages")
    """
    if not value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{field_name} cannot be empty",
        )
    return value
