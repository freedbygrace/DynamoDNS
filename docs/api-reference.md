# DynamoDNS API Reference

This document provides detailed information about the DynamoDNS REST API endpoints, request/response formats, and authentication mechanisms.

## Authentication

The API supports two authentication methods:

### Session Authentication (Web UI)

Used for browser-based interactions. Authenticate via:
- POST `/api/login`
- GET `/api/user` (verify current session)
- POST `/api/logout`

### API Token Authentication

Required for programmatic access:
- Include the token in the `Authorization` header: `Authorization: Bearer YOUR_API_TOKEN`
- API tokens can be created and managed through the web interface or via API

## API Endpoints

### Authentication

#### `POST /api/login`

Authenticates a user and creates a session.

**Request:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "id": "string",
  "username": "string",
  "email": "string",
  "fullName": "string",
  "role": "string"
}
```

#### `POST /api/register`

Registers a new user (if enabled).

**Request:**
```json
{
  "username": "string",
  "email": "string",
  "password": "string",
  "fullName": "string"
}
```

**Response:**
```json
{
  "id": "string",
  "username": "string",
  "email": "string",
  "fullName": "string",
  "role": "string"
}
```

#### `POST /api/logout`

Ends the current user session.

**Response:** 
HTTP 200 OK

#### `GET /api/user`

Retrieves the current authenticated user's information.

**Response:** 
```json
{
  "id": "string",
  "username": "string", 
  "email": "string",
  "fullName": "string",
  "role": "string"
}
```

#### `GET /api/auth/config`

Retrieves the authentication configuration.

**Response:**
```json
{
  "localAuthEnabled": true,
  "registrationEnabled": false,
  "ldapEnabled": false,
  "oidcEnabled": false
}
```

### Customers

#### `GET /api/customers`

Returns all customers the authenticated user has access to.

**Response:**
```json
[
  {
    "id": "string",
    "name": "string",
    "description": "string",
    "email": "string",
    "phone": "string",
    "address": "string",
    "city": "string",
    "state": "string",
    "zipCode": "string",
    "country": "string",
    "website": "string",
    "industry": "string",
    "notes": "string",
    "accountManager": "string",
    "billingEmail": "string",
    "billingAddress": "string",
    "isActive": true,
    "createdAt": "string"
  }
]
```

#### `GET /api/customers/:id`

Returns a specific customer by ID.

**Response:** Customer object

#### `POST /api/customers`

Creates a new customer.

**Request:** Customer object without id and createdAt
**Response:** Created customer object

#### `PUT /api/customers/:id`

Updates an existing customer.

**Request:** Partial customer object
**Response:** Updated customer object

#### `DELETE /api/customers/:id`

Deletes a customer.

**Response:** HTTP 200 OK

### Domains

#### `GET /api/domains`

Returns all domains the user has access to.

**Query Parameters:**
- `customerId` (optional): Filter by customer ID

**Response:**
```json
[
  {
    "id": "string",
    "name": "string",
    "customerId": "string",
    "providerId": "string",
    "isActive": true,
    "createdAt": "string",
    "lastUpdated": "string"
  }
]
```

#### `GET /api/domains/:id`

Returns a specific domain by ID.

**Response:** Domain object

#### `POST /api/domains`

Creates a new domain.

**Request:**
```json
{
  "name": "string",
  "customerId": "string",
  "providerId": "string",
  "isActive": true
}
```

**Response:** Created domain object

#### `PUT /api/domains/:id`

Updates an existing domain.

**Request:** Partial domain object
**Response:** Updated domain object

#### `DELETE /api/domains/:id`

Deletes a domain.

**Response:** HTTP 200 OK

### DNS Records

#### `GET /api/dns-records`

Returns DNS records the user has access to.

**Query Parameters:**
- `domainId` (optional): Filter by domain ID

**Response:**
```json
[
  {
    "id": "string",
    "name": "string",
    "type": "A | AAAA | CNAME | MX | TXT | SRV | NS | CAA | PTR",
    "content": "string",
    "domainId": "string",
    "priority": 0,
    "ttl": 3600,
    "proxied": false,
    "isAutoIP": false,
    "isActive": true,
    "notes": "string",
    "providerRecordId": "string",
    "createdAt": "string",
    "updatedAt": "string",
    "currentIp": "string" // Only present when isAutoIP is true
  }
]
```

#### `GET /api/dns-records/:id`

Returns a specific DNS record by ID.

**Response:** DNS record object

#### `POST /api/dns-records`

Creates a new DNS record.

**Request:** DNS record object without id, createdAt, updatedAt
**Response:** Created DNS record object

#### `PUT /api/dns-records/:id`

Updates an existing DNS record.

**Request:** Partial DNS record object
**Response:** Updated DNS record object

#### `DELETE /api/dns-records/:id`

Deletes a DNS record.

**Response:** HTTP 200 OK

#### `POST /api/dns-records/:id/toggle`

Toggles a DNS record's active status.

**Response:** Updated DNS record object

### Providers

#### `GET /api/providers`

Returns all DNS providers.

**Response:**
```json
[
  {
    "id": "string",
    "name": "string",
    "type": "cloudflare | route53 | godaddy | other",
    "isActive": true,
    "credentials": {
      // Provider-specific credentials (redacted in response)
    },
    "createdAt": "string"
  }
]
```

#### `GET /api/providers/:id`

Returns a specific provider by ID.

**Response:** Provider object (credentials redacted)

#### `POST /api/providers`

Creates a new provider.

**Request:** Provider object with credentials
**Response:** Created provider object (credentials redacted)

#### `PUT /api/providers/:id`

Updates an existing provider.

**Request:** Partial provider object
**Response:** Updated provider object (credentials redacted)

#### `DELETE /api/providers/:id`

Deletes a provider.

**Response:** HTTP 200 OK

### DNS History

#### `GET /api/dns-history`

Returns DNS history records.

**Query Parameters:**
- `recordId` (optional): Filter by DNS record ID
- `domainId` (optional): Filter by domain ID
- `startDate` (optional): Filter by start date
- `endDate` (optional): Filter by end date

**Response:**
```json
[
  {
    "id": "string",
    "recordId": "string",
    "domainId": "string",
    "previousValue": "string",
    "newValue": "string",
    "changedBy": "string",
    "createdAt": "string"
  }
]
```

### Metrics

#### `GET /api/dns-metrics`

Returns DNS metrics.

**Query Parameters:**
- `recordId` (optional): Filter by DNS record ID
- `domainId` (optional): Filter by domain ID
- `type` (optional): Filter by metric type
- `startDate` (optional): Filter by start date
- `endDate` (optional): Filter by end date

**Response:**
```json
[
  {
    "id": "string",
    "recordId": "string",
    "domainId": "string",
    "type": "string",
    "value": 0,
    "timestamp": "string"
  }
]
```

### API Tokens

#### `GET /api/api-tokens`

Returns all API tokens for the authenticated user.

**Response:**
```json
[
  {
    "id": "string",
    "name": "string",
    "token": "string", // Only the first few and last few characters
    "createdBy": "string",
    "expiresAt": "string",
    "isActive": true,
    "role": "string", 
    "createdAt": "string",
    "customerAccess": [
      {
        "customerId": "string",
        "customerName": "string" // Populated for convenience
      }
    ]
  }
]
```

#### `POST /api/api-tokens`

Creates a new API token.

**Request:**
```json
{
  "name": "string",
  "expiresAt": "string", // optional
  "role": "string",
  "customerIds": ["string"] // optional, if empty, grants access to all customers
}
```

**Response:** Created API token object with the full token value (only returned once)

#### `PUT /api/api-tokens/:id`

Updates an existing API token.

**Request:**
```json
{
  "name": "string",
  "expiresAt": "string",
  "isActive": true,
  "customerIds": ["string"]
}
```

**Response:** Updated API token object

#### `DELETE /api/api-tokens/:id`

Revokes an API token.

**Response:** HTTP 200 OK

### Webhooks

#### `GET /api/webhooks`

Returns all webhooks for the authenticated user's customers.

**Response:**
```json
[
  {
    "id": "string",
    "customerId": "string",
    "name": "string",
    "url": "string",
    "secret": "string", // Redacted
    "events": ["string"],
    "isActive": true,
    "createdAt": "string",
    "lastTriggered": "string"
  }
]
```

#### `POST /api/webhooks`

Creates a new webhook.

**Request:**
```json
{
  "customerId": "string",
  "name": "string",
  "url": "string",
  "secret": "string",
  "events": ["string"],
  "isActive": true
}
```

**Response:** Created webhook object (secret redacted)

#### `GET /api/webhook-logs`

Returns webhook delivery logs.

**Query Parameters:**
- `webhookId` (required): Filter by webhook ID

**Response:**
```json
[
  {
    "id": "string",
    "webhookId": "string",
    "event": "string",
    "payload": "object",
    "response": "string",
    "statusCode": 0,
    "success": true,
    "createdAt": "string"
  }
]
```

### Utility Endpoints

#### `GET /api/public-ip`

Returns the public IP addresses of the client.

**Response:**
```json
{
  "ipv4": "string",
  "ipv6": "string"
}
```

## Error Responses

All API endpoints return standard HTTP status codes:

- **400 Bad Request**: Invalid input
- **401 Unauthorized**: Missing or invalid authentication
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource not found
- **500 Internal Server Error**: Server-side error

Error responses include a JSON body with error details:

```json
{
  "message": "Error description",
  "code": "ERROR_CODE",
  "details": {} // Additional error details when available
}
```

## Rate Limiting

API requests are rate-limited to prevent abuse. Rate limit headers are included in all responses:

- `X-RateLimit-Limit`: Number of requests allowed in the current time window
- `X-RateLimit-Remaining`: Number of requests remaining in the current time window
- `X-RateLimit-Reset`: Time when the rate limit window resets (Unix timestamp)

When rate limits are exceeded, a 429 Too Many Requests response is returned.

## Pagination

List endpoints support pagination using the following query parameters:

- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)

Paginated responses include metadata:

```json
{
  "data": [],
  "pagination": {
    "total": 0,
    "pages": 0,
    "page": 1,
    "limit": 20
  }
}
```