import { pgTable, text, uuid, integer, serial, boolean, timestamp, jsonb, foreignKey, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Users & Authentication
export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  fullName: text("full_name"),
  role: text("role").default("user").notNull(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ one }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
}));

// We'll define this after all tables are declared

// DNS Management
export const providers = pgTable("providers", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  credentials: jsonb("credentials"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const domains = pgTable("domains", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  providerId: uuid("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }),
  isActive: boolean("is_active").default(true).notNull(),
  lastUpdated: timestamp("last_updated"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
  isAutoIP: boolean("auto_update").default(false).notNull(), // renamed to match database column
  proxied: boolean("proxied").default(false), // For Cloudflare proxy setting
  lastUpdated: timestamp("last_updated"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const dnsHistory = pgTable("dns_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  recordId: uuid("record_id").notNull().references(() => dnsRecords.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  previousValue: text("previous_value"),
  newValue: text("new_value"),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// API Tokens
export const apiTokens = pgTable("api_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  token: text("token").notNull().unique(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  permissions: text("permissions").array(),
  role: text("role").default("readonly").notNull(), // Adding explicit role like users have
  createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
});

// Webhooks
export const webhooks = pgTable("webhooks", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  secret: text("secret"),
  events: text("events").array().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  lastTriggered: timestamp("last_triggered"),
  createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Webhook delivery logs for tracking delivery status and history
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

// Performance metrics for historical data and trends
export const dnsMetrics = pgTable("dns_metrics", {
  id: uuid("id").defaultRandom().primaryKey(),
  domainId: uuid("domain_id").references(() => domains.id, { onDelete: "cascade" }),
  recordId: uuid("record_id").references(() => dnsRecords.id, { onDelete: "cascade" }),
  metricType: text("metric_type").notNull(), // response_time, uptime, propagation, etc.
  value: jsonb("value").notNull(), // Flexible metric value storage
  source: text("source"), // Source of the metric (provider, third-party, etc.)
  tags: text("tags").array(), // For additional filtering/grouping
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// Custom roles table for user-defined roles beyond system defaults
export const customRoles = pgTable("custom_roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  permissions: text("permissions").array().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "set null" }),
});

// Note: Groups, GroupMembers, and GroupRoles tables have been removed in this version

// Schema Validation
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  fullName: true,
  role: true,
  organizationId: true,
});

export const insertOrganizationSchema = createInsertSchema(organizations).pick({
  name: true,
  isActive: true,
});

export const insertDomainSchema = createInsertSchema(domains)
  .pick({
    name: true,
    organizationId: true,
    providerId: true,
    isActive: true,
  })
  .extend({
    // Override providerId to make it optional
    providerId: z.string().uuid().optional(),
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
  credentials: true,
  isActive: true,
});

// Make all fields optional for maximum flexibility
export const insertApiTokenSchema = z.object({
  name: z.string().optional(),
  token: z.string().optional(),
  organizationId: z.string().optional(),
  permissions: z.array(z.string()).optional(),
  role: z.string().optional(),
  createdBy: z.string().optional(),
  isActive: z.boolean().optional(),
  expiresAt: z.union([z.date(), z.string()]).optional(),
  // Allow custom expiration fields
  expiresIn: z.string().optional(),
  customDate: z.string().optional(),
  customTime: z.string().optional(),
});

export const insertCustomRoleSchema = createInsertSchema(customRoles).pick({
  name: true,
  description: true,
  permissions: true,
  isActive: true,
  createdBy: true,
});

// Note: Group-related insert schemas have been removed in this version

export const insertWebhookSchema = createInsertSchema(webhooks).pick({
  name: true,
  url: true,
  organizationId: true,
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

export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizations.$inferSelect;

export type InsertDomain = z.infer<typeof insertDomainSchema>;
export type Domain = typeof domains.$inferSelect;

export type InsertDnsRecord = z.infer<typeof insertDnsRecordSchema>;
export type DnsRecord = typeof dnsRecords.$inferSelect & {
  // Runtime property added by the API - not stored in database
  currentIp?: string;
};

export type InsertProvider = z.infer<typeof insertProviderSchema>;
export type Provider = typeof providers.$inferSelect;

export type InsertApiToken = z.infer<typeof insertApiTokenSchema>;
export type ApiToken = typeof apiTokens.$inferSelect;

export type DnsHistory = typeof dnsHistory.$inferSelect;
export type DnsMetric = typeof dnsMetrics.$inferSelect;
export type CustomRole = typeof customRoles.$inferSelect;

// Note: Group-related types have been removed in this version
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

// Define member types (group type removed)
export const memberTypes = ['user', 'organization'] as const;
export type MemberType = typeof memberTypes[number];

// Provider Types
export const providerTypes = ['cloudflare', 'route53', 'godaddy', 'other'] as const;
export type ProviderType = typeof providerTypes[number];

// DNS Record Types
export const recordTypes = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV', 'NS', 'CAA', 'PTR'] as const;
export type RecordType = typeof recordTypes[number];

// Define table relations
export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  domains: many(domains),
  apiTokens: many(apiTokens),
  webhooks: many(webhooks),
}));

export const domainsRelations = relations(domains, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [domains.organizationId],
    references: [organizations.id],
  }),
  provider: one(providers, {
    fields: [domains.providerId],
    references: [providers.id],
  }),
  dnsRecords: many(dnsRecords),
}));

export const dnsRecordsRelations = relations(dnsRecords, ({ one, many }) => ({
  domain: one(domains, {
    fields: [dnsRecords.domainId],
    references: [domains.id],
  }),
  // Provider is now referenced through the domain, not directly
  history: many(dnsHistory),
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

export const apiTokensRelations = relations(apiTokens, ({ one }) => ({
  organization: one(organizations, {
    fields: [apiTokens.organizationId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [apiTokens.createdBy],
    references: [users.id],
  }),
}));

export const webhooksRelations = relations(webhooks, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [webhooks.organizationId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [webhooks.createdBy],
    references: [users.id],
  }),
  deliveryLogs: many(webhookDeliveryLogs),
}));

export const webhookDeliveryLogsRelations = relations(webhookDeliveryLogs, ({ one }) => ({
  webhook: one(webhooks, {
    fields: [webhookDeliveryLogs.webhookId],
    references: [webhooks.id],
  }),
}));


// Custom roles relations
export const customRolesRelations = relations(customRoles, ({ one }) => ({
  creator: one(users, {
    fields: [customRoles.createdBy],
    references: [users.id],
  }),
}));

// Note: Group-related relations have been removed in this version
