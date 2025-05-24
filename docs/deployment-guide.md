# DynamoDNS Deployment Guide

This guide outlines the steps required to deploy and configure DynamoDNS in your environment.

## System Requirements

### Minimum Requirements

- **Node.js**: v18.0.0 or higher
- **PostgreSQL**: v14.0 or higher (or Neon serverless database)
- **Operating System**: Any OS that supports Node.js (Linux recommended for production)
- **Memory**: 1GB RAM minimum (2GB+ recommended)
- **Storage**: 1GB for application, database size depends on usage

### Recommended Production Setup

- **Node.js**: Latest LTS version
- **PostgreSQL**: Latest stable version
- **Operating System**: Linux (Ubuntu 22.04 LTS or similar)
- **Memory**: 4GB RAM
- **Storage**: 10GB SSD
- **Web Server**: Nginx as a reverse proxy
- **SSL Certificate**: Let's Encrypt or similar

## Installation

### Option 1: Docker Deployment (Recommended)

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/dynamodns.git
   cd dynamodns
   ```

2. **Configure environment variables**:
   Create a `.env` file based on the `.env.example` template:
   ```bash
   cp .env.example .env
   nano .env  # Edit with your configuration
   ```

3. **Build and start the containers**:
   ```bash
   docker-compose up -d
   ```

4. **Run database migrations**:
   ```bash
   docker-compose exec app npm run db:push
   ```

5. **Create initial admin user** (if not using the automated setup):
   ```bash
   docker-compose exec app npm run create-admin
   ```

### Option 2: Manual Deployment

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/dynamodns.git
   cd dynamodns
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   Create a `.env` file with your configuration:
   ```
   # Database configuration
   DATABASE_URL=postgresql://user:password@localhost:5432/dynamodns

   # Server configuration
   PORT=5000
   NODE_ENV=production
   SESSION_SECRET=your_secure_session_secret

   # Authentication configuration
   ENABLE_REGISTRATION=false
   
   # Optional: LDAP configuration
   LDAP_ENABLED=false
   LDAP_URL=ldap://ldap.example.com
   LDAP_BIND_DN=cn=admin,dc=example,dc=com
   LDAP_BIND_PASSWORD=password
   LDAP_SEARCH_BASE=ou=users,dc=example,dc=com
   LDAP_SEARCH_FILTER=(uid={{username}})
   
   # Optional: OpenID Connect configuration
   OIDC_ENABLED=false
   OIDC_ISSUER=https://auth.example.com
   OIDC_CLIENT_ID=your_client_id
   OIDC_CLIENT_SECRET=your_client_secret
   OIDC_CALLBACK_URL=https://dynamodns.example.com/api/auth/oidc/callback
   ```

4. **Run database migrations**:
   ```bash
   npm run db:push
   ```

5. **Build the application**:
   ```bash
   npm run build
   ```

6. **Start the application**:
   ```bash
   npm start
   ```

## Configuration Options

### Database Configuration

- **DATABASE_URL**: Connection string for PostgreSQL

### Server Configuration

- **PORT**: The port on which the server will listen (default: 5000)
- **NODE_ENV**: Environment (development/production)
- **HOST**: Host to bind to (default: 0.0.0.0)
- **SESSION_SECRET**: Secret for session encryption (generate a secure random string)

### Authentication Configuration

- **ENABLE_REGISTRATION**: Allow new user registration (true/false)
- **DEFAULT_ADMIN_USERNAME**: Username for the default admin (default: admin)
- **DEFAULT_ADMIN_PASSWORD**: Password for the default admin (set this for initial setup)
- **DEFAULT_ADMIN_EMAIL**: Email for the default admin (default: admin@example.com)

### LDAP Configuration (Optional)

- **LDAP_ENABLED**: Enable LDAP authentication (true/false)
- **LDAP_URL**: LDAP server URL
- **LDAP_BIND_DN**: DN for binding to LDAP
- **LDAP_BIND_PASSWORD**: Password for binding to LDAP
- **LDAP_SEARCH_BASE**: Base DN for user search
- **LDAP_SEARCH_FILTER**: Filter for finding users (use {{username}} as placeholder)
- **LDAP_USER_ATTR_USERNAME**: LDAP attribute for username (default: uid)
- **LDAP_USER_ATTR_EMAIL**: LDAP attribute for email (default: mail)
- **LDAP_USER_ATTR_DISPLAY_NAME**: LDAP attribute for display name (default: cn)

### OpenID Connect Configuration (Optional)

- **OIDC_ENABLED**: Enable OIDC authentication (true/false)
- **OIDC_ISSUER**: OIDC issuer URL
- **OIDC_CLIENT_ID**: Client ID for OIDC
- **OIDC_CLIENT_SECRET**: Client secret for OIDC
- **OIDC_CALLBACK_URL**: Callback URL for OIDC authentication
- **OIDC_SCOPE**: Scopes to request (default: "openid profile email")

## DNS Provider Configuration

DynamoDNS supports multiple DNS providers. Each requires specific configuration:

### Cloudflare

Required credentials:
- API Token or API Key + Email
- Zone IDs (optional, can be fetched automatically)

### AWS Route53

Required credentials:
- Access Key ID
- Secret Access Key
- Region

### GoDaddy

Required credentials:
- API Key
- API Secret

### Generic Provider

For custom or unsupported providers:
- API URL
- Authentication method
- Request format

## Setting Up Reverse Proxy

For production deployments, it's recommended to use a reverse proxy like Nginx or Apache.

### Nginx Configuration Example

```nginx
server {
    listen 80;
    server_name dynamodns.example.com;
    
    # Redirect to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name dynamodns.example.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers 'ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';
    
    # Proxy to Node.js application
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Database Backup and Maintenance

### Automated Backups

For PostgreSQL:

```bash
# Add to crontab for daily backups
0 2 * * * pg_dump -U username -d dynamodns > /path/to/backup/dynamodns_$(date +\%Y\%m\%d).sql
```

For Neon PostgreSQL:
- Enable automated backups through the Neon dashboard
- Set an appropriate backup schedule and retention policy

### Database Maintenance

Regular maintenance tasks:

```bash
# Vacuum the database to optimize performance
psql -U username -d dynamodns -c "VACUUM ANALYZE;"

# Check for slow queries
psql -U username -d dynamodns -c "SELECT * FROM pg_stat_activity WHERE state = 'active';"
```

## System Monitoring

### Health Check Endpoint

The application provides a health check endpoint at `/api/health` that returns:
- Application status
- Database connectivity
- DNS provider connectivity

### Recommended Monitoring Tools

- **Uptime Monitoring**: Pingdom, UptimeRobot, or similar
- **Application Monitoring**: New Relic, Datadog, or similar
- **Log Management**: ELK Stack, Graylog, or similar

## Security Considerations

### Securing Your Deployment

1. **Use HTTPS**: Always use SSL/TLS in production
2. **Firewall Configuration**: Restrict access to the server
3. **Regular Updates**: Keep all dependencies up to date
4. **Secure Credentials**: Use environment variables, not hardcoded values
5. **Rate Limiting**: Configure rate limiting to prevent abuse

### Data Protection

1. **Encryption**: Sensitive data is encrypted in the database
2. **Backups**: Regular encrypted backups
3. **Access Control**: Implement least privilege principle
4. **Audit Logs**: Monitor and review access logs

## Upgrading

### Standard Upgrade Process

1. **Backup your data**:
   ```bash
   pg_dump -U username -d dynamodns > /path/to/backup/dynamodns_before_upgrade.sql
   ```

2. **Pull the latest changes**:
   ```bash
   git pull origin main
   ```

3. **Install dependencies**:
   ```bash
   npm install
   ```

4. **Run database migrations**:
   ```bash
   npm run db:push
   ```

5. **Rebuild the application**:
   ```bash
   npm run build
   ```

6. **Restart the service**:
   ```bash
   # If using systemd
   sudo systemctl restart dynamodns
   
   # If using PM2
   pm2 restart dynamodns
   ```

### Docker Upgrade Process

1. **Pull the latest image**:
   ```bash
   docker-compose pull
   ```

2. **Restart the containers**:
   ```bash
   docker-compose down
   docker-compose up -d
   ```

3. **Run migrations**:
   ```bash
   docker-compose exec app npm run db:push
   ```

## Troubleshooting

### Common Issues

1. **Database Connection Errors**:
   - Check DATABASE_URL environment variable
   - Verify network connectivity and firewall rules
   - Ensure PostgreSQL is running

2. **Authentication Issues**:
   - Verify SESSION_SECRET is set
   - Check LDAP/OIDC configuration if using external authentication

3. **DNS Provider Integration Errors**:
   - Verify API credentials for the DNS provider
   - Check for rate limiting or IP restrictions

### Logs

Access logs for troubleshooting:

```bash
# Application logs
tail -f logs/app.log

# In Docker
docker-compose logs -f app
```

### Getting Support

If you encounter issues not covered in this documentation:

1. Check the GitHub repository issues
2. Create a new issue with detailed information about your problem
3. Contact commercial support if you have a support agreement