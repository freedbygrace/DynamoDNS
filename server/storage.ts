import { randomBytes } from "crypto";
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
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  // User management
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  
  // Organization management
  getOrganization(id: number): Promise<Organization | undefined>;
  getOrganizations(): Promise<Organization[]>;
  createOrganization(org: InsertOrganization): Promise<Organization>;
  updateOrganization(id: number, org: Partial<InsertOrganization>): Promise<Organization | undefined>;
  deleteOrganization(id: number): Promise<boolean>;
  
  // Domain management
  getDomain(id: number): Promise<Domain | undefined>;
  getDomainsByOrganization(organizationId: number): Promise<Domain[]>;
  getAllDomains(): Promise<Domain[]>;
  createDomain(domain: InsertDomain): Promise<Domain>;
  updateDomain(id: number, domain: Partial<InsertDomain>): Promise<Domain | undefined>;
  deleteDomain(id: number): Promise<boolean>;
  
  // DNS Record management
  getDnsRecord(id: number): Promise<DnsRecord | undefined>;
  getDnsRecordsByDomain(domainId: number): Promise<DnsRecord[]>;
  createDnsRecord(record: InsertDnsRecord): Promise<DnsRecord>;
  updateDnsRecord(id: number, record: Partial<InsertDnsRecord>): Promise<DnsRecord | undefined>;
  deleteDnsRecord(id: number): Promise<boolean>;
  
  // Provider management
  getProvider(id: number): Promise<Provider | undefined>;
  getProviders(): Promise<Provider[]>;
  createProvider(provider: InsertProvider): Promise<Provider>;
  updateProvider(id: number, provider: Partial<InsertProvider>): Promise<Provider | undefined>;
  deleteProvider(id: number): Promise<boolean>;
  
  // API Token management
  getApiToken(id: number): Promise<ApiToken | undefined>;
  getApiTokenByToken(token: string): Promise<ApiToken | undefined>;
  getApiTokensByOrganization(organizationId: number): Promise<ApiToken[]>;
  createApiToken(token: InsertApiToken): Promise<ApiToken>;
  updateApiToken(id: number, token: Partial<InsertApiToken>): Promise<ApiToken | undefined>;
  deleteApiToken(id: number): Promise<boolean>;
  
  // DNS History
  addDnsHistory(recordId: number, action: string, previousValue?: string, newValue?: string, userId?: number): Promise<DnsHistory>;
  getDnsHistoryByRecord(recordId: number): Promise<DnsHistory[]>;
  getDnsHistoryByDomain(domainId: number): Promise<DnsHistory[]>;
  
  // Session store
  sessionStore: session.SessionStore;
}

export class MemStorage implements IStorage {
  private usersMap: Map<number, User>;
  private orgsMap: Map<number, Organization>;
  private domainsMap: Map<number, Domain>;
  private recordsMap: Map<number, DnsRecord>;
  private providersMap: Map<number, Provider>;
  private apiTokensMap: Map<number, ApiToken>;
  private historyMap: Map<number, DnsHistory>;
  
  // Counters for IDs
  private userIdCounter: number;
  private orgIdCounter: number;
  private domainIdCounter: number;
  private recordIdCounter: number;
  private providerIdCounter: number;
  private apiTokenIdCounter: number;
  private historyIdCounter: number;
  
  public sessionStore: session.SessionStore;

  constructor() {
    this.usersMap = new Map();
    this.orgsMap = new Map();
    this.domainsMap = new Map();
    this.recordsMap = new Map();
    this.providersMap = new Map();
    this.apiTokensMap = new Map();
    this.historyMap = new Map();
    
    this.userIdCounter = 1;
    this.orgIdCounter = 1;
    this.domainIdCounter = 1;
    this.recordIdCounter = 1;
    this.providerIdCounter = 1;
    this.apiTokenIdCounter = 1;
    this.historyIdCounter = 1;
    
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    });
    
    // Initialize sample data
    this.initSampleData();
  }

  private initSampleData() {
    // Create a default provider for Cloudflare
    const cloudflareProvider: InsertProvider = {
      name: "Cloudflare",
      type: "cloudflare",
      credentials: { apiKey: process.env.CLOUDFLARE_API_KEY || "" },
      isActive: true
    };
    this.createProvider(cloudflareProvider);
    
    // Create sample organization
    const defaultOrg: InsertOrganization = {
      name: "Default Organization",
      isActive: true
    };
    this.createOrganization(defaultOrg);
  }

  // Users
  async getUser(id: number): Promise<User | undefined> {
    return this.usersMap.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.usersMap.values()).find(
      (user) => user.username === username,
    );
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.usersMap.values()).find(
      (user) => user.email === email,
    );
  }

  async createUser(user: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const createdAt = new Date();
    const newUser: User = { id, ...user, createdAt };
    this.usersMap.set(id, newUser);
    return newUser;
  }
  
  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined> {
    const user = await this.getUser(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...userData };
    this.usersMap.set(id, updatedUser);
    return updatedUser;
  }
  
  async deleteUser(id: number): Promise<boolean> {
    return this.usersMap.delete(id);
  }
  
  // Organizations
  async getOrganization(id: number): Promise<Organization | undefined> {
    return this.orgsMap.get(id);
  }
  
  async getOrganizations(): Promise<Organization[]> {
    return Array.from(this.orgsMap.values());
  }
  
  async createOrganization(org: InsertOrganization): Promise<Organization> {
    const id = this.orgIdCounter++;
    const createdAt = new Date();
    const newOrg: Organization = { id, ...org, createdAt };
    this.orgsMap.set(id, newOrg);
    return newOrg;
  }
  
  async updateOrganization(id: number, orgData: Partial<InsertOrganization>): Promise<Organization | undefined> {
    const org = await this.getOrganization(id);
    if (!org) return undefined;
    
    const updatedOrg = { ...org, ...orgData };
    this.orgsMap.set(id, updatedOrg);
    return updatedOrg;
  }
  
  async deleteOrganization(id: number): Promise<boolean> {
    return this.orgsMap.delete(id);
  }
  
  // Domains
  async getDomain(id: number): Promise<Domain | undefined> {
    return this.domainsMap.get(id);
  }
  
  async getDomainsByOrganization(organizationId: number): Promise<Domain[]> {
    return Array.from(this.domainsMap.values())
      .filter(domain => domain.organizationId === organizationId);
  }
  
  async getAllDomains(): Promise<Domain[]> {
    return Array.from(this.domainsMap.values());
  }
  
  async createDomain(domain: InsertDomain): Promise<Domain> {
    const id = this.domainIdCounter++;
    const createdAt = new Date();
    const lastUpdated = new Date();
    const newDomain: Domain = { id, ...domain, lastUpdated, createdAt };
    this.domainsMap.set(id, newDomain);
    return newDomain;
  }
  
  async updateDomain(id: number, domainData: Partial<InsertDomain>): Promise<Domain | undefined> {
    const domain = await this.getDomain(id);
    if (!domain) return undefined;
    
    const updatedDomain = { 
      ...domain, 
      ...domainData,
      lastUpdated: new Date()
    };
    this.domainsMap.set(id, updatedDomain);
    return updatedDomain;
  }
  
  async deleteDomain(id: number): Promise<boolean> {
    return this.domainsMap.delete(id);
  }
  
  // DNS Records
  async getDnsRecord(id: number): Promise<DnsRecord | undefined> {
    return this.recordsMap.get(id);
  }
  
  async getDnsRecordsByDomain(domainId: number): Promise<DnsRecord[]> {
    return Array.from(this.recordsMap.values())
      .filter(record => record.domainId === domainId);
  }
  
  async createDnsRecord(record: InsertDnsRecord): Promise<DnsRecord> {
    const id = this.recordIdCounter++;
    const createdAt = new Date();
    const lastUpdated = new Date();
    const newRecord: DnsRecord = { id, ...record, lastUpdated, createdAt };
    this.recordsMap.set(id, newRecord);
    return newRecord;
  }
  
  async updateDnsRecord(id: number, recordData: Partial<InsertDnsRecord>): Promise<DnsRecord | undefined> {
    const record = await this.getDnsRecord(id);
    if (!record) return undefined;
    
    const updatedRecord = { 
      ...record, 
      ...recordData,
      lastUpdated: new Date()
    };
    this.recordsMap.set(id, updatedRecord);
    return updatedRecord;
  }
  
  async deleteDnsRecord(id: number): Promise<boolean> {
    return this.recordsMap.delete(id);
  }
  
  // Providers
  async getProvider(id: number): Promise<Provider | undefined> {
    return this.providersMap.get(id);
  }
  
  async getProviders(): Promise<Provider[]> {
    return Array.from(this.providersMap.values());
  }
  
  async createProvider(provider: InsertProvider): Promise<Provider> {
    const id = this.providerIdCounter++;
    const createdAt = new Date();
    const newProvider: Provider = { id, ...provider, createdAt };
    this.providersMap.set(id, newProvider);
    return newProvider;
  }
  
  async updateProvider(id: number, providerData: Partial<InsertProvider>): Promise<Provider | undefined> {
    const provider = await this.getProvider(id);
    if (!provider) return undefined;
    
    const updatedProvider = { ...provider, ...providerData };
    this.providersMap.set(id, updatedProvider);
    return updatedProvider;
  }
  
  async deleteProvider(id: number): Promise<boolean> {
    return this.providersMap.delete(id);
  }
  
  // API Tokens
  async getApiToken(id: number): Promise<ApiToken | undefined> {
    return this.apiTokensMap.get(id);
  }
  
  async getApiTokenByToken(token: string): Promise<ApiToken | undefined> {
    return Array.from(this.apiTokensMap.values())
      .find(apiToken => apiToken.token === token);
  }
  
  async getApiTokensByOrganization(organizationId: number): Promise<ApiToken[]> {
    return Array.from(this.apiTokensMap.values())
      .filter(token => token.organizationId === organizationId);
  }
  
  async createApiToken(token: InsertApiToken): Promise<ApiToken> {
    const id = this.apiTokenIdCounter++;
    const createdAt = new Date();
    const newToken: ApiToken = { id, ...token, createdAt };
    this.apiTokensMap.set(id, newToken);
    return newToken;
  }
  
  async updateApiToken(id: number, tokenData: Partial<InsertApiToken>): Promise<ApiToken | undefined> {
    const token = await this.getApiToken(id);
    if (!token) return undefined;
    
    const updatedToken = { ...token, ...tokenData };
    this.apiTokensMap.set(id, updatedToken);
    return updatedToken;
  }
  
  async deleteApiToken(id: number): Promise<boolean> {
    return this.apiTokensMap.delete(id);
  }
  
  // DNS History
  async addDnsHistory(
    recordId: number, 
    action: string, 
    previousValue?: string, 
    newValue?: string, 
    userId?: number
  ): Promise<DnsHistory> {
    const id = this.historyIdCounter++;
    const timestamp = new Date();
    
    const historyEntry: DnsHistory = {
      id,
      recordId,
      action,
      previousValue,
      newValue,
      userId,
      timestamp
    };
    
    this.historyMap.set(id, historyEntry);
    return historyEntry;
  }
  
  async getDnsHistoryByRecord(recordId: number): Promise<DnsHistory[]> {
    return Array.from(this.historyMap.values())
      .filter(history => history.recordId === recordId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
  
  async getDnsHistoryByDomain(domainId: number): Promise<DnsHistory[]> {
    // Get all records for domain
    const records = await this.getDnsRecordsByDomain(domainId);
    const recordIds = records.map(r => r.id);
    
    // Get history entries for all records
    return Array.from(this.historyMap.values())
      .filter(history => recordIds.includes(history.recordId))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
}

export const storage = new MemStorage();
