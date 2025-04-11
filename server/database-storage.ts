import { 
  users, organizations, domains, dnsRecords, 
  providers, dnsHistory, apiTokens, webhooks, webhookDeliveryLogs, dnsMetrics,
  groups, groupMembers,
  type User, type InsertUser, 
  type Organization, type InsertOrganization,
  type Domain, type InsertDomain,
  type DnsRecord, type InsertDnsRecord,
  type Provider, type InsertProvider,
  type ApiToken, type InsertApiToken,
  type DnsHistory, type Webhook, type InsertWebhook,
  type WebhookDeliveryLog, type InsertWebhookDeliveryLog,
  type DnsMetric, type InsertDnsMetric,
  type Group, type InsertGroup,
  type GroupMember, type InsertGroupMember
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

  // Group management
  async getGroup(id: string): Promise<Group | undefined> {
    const [group] = await db.select().from(groups).where(eq(groups.id, id));
    return group;
  }

  async getGroups(): Promise<Group[]> {
    return await db.select().from(groups);
  }

  async getGroupMembers(groupId: string): Promise<GroupMember[]> {
    return await db.select()
      .from(groupMembers)
      .where(eq(groupMembers.groupId, groupId));
  }

  async createGroup(group: InsertGroup): Promise<Group> {
    const [newGroup] = await db.insert(groups).values(group).returning();
    return newGroup;
  }

  async updateGroup(id: string, groupData: Partial<InsertGroup>): Promise<Group | undefined> {
    const [updatedGroup] = await db.update(groups)
      .set(groupData)
      .where(eq(groups.id, id))
      .returning();
    return updatedGroup;
  }

  async deleteGroup(id: string): Promise<boolean> {
    const result = await db.delete(groups).where(eq(groups.id, id)).returning();
    return result.length > 0;
  }

  async addGroupMember(member: InsertGroupMember): Promise<GroupMember> {
    const [newMember] = await db.insert(groupMembers).values(member).returning();
    return newMember;
  }

  async removeGroupMember(id: string): Promise<boolean> {
    const result = await db.delete(groupMembers).where(eq(groupMembers.id, id)).returning();
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
    try {
      console.log(`Getting DNS record with ID: ${id}`);
      
      // Use direct PostgreSQL query for consistent results
      const { pool } = await import('./db');
      const queryText = `
        SELECT 
          id, domain_id, name, type, content, ttl, priority,
          provider_record_id, is_active, auto_update, notes, last_updated, created_at
        FROM dns_records 
        WHERE id = $1
      `;
      
      const result = await pool.query(queryText, [id]);
      
      if (!result.rows || result.rows.length === 0) {
        console.log(`DNS record with ID ${id} not found`);
        return undefined;
      }
      
      const record = result.rows[0];
      console.log(`Found DNS record:`, record);
      
      // Map the result to match our schema expectations
      return {
        id: record.id,
        domainId: record.domain_id,
        name: record.name,
        type: record.type,
        content: record.content,
        ttl: record.ttl,
        priority: record.priority,
        providerRecordId: record.provider_record_id,
        isActive: record.is_active,
        isAutoIP: record.auto_update, // Map auto_update to isAutoIP
        notes: record.notes,
        lastUpdated: record.last_updated,
        createdAt: record.created_at,
        proxied: null // Field for frontend compatibility
      };
    } catch (error) {
      console.error("Error in getDnsRecord:", error);
      return undefined;
    }
  }

  async getDnsRecordsByDomain(domainId: string): Promise<DnsRecord[]> {
    try {
      console.log(`Getting DNS records for domain: ${domainId}`);
      
      // Use direct PostgreSQL query for consistent results
      const { pool } = await import('./db');
      const queryText = `
        SELECT 
          id, domain_id, name, type, content, ttl, priority,
          provider_record_id, is_active, auto_update, notes, last_updated, created_at
        FROM dns_records 
        WHERE domain_id = $1
      `;
      
      const result = await pool.query(queryText, [domainId]);
      
      console.log(`Found ${result.rows.length} DNS records for domain ${domainId}`);
      
      // Map the results to match our schema expectations
      const mappedRecords = result.rows.map(record => ({
        id: record.id,
        domainId: record.domain_id,
        name: record.name,
        type: record.type,
        content: record.content,
        ttl: record.ttl,
        priority: record.priority,
        providerRecordId: record.provider_record_id,
        isActive: record.is_active,
        isAutoIP: record.auto_update, // Map auto_update to isAutoIP
        notes: record.notes,
        lastUpdated: record.last_updated,
        createdAt: record.created_at,
        proxied: null // Add missing field for frontend compatibility
      }));
      
      console.log("Mapped records:", JSON.stringify(mappedRecords, null, 2));
      return mappedRecords;
    } catch (error) {
      console.error("Error in getDnsRecordsByDomain:", error);
      return [];
    }
  }

  async createDnsRecord(record: InsertDnsRecord): Promise<DnsRecord> {
    try {
      console.log("Creating DNS record with data:", JSON.stringify(record, null, 2));
      
      // Skip drizzle and use direct SQL query since we've had issues with schema mismatches
      // Using a raw SQL query to ensure the data is inserted correctly
      console.log("Using direct SQL query approach");
      
      // Convert the domainId to a string explicitly to avoid any type issues
      const domainIdStr = String(record.domainId);
      console.log(`Domain ID converted to string: '${domainIdStr}'`);
      
      const queryText = `
        INSERT INTO dns_records (
          domain_id, name, type, content, ttl, priority,
          is_active, auto_update, notes, last_updated, provider_record_id
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
        ) 
        RETURNING *
      `;
      
      const params = [
        domainIdStr,                                         // domain_id
        record.name,                                         // name
        record.type,                                         // type
        record.content || '',                                // content
        record.ttl || 3600,                                  // ttl
        record.priority || 0,                                // priority
        record.isActive !== undefined ? record.isActive : true,  // is_active
        record.isAutoIP !== undefined ? record.isAutoIP : false, // auto_update
        record.notes || null,                                // notes
        new Date(),                                          // last_updated
        record.providerRecordId || null                      // provider_record_id
      ];
      
      console.log("Executing query with params:", JSON.stringify(params, null, 2));
      
      try {
        // Execute the query using the pool directly to bypass Drizzle
        const { pool } = await import('./db');
        const result = await pool.query(queryText, params);
        
        if (!result.rows || result.rows.length === 0) {
          console.error("DNS record creation failed - empty result returned");
          throw new Error("Failed to create DNS record");
        }
        
        const sqlRecord = result.rows[0];
        console.log("New DNS record created with raw SQL:", sqlRecord);
        
        // Map the SQL result to the expected DnsRecord type
        return {
          id: sqlRecord.id,
          domainId: sqlRecord.domain_id,
          name: sqlRecord.name,
          type: sqlRecord.type,
          content: sqlRecord.content,
          ttl: sqlRecord.ttl,
          priority: sqlRecord.priority,
          isActive: sqlRecord.is_active,
          isAutoIP: sqlRecord.auto_update,
          notes: sqlRecord.notes,
          lastUpdated: sqlRecord.last_updated,
          createdAt: sqlRecord.created_at,
          providerRecordId: sqlRecord.provider_record_id,
          proxied: null // For frontend compatibility
        };
      } catch (sqlError) {
        console.error("SQL error creating DNS record:", sqlError);
        
        // Last resort - try with a completely different query approach
        console.log("Trying one last SQL approach with a different query format");
        
        // Directly use pg's format for query parameters
        const fallbackQuery = `
          INSERT INTO dns_records
          (domain_id, name, type, content, ttl, priority, is_active, auto_update, notes, last_updated, provider_record_id)
          VALUES
          ('${record.domainId}', '${record.name}', '${record.type}', '${record.content || ''}', 
           ${record.ttl || 3600}, ${record.priority || 0}, 
           ${record.isActive !== undefined ? record.isActive : true}, 
           ${record.isAutoIP !== undefined ? record.isAutoIP : false}, 
           ${record.notes ? `'${record.notes}'` : 'NULL'}, 
           '${new Date().toISOString()}', 
           ${record.providerRecordId ? `'${record.providerRecordId}'` : 'NULL'})
          RETURNING *;
        `;
        
        console.log("Fallback query:", fallbackQuery);
        const { pool } = await import('./db');
        const fallbackResult = await pool.query(fallbackQuery);
        
        if (!fallbackResult.rows || fallbackResult.rows.length === 0) {
          console.error("DNS record creation failed in fallback - empty result");
          throw new Error("Failed to create DNS record");
        }
        
        const fallbackRecord = fallbackResult.rows[0];
        console.log("New DNS record created with fallback SQL:", fallbackRecord);
        
        return {
          id: fallbackRecord.id,
          domainId: fallbackRecord.domain_id,
          name: fallbackRecord.name,
          type: fallbackRecord.type,
          content: fallbackRecord.content,
          ttl: fallbackRecord.ttl,
          priority: fallbackRecord.priority,
          isActive: fallbackRecord.is_active,
          isAutoIP: fallbackRecord.auto_update,
          notes: fallbackRecord.notes,
          lastUpdated: fallbackRecord.last_updated,
          createdAt: fallbackRecord.created_at,
          providerRecordId: fallbackRecord.provider_record_id,
          proxied: null
        };
      }
    } catch (error) {
      console.error("Error in createDnsRecord:", error);
      throw error;
    }
  }

  async updateDnsRecord(id: string, recordData: Partial<InsertDnsRecord>): Promise<DnsRecord | undefined> {
    try {
      // Filter out fields that don't exist in the database
      const { proxied, isAutoIP, providerId, ...validFields } = recordData as any;
      
      // If there's only isAutoIP or no fields at all, handle it separately
      if (Object.keys(validFields).length === 0 && isAutoIP === undefined) {
        // Just update the last_updated timestamp
        const updateQuery = sql`
          UPDATE dns_records 
          SET last_updated = ${new Date()}
          WHERE id = ${id}
          RETURNING id, domain_id, name, type, content, ttl, priority,
            provider_record_id, is_active, auto_update, notes, last_updated, created_at
        `;
        
        const updateResult = await db.execute(updateQuery);
        
        if (!Array.isArray(updateResult) || updateResult.length === 0) {
          return undefined;
        }
        
        const record = updateResult[0];
        return {
          id: record.id,
          domainId: record.domain_id,
          name: record.name,
          type: record.type,
          content: record.content,
          ttl: record.ttl,
          priority: record.priority,
          providerRecordId: record.provider_record_id,
          isActive: record.is_active,
          isAutoIP: record.auto_update,
          notes: record.notes,
          lastUpdated: record.last_updated,
          createdAt: record.created_at,
          proxied: null // Maintained for frontend compatibility
        };
      }
      
      // Create dynamic SQL for the update
      // Start with base query
      let sqlQuery = sql`UPDATE dns_records SET `;
      
      // Add each field dynamically
      const setFragments = [];
      
      // Process all valid fields
      Object.entries(validFields).forEach(([key, value]) => {
        // Convert camelCase to snake_case for database
        const dbField = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        setFragments.push(sql`${sql.raw(dbField)} = ${value}`);
      });
      
      // Add isAutoIP if it exists (maps to auto_update in database)
      if (isAutoIP !== undefined) {
        setFragments.push(sql`auto_update = ${isAutoIP}`);
      }
      
      // Always update last_updated
      setFragments.push(sql`last_updated = ${new Date()}`);
      
      // Join all the SET fragments
      for (let i = 0; i < setFragments.length; i++) {
        sqlQuery = sql`${sqlQuery}${setFragments[i]}`;
        if (i < setFragments.length - 1) {
          sqlQuery = sql`${sqlQuery}, `;
        }
      }
      
      // Add WHERE and RETURNING
      sqlQuery = sql`${sqlQuery} WHERE id = ${id}
        RETURNING id, domain_id, name, type, content, ttl, priority,
        provider_record_id, is_active, auto_update, notes, last_updated, created_at`;
      
      // Execute the query
      const result = await db.execute(sqlQuery);
      
      if (!Array.isArray(result) || result.length === 0) {
        return undefined;
      }
      
      // Map result to expected format
      const updatedRecord = result[0];
      return {
        id: updatedRecord.id,
        domainId: updatedRecord.domain_id,
        name: updatedRecord.name,
        type: updatedRecord.type,
        content: updatedRecord.content,
        ttl: updatedRecord.ttl,
        priority: updatedRecord.priority,
        providerRecordId: updatedRecord.provider_record_id,
        isActive: updatedRecord.is_active,
        isAutoIP: updatedRecord.auto_update,
        notes: updatedRecord.notes,
        lastUpdated: updatedRecord.last_updated,
        createdAt: updatedRecord.created_at,
        proxied: null // Maintained for frontend compatibility
      };
    } catch (error) {
      console.error("Error in updateDnsRecord:", error);
      return undefined;
    }
  }

  async deleteDnsRecord(id: string): Promise<boolean> {
    try {
      console.log(`Deleting DNS record with ID: ${id}`);
      
      // Use direct PostgreSQL query for consistent results
      const { pool } = await import('./db');
      const queryText = `
        DELETE FROM dns_records
        WHERE id = $1
        RETURNING id
      `;
      
      const result = await pool.query(queryText, [id]);
      
      // Check if any rows were deleted
      const success = result.rows && result.rows.length > 0;
      console.log(`Delete operation result for DNS record ${id}: ${success ? 'Success' : 'Not found'}`);
      return success;
    } catch (error) {
      console.error("Error in deleteDnsRecord:", error);
      return false;
    }
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