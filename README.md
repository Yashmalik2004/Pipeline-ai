# Pipeline AI — HubSpot Integration

A full-stack HubSpot CRM integration developed for the Pipeline AI Integrations Technical Assessment.

The application implements HubSpot OAuth 2.0 authentication, Redis-backed OAuth state and credential management, and HubSpot CRM data retrieval for Contacts, Companies, and Deals.

---

## Quick Start

### Prerequisites

Make sure you have:

- Python 3.12+
- Node.js and npm
- Docker Desktop
- A HubSpot developer account

### 1. Clone the Repository

```bash
git clone <your-repository-url>
cd "Pipeline AI Assignment"
```

### 2. Configure HubSpot OAuth

Create a HubSpot OAuth app and configure the following redirect URL:

```
http://localhost:8000/integrations/hubspot/oauth2callback
```

Required scopes:

```
crm.objects.contacts.read
crm.objects.companies.read
crm.objects.deals.read
```

Obtain your:

- Client ID
- Client Secret

### 3. Configure Environment Variables

Create:

```
backend/.env
```

Add:

```env
HUBSPOT_CLIENT_ID=your_client_id
HUBSPOT_CLIENT_SECRET=your_client_secret
HUBSPOT_REDIRECT_URI=http://localhost:8000/integrations/hubspot/oauth2callback
```

> Do not commit `.env` or expose the Client Secret.

### 4. Start Redis

Using Docker:

```bash
docker run --name pipeline-redis -p 6379:6379 -d redis
```

If Redis is already running on port 6379, use the existing instance.

Verify:

```bash
docker exec pipeline-redis redis-cli ping
```

Expected:

```
PONG
```

### 5. Start the Backend

Open a terminal:

```bash
cd backend
python -m venv venv
```

Windows PowerShell:

```powershell
.\venv\Scripts\Activate.ps1
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Start FastAPI:

```bash
uvicorn main:app --reload
```

Backend:

```
http://localhost:8000
```

API documentation:

```
http://localhost:8000/docs
```

### 6. Start the Frontend

Open another terminal:

```bash
cd frontend
npm install
npm start
```

Frontend:

```
http://localhost:3000
```

### 7. Test HubSpot

1. Open `http://localhost:3000`
2. Select **HubSpot**
3. Start the authorization flow
4. Authorize the application in HubSpot
5. Return to the application
6. Load the HubSpot integration data
7. Verify Contacts, Companies, and Deals are displayed

---

## What This Project Does

The integration provides a complete HubSpot OAuth → CRM API workflow:

```
React Frontend
      │
      ▼
FastAPI Backend
      │
      ├──────────────► Redis
      │                 │
      │                 └── OAuth state / credentials
      │
      ▼
HubSpot OAuth
      │
      ▼
Authorization Code
      │
      ▼
HubSpot Token API
      │
      ▼
Access Token
      │
      ▼
HubSpot CRM API
      │
      ├── Contacts
      ├── Companies
      └── Deals
      │
      ▼
IntegrationItem[]
      │
      ▼
React Frontend
```

---

## Features

- HubSpot OAuth 2.0 authentication
- OAuth state generation and validation
- Redis-backed OAuth state management
- Temporary credential storage
- HubSpot access-token exchange
- HubSpot CRM API integration
  - Contact retrieval
  - Company retrieval
  - Deal retrieval
- IntegrationItem normalization
- React integration UI
- FastAPI backend
- Asynchronous HTTP requests using HTTPX
- Environment-based configuration

---

## HubSpot Integration Workflow

### 1. Authorization Request

The user selects HubSpot from the React frontend.

The frontend initiates the HubSpot authorization flow through the FastAPI backend.

The backend calls:

```python
authorize_hubspot(user_id, org_id)
```

### 2. OAuth State Generation

The backend generates a cryptographically secure random state.

The state contains:

- `state`
- `user_id`
- `org_id`

The state is stored temporarily in Redis:

```
hubspot_state:{org_id}:{user_id}
```

It is also encoded and included in the HubSpot authorization URL.

This allows the callback to verify that the OAuth response belongs to the authorization request initiated by the application.

### 3. Redirect to HubSpot

The user is redirected to:

```
https://app.hubspot.com/oauth/authorize
```

The request contains:

- Client ID
- Redirect URI
- OAuth scopes
- State

The application requests only read permissions:

```
crm.objects.contacts.read
crm.objects.companies.read
crm.objects.deals.read
```

### 4. User Authorization

The user authorizes the application in HubSpot.

HubSpot then redirects to:

```
http://localhost:8000/integrations/hubspot/oauth2callback
```

with:

- `code`
- `state`

### 5. OAuth Callback

FastAPI handles the callback through:

```python
oauth2callback_hubspot(request)
```

The callback:

1. Checks for OAuth errors.
2. Extracts the authorization code.
3. Decodes the state.
4. Retrieves the original state from Redis.
5. Compares both states.
6. Rejects the request if the state is invalid or expired.

### 6. Token Exchange

After state validation, the authorization code is exchanged for HubSpot OAuth credentials using:

```
POST https://api.hubapi.com/oauth/v3/token
```

The request includes:

- `grant_type`
- `client_id`
- `client_secret`
- `redirect_uri`
- `code`

HubSpot returns the OAuth credentials, including the access token.

### 7. Temporary Credential Storage

The returned credentials are temporarily stored in Redis:

```
hubspot_credentials:{org_id}:{user_id}
```

The frontend can then retrieve them through the existing integration flow.

After retrieval, the temporary Redis entry is deleted.

### 8. Retrieve HubSpot CRM Data

The access token is used as a Bearer token:

```
Authorization: Bearer <access_token>
```

The backend queries:

```
GET https://api.hubapi.com/crm/v3/objects/contacts
GET https://api.hubapi.com/crm/v3/objects/companies
GET https://api.hubapi.com/crm/v3/objects/deals
```

The implementation retrieves up to 100 records per object type.

### 9. Normalize HubSpot Objects

HubSpot returns different structures for Contacts, Companies, and Deals.

The backend converts each record into the common `IntegrationItem` model.

For example:

```
HubSpot Contact
      │
      ▼
IntegrationItem
├── id
├── name
├── type = Contact
├── creation_time
└── last_modified_time
```

Contacts use `firstname + lastname` as the primary display name, with email as a fallback.

Companies use `name` and Deals use `dealname`.

### 10. Return Data to Frontend

The normalized `IntegrationItem` objects are serialized and returned to the frontend.

This allows the React UI to work with a consistent data structure rather than handling HubSpot''s individual CRM object formats.

---

## Architecture

[Keep your detailed architecture diagram here.]

---

## Project Structure

[Keep your project tree here.]

---

## OAuth Security

[Keep the detailed security section here.]

---

## HubSpot API Integration

[Keep the detailed API section here.]

---

## IntegrationItem Design

[Keep the IntegrationItem section here.]

---

## Error Handling

[Keep the detailed error handling section here.]

---

## Other Integrations

The provided assessment also contains Airtable and Notion integrations. Their existing architecture has been preserved.

The HubSpot integration is the primary integration implemented and tested as part of this assessment.

---

## Dependency Management

The backend dependency list was reduced to the packages actually required by the application.

Current dependencies include:

```
fastapi
uvicorn
python-dotenv
redis
kombu
httpx
requests
python-multipart
```

This avoids unnecessary packages and native dependencies from the original environment.

---

## Security Considerations

The following files are excluded from Git:

```
.env
venv/
node_modules/
__pycache__/
*.pyc
dump.rdb
```

The HubSpot Client Secret is never stored in source code.

---

## License

This project was developed as part of a technical assessment for Pipeline AI and is intended for evaluation purposes.
