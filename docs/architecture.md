# DynamoDNS Architecture

## Overview

DynamoDNS is a comprehensive web-based dynamic DNS management platform that offers advanced infrastructure control, monitoring, and multi-provider integration. The application focuses on user experience and security while providing a robust solution for maintaining DNS records across multiple providers.

## System Architecture

The system is built on a modern web stack with the following components:

### Backend
- **Express.js Server**: Handles API requests, authentication, and business logic
- **PostgreSQL Database**: Provides robust data storage using the Neon serverless Postgres service
- **Drizzle ORM**: Manages database interactions and schema definition
- **Authentication System**: Supports multiple authentication methods (local, LDAP, OIDC)
- **DNS Provider Modules**: Integrates with various DNS providers (Cloudflare, AWS Route53, GoDaddy, etc.)

### Frontend
- **React**: Powers the user interface
- **TanStack Query**: Manages data fetching and caching
- **Shadcn UI**: Provides consistent, accessible UI components
- **Tailwind CSS**: Handles styling with utility-first approach
- **Wouter**: Manages client-side routing

## Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Browser                          │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                       Express Server                         │
│                                                             │
│  ┌─────────────────┐    ┌──────────────┐    ┌────────────┐  │
│  │ Authentication  │    │  API Routes   │    │ WebSockets │  │
│  └─────────────────┘    └──────────────┘    └────────────┘  │
│                                                             │
│  ┌─────────────────┐    ┌──────────────┐    ┌────────────┐  │
│  │ Storage Layer   │    │ DNS Provider │    │ Metrics    │  │
│  └────────┬────────┘    │  Modules     │    │ Collection │  │
│           │             └──────┬───────┘    └────────────┘  │
└───────────┼──────────────────────────────────────────────────┘
            │                    │
┌───────────▼────────┐  ┌────────▼───────────────────────────┐
│  PostgreSQL DB     │  │       External DNS APIs            │
│  (via Drizzle ORM) │  │ (Cloudflare, Route53, GoDaddy)     │
└────────────────────┘  └────────────────────────────────────┘
```

## Database Schema

The database schema is defined using Drizzle ORM and includes the following main entities:

- **Users**: Application users with authentication details
- **Customers**: Organizations/accounts using the system
- **Customer User Assignments**: Many-to-many relationship connecting users to customers
- **Providers**: DNS service providers integrated with the system
- **Domains**: DNS domains managed by the system
- **DNS Records**: Individual DNS records within domains
- **DNS History**: Historical record of DNS changes
- **Metrics**: Performance and usage metrics
- **API Tokens**: Tokens for API authentication
- **Webhooks**: Notification integration points

## Authentication Flow

The application supports multiple authentication methods:

1. **Local Authentication**: Username/password stored in the database
2. **LDAP**: Integration with corporate directories
3. **OpenID Connect**: Single sign-on with identity providers

Authentication is managed via Passport.js with session-based authentication for the web interface and token-based authentication for API access.

## Authorization Model

The system implements a role-based access control (RBAC) model with the following roles:

- **Admin**: Full system access
- **Manager**: Can manage customers, domains, and DNS records
- **User**: Can manage assigned domains and DNS records
- **ReadOnly**: View-only access to assigned resources
- **Custom Roles**: User-defined roles with specific permissions

## Data Flow

### DNS Record Updates

1. User initiates a DNS record update through the UI
2. Server validates the request and user permissions
3. Server dispatches the update to the appropriate DNS provider module
4. Provider module makes API calls to the external DNS service
5. Results are recorded in the database (success or failure)
6. Historical entry is created
7. Metrics are updated
8. Webhooks are triggered (if configured)
9. Client is notified of the outcome

### Automatic IP Updates

For dynamic DNS functionality:

1. Client periodically checks for IP changes
2. When a change is detected, updates are sent to the server
3. Server processes updates for all DNS records configured for automatic IP updates
4. External DNS providers are updated
5. History and metrics are recorded

## Security Considerations

- **Authentication**: Multiple secure authentication methods
- **Authorization**: Granular role-based access control
- **API Tokens**: Scoped access with expiration
- **Audit Trail**: Comprehensive history logging
- **Credential Storage**: Secure storage of provider credentials
- **Input Validation**: Strict validation of all inputs
- **Rate Limiting**: Protection against abuse