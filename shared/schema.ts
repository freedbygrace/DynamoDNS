import { pgTable, text, uuid, integer, serial, boolean, timestamp, jsonb, foreignKey, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Users & Authentication - Independent of customers
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  fullName: text("full_name"),
  role: text("role").default("user").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Customers - Replaces organizations
export const customers = pgTable("customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Customer-User Assignment - Many-to-many relationship
export const customerUserAssignments = pgTable("customer_user_assignments", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").default("user").notNull(), // Role specific to this customer assignment
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  // Unique constraint to prevent duplicate assignments
  uniqueAssignment: unique().on(t.customerId, t.userId),
}));

// DNS Management - Providers are independent entities
export const providers = pgTable("providers", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Domains associated with customers
export const domains = pgTable("domains", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  providerId: uuid("provider_id").notNull().references(() => providers.id),
  isActive: boolean("is_active").default(true).notNull(),
  lastUpdated: timestamp("last_updated"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Domain credentials - each domain has its own API tokens and provider-specific credentials
export const domainCredentials = pgTable("domain_credentials", {
  id: uuid("id").defaultRandom().primaryKey(),
  domainId: uuid("domain_id").notNull().references(() => domains.id, { onDelete: "cascade" }),
  apiToken: text("api_token"), // Provider API token
  accountId: text("account_id"), // Provider account ID
  zoneId: text("zone_id"), // Provider zone ID (e.g., Cloudflare)
  otherCredentials: jsonb("other_credentials"), // Other provider-specific credentials
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// DNS records associated with domains
export const dnsRecords = pgTable("dns_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  domainId: uuid("domain_id").notNull().references(() => domains.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(),
  content: text("content").notNull(),
  ttl: integer("ttl").default(3600),
  priority: integer("priority"),
  providerRecordId: text("provider_record_id"),
  notes: text("notes"),
  isActive: boolean("is_active").default(true).notNull(),
  isAutoIP: boolean("auto_update").default(false).notNull(),
  proxied: boolean("proxied").default(false), // For Cloudflare proxy setting
  lastUpdated: timestamp("last_updated"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// DNS history for record changes
export const dnsHistory = pgTable("dns_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  recordId: uuid("record_id").notNull().references(() => dnsRecords.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  previousValue: text("previous_value"),
  newValue: text("new_value"),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// API Tokens for system access (not provider access)
export const apiTokens = pgTable("api_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  token: text("token").notNull().unique(),
  role: text("role").default("readonly").notNull(),
  createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
});

// API token customer access - for granular customer permissions
export const apiTokenCustomerAccess = pgTable("api_token_customer_access", {
  id: uuid("id").defaultRandom().primaryKey(),
  tokenId: uuid("token_id").notNull().references(() => apiTokens.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  // Unique constraint to prevent duplicate access
  uniqueAccess: unique().on(t.tokenId, t.customerId),
}));

// Webhooks associated with customers
export const webhooks = pgTable("webhooks", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  secret: text("secret"),
  events: text("events").array().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  lastTriggered: timestamp("last_triggered"),
  createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Webhook delivery logs
export const webhookDeliveryLogs = pgTable("webhook_delivery_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  webhookId: uuid("webhook_id").notNull().references(() => webhooks.id, { onDelete: "cascade" }),
  event: text("event").notNull(),
  payload: jsonb("payload").notNull(),
  signature: text("signature"),
  status: boolean("status").notNull(),
  statusCode: integer("status_code"),
  message: text("message").notNull(),
  responseBody: text("response_body"),
  retryCount: integer("retry_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Performance metrics
export const dnsMetrics = pgTable("dns_metrics", {
  id: uuid("id").defaultRandom().primaryKey(),
  domainId: uuid("domain_id").references(() => domains.id, { onDelete: "cascade" }),
  recordId: uuid("record_id").references(() => dnsRecords.id, { onDelete: "cascade" }),
  metricType: text("metric_type").notNull(),
  value: jsonb("value").notNull(),
  source: text("source"),
  tags: text("tags").array(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// Custom roles
export const customRoles = pgTable("custom_roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  permissions: text("permissions").array().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "set null" }),
});

// Schema Validation
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  fullName: true,
  role: true,
});

export const insertCustomerSchema = createInsertSchema(customers).pick({
  name: true,
  isActive: true,
});

export const insertCustomerUserAssignmentSchema = createInsertSchema(customerUserAssignments).pick({
  customerId: true,
  userId: true,
  role: true,
});

export const insertDomainSchema = createInsertSchema(domains)
  .pick({
    name: true,
    customerId: true,
    providerId: true,
    isActive: true,
  })
  .extend({
    // Override providerId to make it optional
    providerId: z.string().uuid().optional(),
  });

export const insertDomainCredentialsSchema = createInsertSchema(domainCredentials)
  .pick({
    domainId: true,
    apiToken: true,
    accountId: true,
    zoneId: true,
    otherCredentials: true,
    isActive: true,
  })
  .extend({
    // Make fields optional with proper types
    apiToken: z.string().optional(),
    accountId: z.string().optional(),
    zoneId: z.string().optional(),
    otherCredentials: z.record(z.unknown()).optional(),
  });

export const insertDnsRecordSchema = createInsertSchema(dnsRecords)
  .pick({
    domainId: true,
    name: true,
    type: true,
    content: true,
    ttl: true,
    isActive: true,
    isAutoIP: true,
    notes: true,
    priority: true,
    providerRecordId: true,
  })
  .extend({
    // Add proxied field for backward compatibility with frontend
    proxied: z.boolean().nullable().optional(),
    // Make priority optional with default value
    priority: z.number().optional().default(0),
    // Make provider record ID optional
    providerRecordId: z.string().nullable().optional(),
  });

export const insertProviderSchema = createInsertSchema(providers).pick({
  name: true,
  type: true,
  isActive: true,
});

// Make all fields optional for maximum flexibility
export const insertApiTokenSchema = z.object({
  name: z.string().optional(),
  token: z.string().optional(),
  role: z.string().optional(),
  createdBy: z.string().optional(),
  isActive: z.boolean().optional(),
  expiresAt: z.union([z.date(), z.string()]).optional(),
  // Allow custom expiration fields
  expiresIn: z.string().optional(),
  customDate: z.string().optional(),
  customTime: z.string().optional(),
  // Customer access array
  customerIds: z.array(z.string()).optional(),
});

export const insertApiTokenCustomerAccessSchema = createInsertSchema(apiTokenCustomerAccess).pick({
  tokenId: true,
  customerId: true,
});

export const insertCustomRoleSchema = createInsertSchema(customRoles).pick({
  name: true,
  description: true,
  permissions: true,
  isActive: true,
  createdBy: true,
});

export const insertWebhookSchema = createInsertSchema(webhooks).pick({
  name: true,
  url: true,
  customerId: true,
  secret: true,
  events: true,
  isActive: true,
  createdBy: true,
});

export const insertWebhookDeliveryLogSchema = createInsertSchema(webhookDeliveryLogs).pick({
  webhookId: true,
  event: true,
  payload: true,
  signature: true,
  status: true,
  statusCode: true,
  message: true,
  responseBody: true,
  retryCount: true,
});

export const insertDnsMetricSchema = createInsertSchema(dnsMetrics).pick({
  domainId: true,
  recordId: true,
  metricType: true,
  value: true,
  source: true,
  tags: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;

export type InsertCustomerUserAssignment = z.infer<typeof insertCustomerUserAssignmentSchema>;
export type CustomerUserAssignment = typeof customerUserAssignments.$inferSelect;

export type InsertDomain = z.infer<typeof insertDomainSchema>;
export type Domain = typeof domains.$inferSelect;

export type InsertDomainCredentials = z.infer<typeof insertDomainCredentialsSchema>;
export type DomainCredentials = typeof domainCredentials.$inferSelect;

export type InsertDnsRecord = z.infer<typeof insertDnsRecordSchema>;
export type DnsRecord = typeof dnsRecords.$inferSelect & {
  // Runtime property added by the API - not stored in database
  currentIp?: string;
};

export type InsertProvider = z.infer<typeof insertProviderSchema>;
export type Provider = typeof providers.$inferSelect;

export type InsertApiToken = z.infer<typeof insertApiTokenSchema>;
export type ApiToken = typeof apiTokens.$inferSelect;

export type InsertApiTokenCustomerAccess = z.infer<typeof insertApiTokenCustomerAccessSchema>;
export type ApiTokenCustomerAccess = typeof apiTokenCustomerAccess.$inferSelect;

export type DnsHistory = typeof dnsHistory.$inferSelect;
export type DnsMetric = typeof dnsMetrics.$inferSelect;
export type CustomRole = typeof customRoles.$inferSelect;

export type InsertCustomRole = z.infer<typeof insertCustomRoleSchema>;
export type InsertWebhook = z.infer<typeof insertWebhookSchema>;
export type Webhook = typeof webhooks.$inferSelect;
export type InsertWebhookDeliveryLog = z.infer<typeof insertWebhookDeliveryLogSchema>;
export type WebhookDeliveryLog = typeof webhookDeliveryLogs.$inferSelect;
export type InsertDnsMetric = z.infer<typeof insertDnsMetricSchema>;

// Role Types
// System default roles - these will still be available alongside custom roles
export const systemRoles = ['admin', 'manager', 'user', 'readonly'] as const;
export type SystemRole = typeof systemRoles[number];

// User roles can be system roles or custom roles
export type UserRole = SystemRole | string;

// Provider Types
export const providerTypes = ['cloudflare', 'route53', 'godaddy', 'other'] as const;
export type ProviderType = typeof providerTypes[number];

// DNS Record Types
export const recordTypes = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV', 'NS', 'CAA', 'PTR'] as const;
export type RecordType = typeof recordTypes[number];

// Define table relations
export const usersRelations = relations(users, ({ many }) => ({
  customerAssignments: many(customerUserAssignments),
  createdApiTokens: many(apiTokens, { relationName: "createdTokens" }),
  createdWebhooks: many(webhooks, { relationName: "createdWebhooks" }),
  createdCustomRoles: many(customRoles, { relationName: "createdRoles" }),
  dnsHistoryEntries: many(dnsHistory, { relationName: "historyEntries" }),
}));

export const customersRelations = relations(customers, ({ many }) => ({
  userAssignments: many(customerUserAssignments),
  domains: many(domains),
  tokenAccess: many(apiTokenCustomerAccess),
  webhooks: many(webhooks),
}));

export const customerUserAssignmentsRelations = relations(customerUserAssignments, ({ one }) => ({
  customer: one(customers, {
    fields: [customerUserAssignments.customerId],
    references: [customers.id],
  }),
  user: one(users, {
    fields: [customerUserAssignments.userId],
    references: [users.id],
  }),
}));

export const domainsRelations = relations(domains, ({ one, many }) => ({
  customer: one(customers, {
    fields: [domains.customerId],
    references: [customers.id],
  }),
  provider: one(providers, {
    fields: [domains.providerId],
    references: [providers.id],
  }),
  credentials: many(domainCredentials),
  dnsRecords: many(dnsRecords),
  metrics: many(dnsMetrics),
}));

export const domainCredentialsRelations = relations(domainCredentials, ({ one }) => ({
  domain: one(domains, {
    fields: [domainCredentials.domainId],
    references: [domains.id],
  }),
}));

export const dnsRecordsRelations = relations(dnsRecords, ({ one, many }) => ({
  domain: one(domains, {
    fields: [dnsRecords.domainId],
    references: [domains.id],
  }),
  history: many(dnsHistory),
  metrics: many(dnsMetrics),
}));

export const dnsHistoryRelations = relations(dnsHistory, ({ one }) => ({
  record: one(dnsRecords, {
    fields: [dnsHistory.recordId],
    references: [dnsRecords.id],
  }),
  user: one(users, {
    fields: [dnsHistory.userId],
    references: [users.id],
  }),
}));

export const dnsMetricsRelations = relations(dnsMetrics, ({ one }) => ({
  domain: one(domains, {
    fields: [dnsMetrics.domainId],
    references: [domains.id],
  }),
  record: one(dnsRecords, {
    fields: [dnsMetrics.recordId],
    references: [dnsRecords.id],
  }),
}));

export const providersRelations = relations(providers, ({ many }) => ({
  domains: many(domains),
}));

export const apiTokensRelations = relations(apiTokens, ({ one, many }) => ({
  creator: one(users, {
    fields: [apiTokens.createdBy],
    references: [users.id],
    relationName: "createdTokens",
  }),
  customerAccess: many(apiTokenCustomerAccess),
}));

export const apiTokenCustomerAccessRelations = relations(apiTokenCustomerAccess, ({ one }) => ({
  token: one(apiTokens, {
    fields: [apiTokenCustomerAccess.tokenId],
    references: [apiTokens.id],
  }),
  customer: one(customers, {
    fields: [apiTokenCustomerAccess.customerId],
    references: [customers.id],
  }),
}));

export const webhooksRelations = relations(webhooks, ({ one, many }) => ({
  customer: one(customers, {
    fields: [webhooks.customerId],
    references: [customers.id],
  }),
  creator: one(users, {
    fields: [webhooks.createdBy],
    references: [users.id],
    relationName: "createdWebhooks",
  }),
  deliveryLogs: many(webhookDeliveryLogs),
}));

export const webhookDeliveryLogsRelations = relations(webhookDeliveryLogs, ({ one }) => ({
  webhook: one(webhooks, {
    fields: [webhookDeliveryLogs.webhookId],
    references: [webhooks.id],
  }),
}));

export const customRolesRelations = relations(customRoles, ({ one }) => ({
  creator: one(users, {
    fields: [customRoles.createdBy],
    references: [users.id],
    relationName: "createdRoles",
  }),
}));
