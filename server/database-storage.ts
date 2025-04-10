import { 
  users, organizations, domains, dnsRecords, 
  providers, dnsHistory, apiTokens, 
  type User, type InsertUser, 
  type Organization, type InsertOrganization,
  type Domain, type InsertDomain,
  type DnsRecord, type InsertDnsRecord,
  type Provider, type InsertProvider,
  type ApiToken, type InsertApiToken,
  type DnsHistory
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
    const [domain] = await db.select().from(domains).where(eq(domains.id, id));
    return domain;
  }

  async getDomainsByOrganization(organizationId: string): Promise<Domain[]> {
    return await db.select()
      .from(domains)
      .where(eq(domains.organizationId, organizationId));
  }

  async getAllDomains(): Promise<Domain[]> {
    return await db.select().from(domains);
  }

  async createDomain(domain: InsertDomain): Promise<Domain> {
    const [newDomain] = await db.insert(domains).values(domain).returning();
    return newDomain;
  }

  async updateDomain(id: number, domainData: Partial<InsertDomain>): Promise<Domain | undefined> {
    const [updatedDomain] = await db.update(domains)
      .set({ ...domainData, lastUpdated: new Date() })
      .where(eq(domains.id, id))
      .returning();
    return updatedDomain;
  }

  async deleteDomain(id: number): Promise<boolean> {
    const result = await db.delete(domains).where(eq(domains.id, id)).returning();
    return result.length > 0;
  }

  // DNS Record management
  async getDnsRecord(id: number): Promise<DnsRecord | undefined> {
    const [record] = await db.select().from(dnsRecords).where(eq(dnsRecords.id, id));
    return record;
  }

  async getDnsRecordsByDomain(domainId: number): Promise<DnsRecord[]> {
    return await db.select()
      .from(dnsRecords)
      .where(eq(dnsRecords.domainId, domainId));
  }

  async createDnsRecord(record: InsertDnsRecord): Promise<DnsRecord> {
    const [newRecord] = await db.insert(dnsRecords).values(record).returning();
    return newRecord;
  }

  async updateDnsRecord(id: number, recordData: Partial<InsertDnsRecord>): Promise<DnsRecord | undefined> {
    const [updatedRecord] = await db.update(dnsRecords)
      .set({ ...recordData, lastUpdated: new Date() })
      .where(eq(dnsRecords.id, id))
      .returning();
    return updatedRecord;
  }

  async deleteDnsRecord(id: number): Promise<boolean> {
    const result = await db.delete(dnsRecords).where(eq(dnsRecords.id, id)).returning();
    return result.length > 0;
  }

  // Provider management
  async getProvider(id: number): Promise<Provider | undefined> {
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

  async updateProvider(id: number, providerData: Partial<InsertProvider>): Promise<Provider | undefined> {
    const [updatedProvider] = await db.update(providers)
      .set(providerData)
      .where(eq(providers.id, id))
      .returning();
    return updatedProvider;
  }

  async deleteProvider(id: number): Promise<boolean> {
    const result = await db.delete(providers).where(eq(providers.id, id)).returning();
    return result.length > 0;
  }

  // API Token management
  async getApiToken(id: number): Promise<ApiToken | undefined> {
    const [token] = await db.select().from(apiTokens).where(eq(apiTokens.id, id));
    return token;
  }

  async getApiTokenByToken(token: string): Promise<ApiToken | undefined> {
    const [apiToken] = await db.select().from(apiTokens).where(eq(apiTokens.token, token));
    return apiToken;
  }

  async getApiTokensByOrganization(organizationId: number): Promise<ApiToken[]> {
    return await db.select()
      .from(apiTokens)
      .where(eq(apiTokens.organizationId, organizationId));
  }

  async createApiToken(token: InsertApiToken): Promise<ApiToken> {
    const [newToken] = await db.insert(apiTokens).values(token).returning();
    return newToken;
  }

  async updateApiToken(id: number, tokenData: Partial<InsertApiToken>): Promise<ApiToken | undefined> {
    const [updatedToken] = await db.update(apiTokens)
      .set(tokenData)
      .where(eq(apiTokens.id, id))
      .returning();
    return updatedToken;
  }

  async deleteApiToken(id: number): Promise<boolean> {
    const result = await db.delete(apiTokens).where(eq(apiTokens.id, id)).returning();
    return result.length > 0;
  }

  // DNS History
  async addDnsHistory(
    recordId: number,
    action: string,
    previousValue?: string,
    newValue?: string,
    userId?: number
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

  async getDnsHistoryByRecord(recordId: number): Promise<DnsHistory[]> {
    return await db.select()
      .from(dnsHistory)
      .where(eq(dnsHistory.recordId, recordId))
      .orderBy(desc(dnsHistory.timestamp));
  }

  async getDnsHistoryByDomain(domainId: number): Promise<DnsHistory[]> {
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
}