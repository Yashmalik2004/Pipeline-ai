# hubspot.py

import base64
import json
import os
import secrets

import httpx
import requests
from dotenv import load_dotenv
from fastapi import HTTPException, Request
from fastapi.responses import HTMLResponse

from integrations.integration_item import IntegrationItem
from redis_client import add_key_value_redis, delete_key_redis, get_value_redis

load_dotenv()

# Configure these in backend/.env
CLIENT_ID = os.getenv("HUBSPOT_CLIENT_ID", "")
CLIENT_SECRET = os.getenv("HUBSPOT_CLIENT_SECRET", "")
REDIRECT_URI = os.getenv(
    "HUBSPOT_REDIRECT_URI",
    "http://localhost:8000/integrations/hubspot/oauth2callback",
)

SCOPES = "crm.objects.contacts.read crm.objects.companies.read crm.objects.deals.read"


async def authorize_hubspot(user_id, org_id):
    """Generate the HubSpot OAuth authorization URL and persist state in Redis."""
    if not CLIENT_ID or not CLIENT_SECRET:
        raise HTTPException(
            status_code=500,
            detail="HubSpot OAuth credentials are not configured. Set HUBSPOT_CLIENT_ID and HUBSPOT_CLIENT_SECRET.",
        )

    state_data = {
        "state": secrets.token_urlsafe(32),
        "user_id": user_id,
        "org_id": org_id,
    }

    encoded_state = base64.urlsafe_b64encode(
        json.dumps(state_data).encode("utf-8")
    ).decode("utf-8")

    await add_key_value_redis(
        f"hubspot_state:{org_id}:{user_id}",
        json.dumps(state_data),
        expire=600,
    )

    auth_url = (
        "https://app.hubspot.com/oauth/authorize"
        f"?client_id={CLIENT_ID}"
        f"&scope={SCOPES}"
        f"&redirect_uri={REDIRECT_URI}"
        f"&state={encoded_state}"
    )

    return auth_url


async def oauth2callback_hubspot(request: Request):
    """Validate the OAuth state, exchange the code for tokens, and store credentials."""
    if request.query_params.get("error"):
        raise HTTPException(
            status_code=400,
            detail=request.query_params.get("error_description")
            or request.query_params.get("error"),
        )

    code = request.query_params.get("code")
    encoded_state = request.query_params.get("state")

    if not code or not encoded_state:
        raise HTTPException(status_code=400, detail="Missing code or state parameter")

    try:
        state_data = json.loads(
            base64.urlsafe_b64decode(encoded_state).decode("utf-8")
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid state parameter")

    original_state = state_data.get("state")
    user_id = state_data.get("user_id")
    org_id = state_data.get("org_id")

    if not original_state or not user_id or not org_id:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")

    saved_state = await get_value_redis(f"hubspot_state:{org_id}:{user_id}")
    if not saved_state:
        raise HTTPException(status_code=400, detail="OAuth state expired or not found")

    try:
        saved_state_data = json.loads(saved_state)
    except (TypeError, json.JSONDecodeError):
        raise HTTPException(status_code=400, detail="Invalid stored OAuth state")

    if original_state != saved_state_data.get("state"):
        raise HTTPException(status_code=400, detail="State does not match.")

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.hubapi.com/oauth/v3/token",
            data={
                "grant_type": "authorization_code",
                "client_id": CLIENT_ID,
                "client_secret": CLIENT_SECRET,
                "redirect_uri": REDIRECT_URI,
                "code": code,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

    await delete_key_redis(f"hubspot_state:{org_id}:{user_id}")

    if response.status_code != 200:
        raise HTTPException(
            status_code=400,
            detail=f"Token exchange failed: {response.text}",
        )

    credentials = response.json()

    await add_key_value_redis(
        f"hubspot_credentials:{org_id}:{user_id}",
        json.dumps(credentials),
        expire=600,
    )

    return HTMLResponse(
        content="""
        <html>
            <script>
                window.close();
            </script>
        </html>
        """
    )


async def get_hubspot_credentials(user_id, org_id):
    """Retrieve the credentials produced by the OAuth callback."""
    credentials = await get_value_redis(f"hubspot_credentials:{org_id}:{user_id}")

    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials found.")

    if isinstance(credentials, bytes):
        credentials = credentials.decode("utf-8")

    credentials = json.loads(credentials)

    # Credentials are single-use in this frontend flow.
    await delete_key_redis(f"hubspot_credentials:{org_id}:{user_id}")

    return credentials


def create_integration_item_metadata_object(
    response_json: dict, item_type: str
) -> IntegrationItem:
    """Convert a HubSpot CRM object into the project's IntegrationItem model."""
    properties = response_json.get("properties", {})

    name = properties.get("name")
    if not name:
        if item_type == "Contact":
            first_name = properties.get("firstname", "")
            last_name = properties.get("lastname", "")
            name = f"{first_name} {last_name}".strip() or properties.get(
                "email", "Unknown"
            )
        elif item_type == "Deal":
            name = properties.get("dealname", "Unknown")
        else:
            name = properties.get("name", "Unknown")

    return IntegrationItem(
        id=response_json.get("id", ""),
        name=name,
        type=item_type,
        creation_time=response_json.get("createdAt"),
        last_modified_time=response_json.get("updatedAt"),
    )


def _serialize_integration_item(item: IntegrationItem) -> dict:
    return {
        "id": item.id,
        "name": item.name,
        "type": item.type,
        "creation_time": item.creation_time,
        "last_modified_time": item.last_modified_time,
        "parent_id": item.parent_id,
        "parent_path_or_name": item.parent_path_or_name,
        "url": item.url,
        "directory": item.directory,
        "visibility": item.visibility,
    }


async def get_items_hubspot(credentials) -> list[dict]:
    """Fetch HubSpot contacts, companies, and deals as IntegrationItem dictionaries."""
    if isinstance(credentials, bytes):
        credentials = credentials.decode("utf-8")

    if isinstance(credentials, str):
        try:
            credentials = json.loads(credentials)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid credentials JSON")

    access_token = credentials.get("access_token") if isinstance(credentials, dict) else None

    if not access_token:
        raise HTTPException(
            status_code=400,
            detail="No access token found in credentials",
        )

    headers = {"Authorization": f"Bearer {access_token}"}
    integration_items = []

    # These are the three CRM object types used by the reference implementation.
    endpoints = [
        ("contacts", "Contact"),
        ("companies", "Company"),
        ("deals", "Deal"),
    ]

    async with httpx.AsyncClient() as client:
        for endpoint, item_type in endpoints:
            try:
                response = await client.get(
                    f"https://api.hubapi.com/crm/v3/objects/{endpoint}",
                    headers=headers,
                    params={"limit": 100},
                )

                if response.status_code == 200:
                    data = response.json()
                    for item in data.get("results", []):
                        integration_items.append(
                            create_integration_item_metadata_object(item, item_type)
                        )
                else:
                    print(
                        f"HubSpot {item_type} request failed "
                        f"({response.status_code}): {response.text}"
                    )
            except httpx.HTTPError as exc:
                print(f"Error fetching HubSpot {item_type}s: {exc}")

    serialized_items = [
        _serialize_integration_item(item) for item in integration_items
    ]

    print(f"HubSpot integration items: {serialized_items}")
    return serialized_items
