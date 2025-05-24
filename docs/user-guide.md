# DynamoDNS User Guide

This guide provides detailed instructions for using the DynamoDNS platform to manage your DNS records across multiple providers.

## Getting Started

### Account Setup

1. **Login**: Access the application using your provided credentials at the login page.
2. **First-time Setup**: If this is your first time, you'll be prompted to create a new customer account.
3. **Dashboard**: After login, you'll be directed to the main dashboard showing your DNS records and metrics.

### Navigation

The main navigation menu includes:

- **Dashboard**: Overview of your DNS infrastructure
- **Domains**: Manage domain registrations
- **DNS Records**: Create and manage DNS records
- **History**: View historical changes to DNS records
- **Metrics**: Analyze performance and usage statistics
- **Webhooks**: Configure notification endpoints
- **API Tokens**: Manage access tokens for API usage
- **Settings**: Configure user and customer settings

## Managing Customers

Customers represent organizations that own domains in the system. Each customer can have multiple domains and users.

### Creating a Customer

1. Navigate to Settings → Customer tab
2. Click "Create New Customer"
3. Fill in the required information:
   - Customer Name (required)
   - Description (optional)
   - Contact Information (email, phone)
   - Address Information
   - Website and Industry
   - Notes and Account Manager
4. Click "Create Customer"

### Editing Customer Details

1. Navigate to Settings → Customer tab
2. Update the information as needed
3. Click "Save Changes"

### Switching Between Customers

Use the customer selector in the top navigation bar to switch between different customers you have access to.

## Managing Domains

Domains are the DNS zones that contain your DNS records.

### Adding a Domain

1. Navigate to the Domains page
2. Click "Add Domain"
3. Enter the domain name (e.g., example.com)
4. Select the DNS provider (Cloudflare, Route53, GoDaddy, etc.)
5. Enter necessary provider credentials (if not already configured)
6. Click "Add Domain"

### Managing Domain Settings

1. Navigate to the Domains page
2. Click on a domain to view its details
3. Use the "Edit" button to modify domain settings
4. Use the "Delete" button to remove the domain

## Managing DNS Records

DNS records define how domain names are mapped to resources on the internet.

### Adding a DNS Record

1. Navigate to the DNS Records page
2. Filter by domain if needed
3. Click "Add Record"
4. Select the record type (A, AAAA, CNAME, MX, TXT, etc.)
5. Enter the required fields:
   - Name: The subdomain or @ for the root domain
   - Content: The value for the record (IP address, hostname, text)
   - TTL: Time To Live in seconds
   - Priority: For MX and SRV records
6. Optional settings:
   - Enable "Auto IP" for dynamic DNS functionality
   - Enable "Proxied" for Cloudflare-specific features
   - Add notes for documentation
7. Click "Create Record"

### Editing DNS Records

1. Navigate to the DNS Records page
2. Click the "Edit" button for the record you want to modify
3. Update the record information
4. Click "Save Changes"

### Dynamic DNS Updates

For records with "Auto IP" enabled:

1. The system will automatically track your public IP address
2. When changes are detected, DNS records are updated automatically
3. The history of changes can be viewed on the History page

## Viewing History

The History page provides a complete audit trail of changes to your DNS records.

1. Navigate to the History page
2. Filter by domain, record, or date range
3. View details of each change including:
   - Previous value
   - New value
   - Timestamp
   - User who made the change

## Analyzing Metrics

The Metrics page provides insights into DNS performance and usage.

1. Navigate to the Metrics page
2. Select the time period for analysis
3. View metrics by:
   - Domain
   - Record type
   - Update frequency
   - Success/failure rates

## Configuring Webhooks

Webhooks allow external applications to receive notifications about DNS changes.

### Creating a Webhook

1. Navigate to the Webhooks page
2. Click "Add Webhook"
3. Configure the webhook:
   - Name: For identification
   - URL: The endpoint that will receive webhook data
   - Secret: Used to verify webhook authenticity
   - Events: Select which events trigger the webhook
4. Click "Create Webhook"

### Testing Webhooks

1. Navigate to the Webhooks page
2. Select a webhook
3. Click "Test Webhook"
4. View the delivery status and response

## Managing API Tokens

API tokens allow programmatic access to the DynamoDNS API.

### Creating an API Token

1. Navigate to the API Tokens page
2. Click "Create Token"
3. Configure the token:
   - Name: For identification
   - Expiration: When the token should expire
   - Access level: Which customers the token can access
   - Role: What permissions the token has
4. Click "Create Token"
5. Save the displayed token securely (it will only be shown once)

### Revoking API Tokens

1. Navigate to the API Tokens page
2. Click "Revoke" next to the token you want to disable
3. Confirm the action

## User Management

### Managing Your Account

1. Navigate to Settings → Account tab
2. Update your profile information
3. Change your password
4. Configure two-factor authentication (if available)

### Managing Users (Admin Only)

1. Navigate to Users & Roles page
2. View all users in the system
3. Create new users by clicking "Add User"
4. Edit user details by clicking "Edit"
5. Disable users by toggling the "Active" status

## Role Management

Roles determine what actions users can perform in the system.

### System Roles

- **Admin**: Complete access to all features
- **Manager**: Can manage customers, domains, and DNS records
- **User**: Can manage assigned domains and DNS records
- **ReadOnly**: View-only access to assigned resources

### Custom Roles (Admin Only)

1. Navigate to Users & Roles page
2. Click on the "Roles" tab
3. Click "Create Custom Role"
4. Configure permissions for the role
5. Assign users to the custom role

## Troubleshooting

### Common Issues

1. **DNS Propagation Delays**: DNS changes may take time to propagate (up to 48 hours, though typically much faster)
2. **Provider API Limitations**: Some DNS providers have rate limits or restrictions
3. **Authentication Errors**: Check your credentials for the DNS provider

### Getting Support

If you encounter issues:

1. Check the detailed error message
2. Review the documentation
3. Contact system administrators for assistance

## Best Practices

- Regularly review and clean up unused DNS records
- Use descriptive names and notes for records
- Set appropriate TTL values based on your needs
- Use API tokens with the minimum necessary permissions
- Regularly rotate API tokens for security
- Configure webhooks for important events to maintain awareness
- Review the history log periodically to audit changes