# DynamoDNS Development Guide

This guide provides information for developers who want to contribute to the DynamoDNS project or extend its functionality.

## Development Setup

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v8.0.0 or higher
- **PostgreSQL**: v14.0 or higher (or Neon serverless database)
- **Git**: Latest version

### Getting Started

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/dynamodns.git
   cd dynamodns
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   Create a `.env` file based on the `.env.example` template:
   ```
   # Database - Use a local PostgreSQL instance for development
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/dynamodns_dev
   
   # Server
   PORT=5000
   NODE_ENV=development
   SESSION_SECRET=dev_session_secret
   
   # Auth - Enable registration for easier testing
   ENABLE_REGISTRATION=true
   ```

4. **Set up the database**:
   ```bash
   # Create the database
   createdb dynamodns_dev
   
   # Run migrations
   npm run db:push
   ```

5. **Start the development server**:
   ```bash
   npm run dev
   ```

6. **Access the application**:
   Open your browser and navigate to http://localhost:5000

## Project Structure

```
dynamodns/
├── client/                  # Frontend React application
│   ├── src/                 # Source code
│   │   ├── components/      # Reusable UI components
│   │   ├── context/         # React context providers
│   │   ├── hooks/           # Custom React hooks
│   │   ├── lib/             # Utility functions
│   │   ├── pages/           # Page components
│   │   └── App.tsx          # Main application component
├── docs/                    # Documentation
├── migrations/              # Database migration files
├── server/                  # Backend Express application
│   ├── providers/           # DNS provider integrations
│   ├── utils/               # Utility functions
│   ├── auth.ts              # Authentication logic
│   ├── db.ts                # Database connection
│   ├── index.ts             # Application entry point
│   ├── routes.ts            # API routes
│   ├── storage.ts           # Storage interface
│   └── vite.ts              # Vite integration
├── shared/                  # Shared code between client and server
│   └── schema.ts            # Database schema with Drizzle ORM
└── various config files     # Configuration files for the project
```

## Technology Stack

### Backend

- **Express.js**: Web server framework
- **Drizzle ORM**: Database ORM for TypeScript
- **PostgreSQL**: Relational database
- **Passport.js**: Authentication middleware
- **WebSockets**: Real-time communication

### Frontend

- **React**: UI library
- **TanStack Query**: Data fetching and caching
- **Shadcn UI**: Component library built on Radix UI
- **Tailwind CSS**: Utility-first CSS framework
- **Wouter**: Lightweight routing
- **Zod**: Schema validation
- **React Hook Form**: Form handling

## Architecture

### Frontend Architecture

The frontend follows a component-based architecture with React:

- **Context Providers**: Manage global state (auth, customer, theme)
- **Hooks**: Custom hooks for data fetching and business logic
- **Pages**: Top-level components for different routes
- **Components**: Reusable UI building blocks

Data flow utilizes TanStack Query for client-side data fetching and caching:

```javascript
// Example query
const { data, isLoading, error } = useQuery({
  queryKey: ['/api/domains'],
  enabled: !!user
});

// Example mutation
const mutation = useMutation({
  mutationFn: async (data) => {
    const res = await apiRequest('POST', '/api/domains', data);
    return await res.json();
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/domains'] });
    // Handle success
  },
  onError: (error) => {
    // Handle error
  }
});
```

### Backend Architecture

The backend follows a layered architecture:

1. **Routes Layer**: API endpoints and request handling
2. **Service Layer**: Business logic
3. **Data Access Layer**: Database interactions via Drizzle ORM
4. **Provider Layer**: Integrations with external DNS services

The application uses a storage interface pattern to abstract database operations:

```typescript
// Example storage interface method
async getUser(id: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user || undefined;
}
```

## Adding Features

### Adding a New DNS Provider

1. **Create a provider module**:
   Create a new file in `server/providers/` directory (e.g., `cloudflare.ts`).

2. **Implement the provider interface**:
   ```typescript
   import { DNSProvider, DNSRecord, DNSProviderError } from './types';

   export class CloudflareProvider implements DNSProvider {
     constructor(private credentials: any) {
       // Initialize with provider credentials
     }

     async createRecord(record: DNSRecord): Promise<string> {
       // Implementation
     }

     async updateRecord(recordId: string, record: DNSRecord): Promise<void> {
       // Implementation
     }

     async deleteRecord(recordId: string): Promise<void> {
       // Implementation
     }

     async getRecord(recordId: string): Promise<DNSRecord> {
       // Implementation
     }
   }
   ```

3. **Register the provider**:
   Add the provider to the provider factory in `server/providers/index.ts`.

### Adding a New API Endpoint

1. **Create the route handler**:
   Add your endpoint to `server/routes.ts`:

   ```typescript
   app.get('/api/your-endpoint', (req, res) => {
     // Implementation
   });
   ```

2. **Add validation**:
   Use Zod to validate request inputs:

   ```typescript
   const schema = z.object({
     name: z.string().min(1),
     // Other fields
   });

   app.post('/api/your-endpoint', (req, res) => {
     const result = schema.safeParse(req.body);
     if (!result.success) {
       return res.status(400).json({ errors: result.error.format() });
     }
     
     // Implementation with validated data
     const data = result.data;
   });
   ```

3. **Use the storage interface**:
   Interact with the database using the storage interface:

   ```typescript
   app.get('/api/your-endpoint/:id', async (req, res) => {
     try {
       const item = await storage.getItem(req.params.id);
       if (!item) {
         return res.status(404).json({ message: 'Not found' });
       }
       res.json(item);
     } catch (error) {
       res.status(500).json({ message: 'Server error' });
     }
   });
   ```

### Adding a New UI Component

1. **Create the component**:
   Create a new file in the appropriate directory under `client/src/components/`.

2. **Implement the component**:
   ```tsx
   import React from 'react';
   import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

   interface MyComponentProps {
     title: string;
     children: React.ReactNode;
   }

   export function MyComponent({ title, children }: MyComponentProps) {
     return (
       <Card>
         <CardHeader>
           <CardTitle>{title}</CardTitle>
         </CardHeader>
         <CardContent>
           {children}
         </CardContent>
       </Card>
     );
   }
   ```

3. **Use the component**:
   Import and use your component in a page or another component.

## Database Schema Management

The project uses Drizzle ORM with a schema defined in `shared/schema.ts`.

### Adding a New Table

1. **Define the table**:
   ```typescript
   export const myNewTable = pgTable('my_new_table', {
     id: text('id').primaryKey().defaultRandom(),
     name: text('name').notNull(),
     createdAt: timestamp('created_at').defaultNow().notNull(),
     customerId: text('customer_id').references(() => customers.id, { onDelete: 'cascade' }),
   });
   ```

2. **Define relations**:
   ```typescript
   export const myNewTableRelations = relations(myNewTable, ({ one }) => ({
     customer: one(customers, {
       fields: [myNewTable.customerId],
       references: [customers.id],
     }),
   }));
   ```

3. **Create insert schema and types**:
   ```typescript
   export const insertMyNewTableSchema = createInsertSchema(myNewTable).pick({
     name: true,
     customerId: true,
   });

   export type InsertMyNewTable = z.infer<typeof insertMyNewTableSchema>;
   export type MyNewTable = typeof myNewTable.$inferSelect;
   ```

4. **Update the storage interface**:
   Add methods to `server/storage.ts` for CRUD operations on your new table.

5. **Push the schema changes**:
   ```bash
   npm run db:push
   ```

## Testing

### Unit Tests

The project uses Jest for unit testing:

```bash
# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- src/path/to/test.test.ts
```

### Writing Tests

Example test for a utility function:

```typescript
// src/utils/formatDate.test.ts
import { formatDate } from './formatDate';

describe('formatDate', () => {
  it('formats a date correctly', () => {
    const date = new Date('2023-01-01T12:00:00Z');
    expect(formatDate(date)).toBe('Jan 1, 2023');
  });

  it('handles null values', () => {
    expect(formatDate(null)).toBe('');
  });
});
```

Example test for a React component using React Testing Library:

```typescript
// src/components/Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renders correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### API Testing

For API endpoints, use Supertest:

```typescript
// src/routes/domains.test.ts
import request from 'supertest';
import { app } from '../app';
import { db } from '../db';

describe('Domains API', () => {
  beforeEach(async () => {
    // Set up test data
  });

  afterEach(async () => {
    // Clean up test data
  });

  it('GET /api/domains returns domains', async () => {
    const response = await request(app)
      .get('/api/domains')
      .set('Authorization', `Bearer ${testToken}`);
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
  });
});
```

## Code Style and Linting

The project uses ESLint and Prettier for code style and linting:

```bash
# Run ESLint
npm run lint

# Fix ESLint issues
npm run lint:fix

# Format code with Prettier
npm run format
```

### Commit Guidelines

We follow the Conventional Commits specification:

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Changes that do not affect the meaning of the code
- `refactor`: Code changes that neither fix a bug nor add a feature
- `perf`: Performance improvements
- `test`: Adding or fixing tests
- `chore`: Changes to the build process or auxiliary tools

Example:
```
feat(dns-records): add support for SRV records
```

## Debugging

### Server-side Debugging

Add logging with debug statements:

```typescript
import debug from 'debug';

const log = debug('dynamodns:server');

app.get('/api/domains', (req, res) => {
  log('Fetching domains for user', req.user?.id);
  // Implementation
});
```

Run the application with debug enabled:

```bash
DEBUG=dynamodns:* npm run dev
```

### Client-side Debugging

Use React DevTools for component inspection and debugging.

For network debugging, use the browser's developer tools and the Network tab.

## Deployment

See the [Deployment Guide](./deployment-guide.md) for information on deploying the application.

## Contributing

1. **Fork the repository**
2. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes**
4. **Run tests**:
   ```bash
   npm test
   ```
5. **Commit your changes** following the commit guidelines
6. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```
7. **Create a Pull Request**

## Resources

- **Drizzle ORM Documentation**: [https://orm.drizzle.team/docs/overview](https://orm.drizzle.team/docs/overview)
- **React Documentation**: [https://react.dev/](https://react.dev/)
- **TanStack Query Documentation**: [https://tanstack.com/query/latest](https://tanstack.com/query/latest)
- **Shadcn UI Documentation**: [https://ui.shadcn.com/](https://ui.shadcn.com/)
- **Tailwind CSS Documentation**: [https://tailwindcss.com/docs](https://tailwindcss.com/docs)
- **Express.js Documentation**: [https://expressjs.com/](https://expressjs.com/)