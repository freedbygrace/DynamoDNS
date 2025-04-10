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
  proxied: boolean("proxied").default(false),
  isActive: boolean("is_active").default(true).notNull(),
  isAutoIP: boolean("is_auto_ip").default(false).notNull(),
  notes: text("notes"),
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
  createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
});

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

export const insertDomainSchema = createInsertSchema(domains).pick({
  name: true,
  organizationId: true,
  providerId: true,
  isActive: true,
});

export const insertDnsRecordSchema = createInsertSchema(dnsRecords).pick({
  domainId: true,
  name: true,
  type: true,
  content: true,
  ttl: true,
  proxied: true,
  isActive: true,
  isAutoIP: true,
  notes: true,
});

export const insertProviderSchema = createInsertSchema(providers).pick({
  name: true,
  type: true,
  credentials: true,
  isActive: true,
});

export const insertApiTokenSchema = createInsertSchema(apiTokens).pick({
  name: true,
  token: true,
  organizationId: true,
  permissions: true,
  createdBy: true,
  isActive: true,
  expiresAt: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizations.$inferSelect;

export type InsertDomain = z.infer<typeof insertDomainSchema>;
export type Domain = typeof domains.$inferSelect;

export type InsertDnsRecord = z.infer<typeof insertDnsRecordSchema>;
export type DnsRecord = typeof dnsRecords.$inferSelect;

export type InsertProvider = z.infer<typeof insertProviderSchema>;
export type Provider = typeof providers.$inferSelect;

export type InsertApiToken = z.infer<typeof insertApiTokenSchema>;
export type ApiToken = typeof apiTokens.$inferSelect;

export type DnsHistory = typeof dnsHistory.$inferSelect;

// Role Types
export const userRoles = ['admin', 'manager', 'user', 'readonly'] as const;
export type UserRole = typeof userRoles[number];

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
