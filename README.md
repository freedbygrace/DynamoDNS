# DynamoDNS

A comprehensive web-based dynamic DNS management platform offering advanced infrastructure control, monitoring, and multi-provider integration with a focus on user experience and security.

![DynamoDNS Dashboard](docs/images/dashboard-preview.png)

## Features

- **Multi-Provider DNS Management**: Support for Cloudflare, AWS Route53, GoDaddy, and custom providers
- **Dynamic DNS Updates**: Automatic IP detection and DNS record updates
- **Role-Based Access Control**: Granular permissions with customizable roles
- **Customer Management**: Support for multiple organizations with isolated access
- **Historical Tracking**: Complete audit trail of DNS changes
- **Performance Metrics**: Visualize DNS performance and activity
- **API Integration**: RESTful API with token-based authentication
- **Webhook Notifications**: Real-time notifications for DNS events
- **Multi-Factor Authentication**: Enhanced security for user accounts
- **Customizable Dashboards**: Personalized monitoring views

## Technology Stack

- **Backend**:
  - Express.js for API server
  - PostgreSQL for robust data storage
  - Drizzle ORM for database interactions
  - Passport.js for multi-method authentication
  - WebSockets for real-time updates

- **Frontend**:
  - React for user interface
  - TanStack Query for data fetching and caching
  - Shadcn UI components for consistent design
  - Tailwind CSS for styling
  - Recharts for data visualization

## Getting Started

### Prerequisites

- Node.js (v18 or later)
- PostgreSQL (v14 or later)
- Modern web browser

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/dynamodns.git
   cd dynamodns
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables by creating a `.env` file:
   ```
   DATABASE_URL=postgresql://username:password@localhost:5432/dynamodns
   PORT=5000
   SESSION_SECRET=your_secure_secret
   ENABLE_REGISTRATION=false
   ```

4. Run database migrations:
   ```bash
   npm run db:push
   ```

5. Start the application:
   ```bash
   npm run dev
   ```

6. Access the application at http://localhost:5000

### Default Admin Account

On first launch, a default admin account is created:
- Username: `admin`
- Password: `admin`

**Important**: Change the default password immediately after first login.

## Documentation

Comprehensive documentation is available in the `/docs` directory:

- [User Guide](docs/user-guide.md) - For end users managing DNS records
- [API Reference](docs/api-reference.md) - For developers integrating with the API
- [Deployment Guide](docs/deployment-guide.md) - For system administrators
- [Development Guide](docs/development-guide.md) - For contributors
- [Architecture](docs/architecture.md) - System design and architecture overview

## Deployment

DynamoDNS can be deployed in various environments:

- **Standalone Server**: Direct installation on Linux/Windows servers
- **Docker**: Container-based deployment with Docker Compose
- **Cloud Platforms**: Deploy to AWS, Azure, Google Cloud, or other providers

See the [Deployment Guide](docs/deployment-guide.md) for detailed instructions.

## Contributing

We welcome contributions from the community! Please see our [Development Guide](docs/development-guide.md) for information on getting started with development.

To contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support or questions, please [open an issue](https://github.com/yourusername/dynamodns/issues) on GitHub, or contact the maintainers directly.

## Acknowledgements

- The open source community for the amazing tools that make this project possible
- Contributors who have helped improve and maintain this project
- Users who have provided feedback and feature suggestions