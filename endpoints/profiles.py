"""Profile management API endpoints.

This module contains endpoints for creating, listing, switching,
and deleting browser cookie profiles.
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from dependencies import get_cookie_manager, get_gemini_client
from models import ProfileCreateReq, ProfileSwitchReq
from cookie_manager import CookieManager
from gemini_client import GeminiClientWrapper

router = APIRouter(prefix="/profiles", tags=["profiles"])


@router.post("/create")
async def create_profile(
    r: ProfileCreateReq,
    cookie_mgr: CookieManager = Depends(get_cookie_manager),
) -> dict[str, Any]:
    """Create a new profile by extracting cookies from browser.

    Args:
        r: ProfileCreateReq with profile name and browser type.
        cookie_mgr: Injected CookieManager dependency.

    Returns:
        Dict with status and message.

    Raises:
        HTTPException: 503 if cookie manager not initialized, 400 if creation fails.
    """
    try:
        success = await cookie_mgr.create_profile_from_browser(
            r.name,
            r.browser,  # type: ignore
        )
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to create profile '{r.name}' from {r.browser}",
            )
        return {
            "status": "success",
            "message": f"Profile '{r.name}' created from {r.browser}",
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Profile creation failed: {e}",
        ) from e


@router.get("/list")
async def list_profiles(
    cookie_mgr: CookieManager = Depends(get_cookie_manager),
    gemini_client: GeminiClientWrapper = Depends(get_gemini_client),
) -> dict[str, Any]:
    """List all stored profiles.

    Args:
        cookie_mgr: Injected CookieManager dependency.
        gemini_client: Injected GeminiClientWrapper dependency.

    Returns:
        Dict with profiles list and current profile info.

    Raises:
        HTTPException: 503 if cookie manager not initialized.
    """
    profiles = await cookie_mgr.list_profiles()
    current_profile = gemini_client.get_current_profile()

    return {
        "profiles": profiles,
        "current_profile": current_profile,
        "count": len(profiles),
    }


@router.post("/switch")
async def switch_profile(
    r: ProfileSwitchReq,
    gemini_client: GeminiClientWrapper = Depends(get_gemini_client),
) -> dict[str, str]:
    """Switch to a different profile.

    Args:
        r: ProfileSwitchReq with profile name.
        gemini_client: Injected GeminiClientWrapper dependency.

    Returns:
        Dict with status and message.

    Raises:
        HTTPException: 503 if services not initialized, 400 if switch fails.
    """
    try:
        success = await gemini_client.switch_profile(r.name)

        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to switch to profile '{r.name}'",
            )
        return {
            "status": "success",
            "message": f"Switched to profile '{r.name}'",
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Profile switch failed: {e}",
        ) from e


@router.delete("/{profile_name}")
async def delete_profile(
    profile_name: str,
    cookie_mgr: CookieManager = Depends(get_cookie_manager),
) -> dict[str, str]:
    """Delete a profile and its cookies.

    Args:
        profile_name: Name of the profile to delete.
        cookie_mgr: Injected CookieManager dependency.

    Returns:
        Dict with status and message.

    Raises:
        HTTPException: 503 if cookie manager not initialized, 404 if not found.
    """
    success = await cookie_mgr.delete_profile(profile_name)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Profile '{profile_name}' not found",
        )
    return {
        "status": "success",
        "message": f"Profile '{profile_name}' deleted",
    }


@router.post("/{profile_name}/refresh")
async def refresh_profile(
    profile_name: str,
    cookie_mgr: CookieManager = Depends(get_cookie_manager),
) -> dict[str, str]:
    """Refresh cookies for a profile.

    Args:
        profile_name: Name of the profile to refresh.
        cookie_mgr: Injected CookieManager dependency.

    Returns:
        Dict with status and message.

    Raises:
        HTTPException: 503 if cookie manager not initialized, 400 if refresh fails.
    """
    success = await cookie_mgr.refresh_profile(profile_name)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to refresh profile '{profile_name}'",
        )
    return {
        "status": "success",
        "message": f"Profile '{profile_name}' refreshed",
    }