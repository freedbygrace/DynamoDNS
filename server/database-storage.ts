import { 
  users, organizations, domains, dnsRecords, 
  providers, dnsHistory, apiTokens, webhooks, webhookDeliveryLogs, dnsMetrics,
  type User, type InsertUser, 
  type Organization, type InsertOrganization,
  type Domain, type InsertDomain,
  type DnsRecord, type InsertDnsRecord,
  type Provider, type InsertProvider,
  type ApiToken, type InsertApiToken,
  type DnsHistory, type Webhook, type InsertWebhook,
  type WebhookDeliveryLog, type InsertWebhookDeliveryLog,
  type DnsMetric, type InsertDnsMetric
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, or, inArray, sql } from "drizzle-orm";
import { IStorage } from "./storage";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export class DatabaseStorage implements IStorage {
  public sessionStore: any;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
  }

  // User management
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async updateUser(id: string, userData: Partial<InsertUser>): Promise<User | undefined> {
    const [updatedUser] = await db.update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }

  // Organization management
  async getOrganization(id: string): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
    return org;
  }

  async getOrganizations(): Promise<Organization[]> {
    return await db.select().from(organizations);
  }

  async createOrganization(org: InsertOrganization): Promise<Organization> {
    const [newOrg] = await db.insert(organizations).values(org).returning();
    return newOrg;
  }

  async updateOrganization(id: string, orgData: Partial<InsertOrganization>): Promise<Organization | undefined> {
    const [updatedOrg] = await db.update(organizations)
      .set(orgData)
      .where(eq(organizations.id, id))
      .returning();
    return updatedOrg;
  }

  async deleteOrganization(id: string): Promise<boolean> {
    const result = await db.delete(organizations).where(eq(organizations.id, id)).returning();
    return result.length > 0;
  }

  // Domain management
  async getDomain(id: string): Promise<Domain | undefined> {
    try {
      // Use raw SQL to avoid schema mismatches
      const result = await db.execute(sql`
        SELECT 
          id, 
          name, 
          organization_id as "organizationId", 
          provider_id as "providerId",
          is_active as "isActive", 
          created_at as "createdAt"
        FROM domains 
        WHERE id = ${id}
        LIMIT 1
      `);
      
      if (!result.rows || result.rows.length === 0) {
        return undefined;
      }
      
      const row = result.rows[0];
      
      // Map to Domain type with expected fields
      return {
        id: row.id as string,
        name: row.name as string,
        organizationId: row.organizationId as string,
        isActive: Boolean(row.isActive),
        createdAt: row.createdAt ? new Date(row.createdAt as string) : new Date(),
        providerId: row.providerId as string || '', // Use providerId from the database
        lastUpdated: null // Default value for expected field
      };
    } catch (error) {
      console.error("Error fetching domain:", error);
      return undefined;
    }
  }

  async getDomainsByOrganization(organizationId: string): Promise<Domain[]> {
    try {
      // Use raw SQL to avoid Drizzle schema errors
      const rawDomains = await db.execute(sql`
        SELECT 
          id, 
          name, 
          organization_id as "organizationId", 
          provider_id as "providerId",
          is_active as "isActive", 
          created_at as "createdAt" 
        FROM domains 
        WHERE organization_id = ${organizationId}
        ORDER BY name
      `);
      
      if (!rawDomains.rows) {
        return [];
      }
      
      // Map the raw rows to Domain objects with the expected shape
      return rawDomains.rows.map(row => ({
        id: row.id as string,
        name: row.name as string,
        organizationId: row.organizationId as string,
        isActive: Boolean(row.isActive),
        createdAt: row.createdAt ? new Date(row.createdAt as string) : new Date(),
        providerId: row.providerId as string || '', // Use providerId from the database
        lastUpdated: null // Default value for expected field
      }));
    } catch (error) {
      console.error("Error fetching domains by organization:", error);
      return []; // Return empty array instead of crashing
    }
  }

  async getAllDomains(): Promise<Domain[]> {
    try {
      // Use simplest approach to avoid Drizzle errors with missing columns
      const rawDomains = await db.execute(sql`
        SELECT 
          id, 
          name, 
          organization_id as "organizationId", 
          provider_id as "providerId",
          is_active as "isActive", 
          created_at as "createdAt" 
        FROM domains 
        ORDER BY name
      `);
      
      if (!rawDomains.rows) {
        return [];
      }
      
      // Map the raw rows to Domain objects
      return rawDomains.rows.map(row => ({
        id: row.id as string,
        name: row.name as string,
        organizationId: row.organizationId as string,
        isActive: Boolean(row.isActive),
        createdAt: row.createdAt ? new Date(row.createdAt as string) : new Date(),
        providerId: row.providerId as string || '', // Use providerId from the database
        lastUpdated: null // Default value for expected field
      }));
    } catch (error) {
      console.error("Error fetching domains:", error);
      return []; // Return empty array instead of crashing
    }
  }

  async createDomain(domain: InsertDomain): Promise<Domain> {
    try {
      // Use raw SQL to avoid schema issues
      const now = new Date().toISOString();
      
      // Build SQL dynamically based on whether providerId is provided
      let columnsSQL;
      let valuesSQL;
      
      if (domain.providerId) {
        columnsSQL = sql`id, name, organization_id, is_active, provider_id, created_at`;
        valuesSQL = sql`gen_random_uuid(), ${domain.name}, ${domain.organizationId}, ${domain.isActive}, ${domain.providerId}, ${now}`;
      } else {
        columnsSQL = sql`id, name, organization_id, is_active, created_at`;
        valuesSQL = sql`gen_random_uuid(), ${domain.name}, ${domain.organizationId}, ${domain.isActive}, ${now}`;
      }
      
      const query = sql`
        INSERT INTO domains (
          ${columnsSQL}
        ) VALUES (
          ${valuesSQL}
        )
        RETURNING 
          id, 
          name, 
          organization_id as "organizationId", 
          is_active as "isActive", 
          provider_id as "providerId",
          created_at as "createdAt"
      `;
      
      const result = await db.execute(query);
      
      if (!result.rows || result.rows.length === 0) {
        throw new Error("Failed to create domain");
      }
      
      const row = result.rows[0];
      
      // Map to Domain type
      return {
        id: row.id as string,
        name: row.name as string,
        organizationId: row.organizationId as string,
        isActive: Boolean(row.isActive),
        providerId: row.providerId as string,
        createdAt: row.createdAt ? new Date(row.createdAt as string) : new Date(),
        lastUpdated: new Date() // Use creation date as the last updated date
      };
    } catch (error) {
      console.error("Error creating domain:", error);
      throw error;
    }
  }

  async updateDomain(id: string, domainData: Partial<InsertDomain>): Promise<Domain | undefined> {
    try {
      // Check if the domain exists first
      const existingDomain = await this.getDomain(id);
      if (!existingDomain) {
        return undefined;
      }
      
      // Use raw SQL to avoid schema issues
      const updateFields = Object.entries(domainData)
        .map(([key, value]) => `${key === 'organizationId' ? 'organization_id' : 
                               key === 'isActive' ? 'is_active' : key} = ${
          typeof value === 'string' ? `'${value}'` : 
          typeof value === 'boolean' ? value : 
          value === null ? 'NULL' : `'${value}'`
        }`)
        .join(', ');
        
      // Add lastUpdated field (using database naming convention)
      const now = new Date().toISOString();
      const query = sql`
        UPDATE domains 
        SET ${sql.raw(updateFields)}, last_updated = ${now}
        WHERE id = ${id}
        RETURNING 
          id, 
          name, 
          organization_id as "organizationId", 
          provider_id as "providerId",
          is_active as "isActive", 
          created_at as "createdAt"
      `;
      
      const result = await db.execute(query);
      
      if (!result.rows || result.rows.length === 0) {
        return undefined;
      }
      
      const row = result.rows[0];
      
      // Map to Domain type with expected fields
      return {
        id: row.id as string,
        name: row.name as string,
        organizationId: row.organizationId as string,
        isActive: Boolean(row.isActive),
        createdAt: row.createdAt ? new Date(row.createdAt as string) : new Date(),
        providerId: row.providerId as string || '', // Use providerId from the database
        lastUpdated: new Date() // Use current date for lastUpdated
      };
    } catch (error) {
      console.error("Error updating domain:", error);
      return undefined;
    }
  }

  async deleteDomain(id: string): Promise<boolean> {
    try {
      // Check first if the domain exists
      const domain = await this.getDomain(id);
      if (!domain) {
        return false;
      }
      
      // Use raw SQL to avoid schema issues
      const result = await db.execute(sql`
        DELETE FROM domains 
        WHERE id = ${id}
        RETURNING id
      `);
      
      return result.rows?.length > 0;
    } catch (error) {
      console.error("Error deleting domain:", error);
      return false;
    }
  }

  // DNS Record management
  async getDnsRecord(id: string): Promise<DnsRecord | undefined> {
    const [record] = await db.select().from(dnsRecords).where(eq(dnsRecords.id, id));
    return record;
  }

  async getDnsRecordsByDomain(domainId: string): Promise<DnsRecord[]> {
    return await db.select()
      .from(dnsRecords)
      .where(eq(dnsRecords.domainId, domainId));
  }

  async createDnsRecord(record: InsertDnsRecord): Promise<DnsRecord> {
    const [newRecord] = await db.insert(dnsRecords).values(record).returning();
    return newRecord;
  }

  async updateDnsRecord(id: string, recordData: Partial<InsertDnsRecord>): Promise<DnsRecord | undefined> {
    const [updatedRecord] = await db.update(dnsRecords)
      .set({ ...recordData, lastUpdated: new Date() })
      .where(eq(dnsRecords.id, id))
      .returning();
    return updatedRecord;
  }

  async deleteDnsRecord(id: string): Promise<boolean> {
    const result = await db.delete(dnsRecords).where(eq(dnsRecords.id, id)).returning();
    return result.length > 0;
  }

  // Provider management
  async getProvider(id: string): Promise<Provider | undefined> {
    const [provider] = await db.select().from(providers).where(eq(providers.id, id));
    return provider;
  }

  async getProviders(): Promise<Provider[]> {
    return await db.select().from(providers);
  }

  async createProvider(provider: InsertProvider): Promise<Provider> {
    const [newProvider] = await db.insert(providers).values(provider).returning();
    return newProvider;
  }

  async updateProvider(id: string, providerData: Partial<InsertProvider>): Promise<Provider | undefined> {
    const [updatedProvider] = await db.update(providers)
      .set(providerData)
      .where(eq(providers.id, id))
      .returning();
    return updatedProvider;
  }

  async deleteProvider(id: string): Promise<boolean> {
    const result = await db.delete(providers).where(eq(providers.id, id)).returning();
    return result.length > 0;
  }

  // API Token management
  async getApiToken(id: string): Promise<ApiToken | undefined> {
    const [token] = await db.select().from(apiTokens).where(eq(apiTokens.id, id));
    return token;
  }

  async getApiTokenByToken(token: string): Promise<ApiToken | undefined> {
    const [apiToken] = await db.select().from(apiTokens).where(eq(apiTokens.token, token));
    return apiToken;
  }

  async getApiTokensByOrganization(organizationId: string): Promise<ApiToken[]> {
    return await db.select()
      .from(apiTokens)
      .where(eq(apiTokens.organizationId, organizationId));
  }

  async createApiToken(token: InsertApiToken): Promise<ApiToken> {
    const [newToken] = await db.insert(apiTokens).values(token).returning();
    return newToken;
  }

  async updateApiToken(id: string, tokenData: Partial<InsertApiToken>): Promise<ApiToken | undefined> {
    const [updatedToken] = await db.update(apiTokens)
      .set(tokenData)
      .where(eq(apiTokens.id, id))
      .returning();
    return updatedToken;
  }

  async deleteApiToken(id: string): Promise<boolean> {
    const result = await db.delete(apiTokens).where(eq(apiTokens.id, id)).returning();
    return result.length > 0;
  }

  // DNS History
  async addDnsHistory(
    recordId: string,
    action: string,
    previousValue?: string,
    newValue?: string,
    userId?: string
  ): Promise<DnsHistory> {
    const [historyEntry] = await db.insert(dnsHistory).values({
      recordId,
      action,
      previousValue,
      newValue,
      userId,
    }).returning();
    
    return historyEntry;
  }

  async getDnsHistoryByRecord(recordId: string): Promise<DnsHistory[]> {
    return await db.select()
      .from(dnsHistory)
      .where(eq(dnsHistory.recordId, recordId))
      .orderBy(desc(dnsHistory.timestamp));
  }

  async getDnsHistoryByDomain(domainId: string): Promise<DnsHistory[]> {
    // We need to get all records for the domain first
    const records = await this.getDnsRecordsByDomain(domainId);
    const recordIds = records.map(r => r.id);
    
    if (recordIds.length === 0) {
      return [];
    }
    
    // Use SQL for the IN condition
    return await db.select()
      .from(dnsHistory)
      .where(
        sql`${dnsHistory.recordId} IN (${sql.join(recordIds, sql`, `)})`
      )
      .orderBy(desc(dnsHistory.timestamp));
  }

  // Webhook management
  async getWebhook(id: string): Promise<Webhook | undefined> {
    try {
      const [webhook] = await db.select().from(webhooks).where(eq(webhooks.id, id));
      return webhook;
    } catch (error) {
      console.error("Error fetching webhook:", error);
      return undefined;
    }
  }

  async getWebhooksByOrganization(organizationId: string): Promise<Webhook[]> {
    return await db.select()
      .from(webhooks)
      .where(eq(webhooks.organizationId, organizationId));
  }

  async createWebhook(webhook: InsertWebhook): Promise<Webhook> {
    const [newWebhook] = await db.insert(webhooks).values(webhook).returning();
    return newWebhook;
  }

  async updateWebhook(id: string, webhookData: Partial<InsertWebhook>): Promise<Webhook | undefined> {
    const [updatedWebhook] = await db.update(webhooks)
      .set(webhookData)
      .where(eq(webhooks.id, id))
      .returning();
    return updatedWebhook;
  }

  async deleteWebhook(id: string): Promise<boolean> {
    const result = await db.delete(webhooks).where(eq(webhooks.id, id)).returning();
    return result.length > 0;
  }

  async triggerWebhook(webhookId: string, payload: any): Promise<boolean> {
    try {
      // Get the webhook
      const webhook = await this.getWebhook(webhookId);
      if (!webhook || !webhook.isActive) return false;

      // Using the webhook utility to deliver the webhook
      const { generateSignature, deliverWebhook } = await import('./utils/webhook');
      
      // In a real implementation, this would make an HTTP request to the webhook URL
      console.log(`Triggering webhook ${webhook.name} (${webhook.id}) with payload:`, payload);
      
      // Generate signature for the payload if a secret is set
      const signature = webhook.secret ? generateSignature(payload, webhook.secret) : '';
      
      // In a real implementation, this would make the actual HTTP request
      // For now, simulate a successful delivery
      const deliveryResult = {
        success: true,
        statusCode: 200,
        message: 'Webhook delivered successfully (simulated)',
        timestamp: new Date(),
        responseBody: JSON.stringify({ success: true }),
        retryCount: 0
      };
      
      // Log the delivery attempt
      await this.addWebhookDeliveryLog({
        webhookId: webhook.id,
        event: payload.event || 'unknown',
        payload,
        signature,
        status: deliveryResult.success,
        statusCode: deliveryResult.statusCode,
        message: deliveryResult.message,
        responseBody: deliveryResult.responseBody,
        retryCount: deliveryResult.retryCount
      });
      
      // Update the lastTriggered timestamp
      await db.update(webhooks)
        .set({ lastTriggered: new Date() })
        .where(eq(webhooks.id, webhookId));
      
      return true;
    } catch (error) {
      console.error(`Error triggering webhook ${webhookId}:`, error);
      
      // Log the failed delivery attempt
      if (error instanceof Error) {
        await this.addWebhookDeliveryLog({
          webhookId,
          event: payload?.event || 'unknown',
          payload,
          signature: '',
          status: false,
          message: `Error: ${error.message}`,
          retryCount: 0
        });
      }
      
      return false;
    }
  }
  
  // Webhook Delivery Logs
  async addWebhookDeliveryLog(log: InsertWebhookDeliveryLog): Promise<WebhookDeliveryLog> {
    const [newLog] = await db.insert(webhookDeliveryLogs).values(log).returning();
    return newLog;
  }
  
  async getWebhookDeliveryLog(id: string): Promise<WebhookDeliveryLog | undefined> {
    try {
      const [log] = await db.select().from(webhookDeliveryLogs).where(eq(webhookDeliveryLogs.id, id));
      return log;
    } catch (error) {
      console.error("Error fetching webhook delivery log:", error);
      return undefined;
    }
  }
  
  async getWebhookDeliveryLogsByWebhook(webhookId: string): Promise<WebhookDeliveryLog[]> {
    try {
      // Use a specific select list to avoid potential schema issues
      // Only select basic columns and add empty values for potentially missing ones
      const logs = await db.select({
        id: webhookDeliveryLogs.id, 
        webhookId: webhookDeliveryLogs.webhookId,
        status: webhookDeliveryLogs.status,
        statusCode: webhookDeliveryLogs.statusCode,
        payload: webhookDeliveryLogs.payload,
        responseBody: webhookDeliveryLogs.responseBody,
        retryCount: webhookDeliveryLogs.retryCount,
        createdAt: webhookDeliveryLogs.createdAt,
        signature: webhookDeliveryLogs.signature,
        // Use null for potentially missing fields
        event: sql`NULL::text as event`,
        message: sql`NULL::text as message`
      })
      .from(webhookDeliveryLogs)
      .where(eq(webhookDeliveryLogs.webhookId, webhookId))
      .orderBy(desc(webhookDeliveryLogs.createdAt));
      
      return logs;
    } catch (error) {
      console.error("Error fetching webhook delivery logs:", error);
      return []; // Return empty array on error
    }
  }

  // DNS Metrics
  async addDnsMetric(metric: InsertDnsMetric): Promise<DnsMetric> {
    const [newMetric] = await db.insert(dnsMetrics).values(metric).returning();
    return newMetric;
  }
  
  async getDnsMetric(id: string): Promise<DnsMetric | undefined> {
    const [metric] = await db.select().from(dnsMetrics).where(eq(dnsMetrics.id, id));
    return metric;
  }
  
  async getDnsMetricsByDomain(
    domainId: string, 
    metricType?: string, 
    startDate?: Date, 
    endDate?: Date
  ): Promise<DnsMetric[]> {
    let query = db.select().from(dnsMetrics).where(eq(dnsMetrics.domainId, domainId));
    
    if (metricType) {
      query = query.where(eq(dnsMetrics.metricType, metricType));
    }
    
    if (startDate) {
      query = query.where(sql`${dnsMetrics.timestamp} >= ${startDate}`);
    }
    
    if (endDate) {
      query = query.where(sql`${dnsMetrics.timestamp} <= ${endDate}`);
    }
    
    return await query.orderBy(desc(dnsMetrics.timestamp));
  }
  
  async getDnsMetricsByRecord(
    recordId: string, 
    metricType?: string, 
    startDate?: Date, 
    endDate?: Date
  ): Promise<DnsMetric[]> {
    let query = db.select().from(dnsMetrics).where(eq(dnsMetrics.recordId, recordId));
    
    if (metricType) {
      query = query.where(eq(dnsMetrics.metricType, metricType));
    }
    
    if (startDate) {
      query = query.where(sql`${dnsMetrics.timestamp} >= ${startDate}`);
    }
    
    if (endDate) {
      query = query.where(sql`${dnsMetrics.timestamp} <= ${endDate}`);
    }
    
    return await query.orderBy(desc(dnsMetrics.timestamp));
  }
  
  async getDnsMetricsByType(
    metricType: string, 
    startDate?: Date, 
    endDate?: Date
  ): Promise<DnsMetric[]> {
    try {
      // Build the conditions array
      const conditions = [eq(dnsMetrics.metricType, metricType)];
      
      if (startDate) {
        conditions.push(sql`${dnsMetrics.timestamp} >= ${startDate}`);
      }
      
      if (endDate) {
        conditions.push(sql`${dnsMetrics.timestamp} <= ${endDate}`);
      }
      
      // Only select columns that we know exist to avoid DB schema issues
      const results = await db.select({
        id: dnsMetrics.id,
        domainId: dnsMetrics.domainId,
        recordId: dnsMetrics.recordId,
        metricType: dnsMetrics.metricType,
        value: dnsMetrics.value,
        timestamp: dnsMetrics.timestamp,
        // Add empty/default values for columns that might be missing in the DB schema
        source: sql`NULL::text`,
        tags: sql`NULL::text[]`
      })
      .from(dnsMetrics)
      .where(and(...conditions))
      .orderBy(desc(dnsMetrics.timestamp));
      
      return results;
    } catch (error) {
      console.error("Error in getDnsMetricsByType:", error);
      return []; // Return empty array instead of propagating the error
    }
  }
}