import { 
  type User, type InsertUser, 
  type Customer, type InsertCustomer,
  type CustomerUserAssignment, type InsertCustomerUserAssignment,
  type Domain, type InsertDomain,
  type DomainCredentials, type InsertDomainCredentials,
  type DnsRecord, type InsertDnsRecord,
  type Provider, type InsertProvider,
  type ApiToken, type InsertApiToken,
  type ApiTokenCustomerAccess, type InsertApiTokenCustomerAccess,
  type DnsHistory,
  type Webhook, type InsertWebhook,
  type WebhookDeliveryLog, type InsertWebhookDeliveryLog,
  type DnsMetric, type InsertDnsMetric,
  type CustomRole, type InsertCustomRole
} from "@shared/schema";
import { IStorage } from "./storage";
import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import session from "express-session";
import createMemoryStore from "memorystore";

const scryptAsync = promisify(scrypt);

// Helper function to hash passwords
async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

// Helper function to compare passwords
async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export class ImprovedDatabaseStorage implements IStorage {
  private usersMap: Map<string, User>;
  private customersMap: Map<string, Customer>;
  private customerUserMap: Map<string, CustomerUserAssignment>;
  private domainsMap: Map<string, Domain>;
  private domainCredentialsMap: Map<string, DomainCredentials>;
  private recordsMap: Map<string, DnsRecord>;
  private providersMap: Map<string, Provider>;
  private apiTokensMap: Map<string, ApiToken>;
  private apiTokenCustomerAccessMap: Map<string, ApiTokenCustomerAccess>;
  private historyMap: Map<string, DnsHistory>;
  private webhooksMap: Map<string, Webhook>;
  private webhookDeliveryLogsMap: Map<string, WebhookDeliveryLog>;
  private metricsMap: Map<string, DnsMetric>;
  private customRolesMap: Map<string, CustomRole>;
  
  // Counters for IDs
  private userIdCounter: number;
  private customerIdCounter: number;
  private customerUserIdCounter: number;
  private domainIdCounter: number;
  private domainCredentialsIdCounter: number;
  private recordIdCounter: number;
  private providerIdCounter: number;
  private apiTokenIdCounter: number;
  private apiTokenCustomerAccessIdCounter: number;
  private historyIdCounter: number;
  private webhookIdCounter: number;
  private webhookDeliveryLogIdCounter: number;
  private metricIdCounter: number;
  private customRoleIdCounter: number;
  
  public sessionStore: any;

  constructor() {
    this.usersMap = new Map();
    this.customersMap = new Map();
    this.customerUserMap = new Map();
    this.domainsMap = new Map();
    this.domainCredentialsMap = new Map();
    this.recordsMap = new Map();
    this.providersMap = new Map();
    this.apiTokensMap = new Map();
    this.apiTokenCustomerAccessMap = new Map();
    this.historyMap = new Map();
    this.webhooksMap = new Map();
    this.webhookDeliveryLogsMap = new Map();
    this.metricsMap = new Map();
    this.customRolesMap = new Map();
    
    this.userIdCounter = 1;
    this.customerIdCounter = 1;
    this.customerUserIdCounter = 1;
    this.domainIdCounter = 1;
    this.domainCredentialsIdCounter = 1;
    this.recordIdCounter = 1;
    this.providerIdCounter = 1;
    this.apiTokenIdCounter = 1;
    this.apiTokenCustomerAccessIdCounter = 1;
    this.historyIdCounter = 1;
    this.webhookIdCounter = 1;
    this.webhookDeliveryLogIdCounter = 1;
    this.metricIdCounter = 1;
    this.customRoleIdCounter = 1;
    
    // Create a memory store for sessions
    const MemoryStore = createMemoryStore(session);
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    });
    
    // Initialize sample data
    this.initSampleData();
  }

  private async initSampleData() {
    // Create a default provider for Cloudflare
    const cloudflareProvider: InsertProvider = {
      name: "Cloudflare",
      type: "cloudflare",
      isActive: true
    };
    
    // Create a default provider for Route53
    const route53Provider: InsertProvider = {
      name: "AWS Route53",
      type: "route53",
      isActive: true
    };
    
    // Create a default provider for GoDaddy
    const godaddyProvider: InsertProvider = {
      name: "GoDaddy",
      type: "godaddy",
      isActive: true
    };
    
    // Create providers
    const cfProvider = await this.createProvider(cloudflareProvider);
    const r53Provider = await this.createProvider(route53Provider);
    const gdProvider = await this.createProvider(godaddyProvider);
    
    // Create default customer
    const defaultCustomer: InsertCustomer = {
      name: "Default Customer",
      isActive: true
    };
    const customer = await this.createCustomer(defaultCustomer);
    
    // Create admin user with proper password hashing
    const adminPassword = await hashPassword("admin123");
    
    const adminUser: InsertUser = {
      username: "admin",
      password: adminPassword,
      email: "admin@example.com",
      fullName: "System Admin",
      role: "admin"
    };
    
    const admin = await this.createUser(adminUser);
    
    // Assign admin to customer with admin role
    await this.assignUserToCustomer({
      userId: admin.id,
      customerId: customer.id,
      role: "admin"
    });
    
    // Create sample domain
    const domain: InsertDomain = {
      name: "example.com",
      customerId: customer.id,
      providerId: cfProvider.id,
      isActive: true
    };
    
    const newDomain = await this.createDomain(domain);
    
    // Create domain credentials
    const credentials: InsertDomainCredentials = {
      domainId: newDomain.id,
      apiToken: "example_token",
      accountId: "example_account",
      zoneId: "example_zone",
      isActive: true
    };
    
    await this.createDomainCredentials(credentials);
    
    // Create DNS record
    const record: InsertDnsRecord = {
      domainId: newDomain.id,
      name: "www",
      type: "A",
      content: "192.168.1.1",
      ttl: 3600,
      isActive: true,
      isAutoIP: false,
      priority: 0
    };
    
    await this.createDnsRecord(record);
    
    console.log('Default admin user created:', admin.username);
  }
  
  // User management
  async getUser(id: string): Promise<User | undefined> {
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
    const newUser: User = { 
      id: id.toString(), 
      username: user.username,
      password: user.password,
      email: user.email,
      fullName: user.fullName || null,
      role: user.role || 'user',
      createdAt
    };
    this.usersMap.set(newUser.id, newUser);
    return newUser;
  }
  
  async updateUser(id: string, userData: Partial<InsertUser>): Promise<User | undefined> {
    const user = await this.getUser(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...userData };
    this.usersMap.set(id, updatedUser);
    return updatedUser;
  }
  
  async deleteUser(id: string): Promise<boolean> {
    return this.usersMap.delete(id);
  }
  
  // Customer management
  async getCustomer(id: string): Promise<Customer | undefined> {
    return this.customersMap.get(id);
  }
  
  async getCustomers(): Promise<Customer[]> {
    return Array.from(this.customersMap.values());
  }
  
  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    const id = this.customerIdCounter++;
    const createdAt = new Date();
    const newCustomer: Customer = {
      id: id.toString(),
      name: customer.name,
      isActive: customer.isActive ?? true,
      createdAt
    };
    this.customersMap.set(newCustomer.id, newCustomer);
    return newCustomer;
  }
  
  async updateCustomer(id: string, customerData: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const customer = await this.getCustomer(id);
    if (!customer) return undefined;
    
    const updatedCustomer = { ...customer, ...customerData };
    this.customersMap.set(id, updatedCustomer);
    return updatedCustomer;
  }
  
  async deleteCustomer(id: string): Promise<boolean> {
    return this.customersMap.delete(id);
  }
  
  // Customer-User assignments
  async getCustomerUsers(customerId: string): Promise<User[]> {
    const assignments = Array.from(this.customerUserMap.values())
      .filter(assignment => assignment.customerId === customerId);
    
    const users: User[] = [];
    for (const assignment of assignments) {
      const user = await this.getUser(assignment.userId);
      if (user) users.push(user);
    }
    
    return users;
  }
  
  async getUserCustomers(userId: string): Promise<Customer[]> {
    const assignments = Array.from(this.customerUserMap.values())
      .filter(assignment => assignment.userId === userId);
    
    const customers: Customer[] = [];
    for (const assignment of assignments) {
      const customer = await this.getCustomer(assignment.customerId);
      if (customer) customers.push(customer);
    }
    
    return customers;
  }
  
  async assignUserToCustomer(assignment: InsertCustomerUserAssignment): Promise<CustomerUserAssignment> {
    // Check for existing assignment
    const existingAssignment = Array.from(this.customerUserMap.values())
      .find(a => a.customerId === assignment.customerId && a.userId === assignment.userId);
    
    if (existingAssignment) {
      // Update role if exists
      existingAssignment.role = assignment.role || existingAssignment.role;
      this.customerUserMap.set(existingAssignment.id, existingAssignment);
      return existingAssignment;
    }
    
    // Create new assignment
    const id = this.customerUserIdCounter++;
    const createdAt = new Date();
    
    const newAssignment: CustomerUserAssignment = {
      id: id.toString(),
      customerId: assignment.customerId,
      userId: assignment.userId,
      role: assignment.role || 'user',
      createdAt
    };
    
    this.customerUserMap.set(newAssignment.id, newAssignment);
    return newAssignment;
  }
  
  async updateUserCustomerRole(customerId: string, userId: string, role: string): Promise<CustomerUserAssignment | undefined> {
    const assignment = Array.from(this.customerUserMap.values())
      .find(a => a.customerId === customerId && a.userId === userId);
    
    if (!assignment) return undefined;
    
    assignment.role = role;
    this.customerUserMap.set(assignment.id, assignment);
    return assignment;
  }
  
  async removeUserFromCustomer(customerId: string, userId: string): Promise<boolean> {
    const assignment = Array.from(this.customerUserMap.values())
      .find(a => a.customerId === customerId && a.userId === userId);
    
    if (!assignment) return false;
    
    return this.customerUserMap.delete(assignment.id);
  }
  
  // Domain management
  async getDomain(id: string): Promise<Domain | undefined> {
    return this.domainsMap.get(id);
  }
  
  async getDomainsByCustomer(customerId: string): Promise<Domain[]> {
    return Array.from(this.domainsMap.values())
      .filter(domain => domain.customerId === customerId);
  }
  
  async getAllDomains(): Promise<Domain[]> {
    return Array.from(this.domainsMap.values());
  }
  
  async createDomain(domain: InsertDomain): Promise<Domain> {
    const id = this.domainIdCounter++;
    const createdAt = new Date();
    const lastUpdated = new Date();
    
    const newDomain: Domain = { 
      id: id.toString(),
      name: domain.name,
      customerId: domain.customerId,
      providerId: domain.providerId || "1", // Default to the first provider if not specified
      isActive: domain.isActive ?? true,
      lastUpdated,
      createdAt
    };
    
    this.domainsMap.set(newDomain.id, newDomain);
    return newDomain;
  }
  
  async updateDomain(id: string, domainData: Partial<InsertDomain>): Promise<Domain | undefined> {
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
  
  async deleteDomain(id: string): Promise<boolean> {
    return this.domainsMap.delete(id);
  }
  
  // Domain credentials management
  async getDomainCredentials(domainId: string): Promise<DomainCredentials | undefined> {
    return Array.from(this.domainCredentialsMap.values())
      .find(cred => cred.domainId === domainId);
  }
  
  async createDomainCredentials(credentials: InsertDomainCredentials): Promise<DomainCredentials> {
    const id = this.domainCredentialsIdCounter++;
    const createdAt = new Date();
    const updatedAt = new Date();
    
    const newCredentials: DomainCredentials = {
      id: id.toString(),
      domainId: credentials.domainId,
      apiToken: credentials.apiToken || null,
      accountId: credentials.accountId || null,
      zoneId: credentials.zoneId || null,
      otherCredentials: credentials.otherCredentials || null,
      isActive: credentials.isActive ?? true,
      createdAt,
      updatedAt
    };
    
    this.domainCredentialsMap.set(newCredentials.id, newCredentials);
    return newCredentials;
  }
  
  async updateDomainCredentials(domainId: string, credentialsData: Partial<InsertDomainCredentials>): Promise<DomainCredentials | undefined> {
    const credentials = await this.getDomainCredentials(domainId);
    if (!credentials) return undefined;
    
    const updatedCredentials = { 
      ...credentials, 
      ...credentialsData,
      updatedAt: new Date()
    };
    
    this.domainCredentialsMap.set(credentials.id, updatedCredentials);
    return updatedCredentials;
  }
  
  // DNS Record management
  async getDnsRecord(id: string): Promise<DnsRecord | undefined> {
    return this.recordsMap.get(id);
  }
  
  async getDnsRecordsByDomain(domainId: string): Promise<DnsRecord[]> {
    return Array.from(this.recordsMap.values())
      .filter(record => record.domainId === domainId);
  }
  
  async createDnsRecord(record: InsertDnsRecord): Promise<DnsRecord> {
    const id = this.recordIdCounter++;
    const createdAt = new Date();
    const lastUpdated = new Date();
    
    const newRecord: DnsRecord = { 
      id: id.toString(),
      domainId: record.domainId,
      name: record.name,
      type: record.type,
      content: record.content,
      ttl: record.ttl ?? 3600,
      proxied: record.proxied ?? false,
      isActive: record.isActive ?? true,
      isAutoIP: record.isAutoIP ?? false,
      notes: record.notes ?? null,
      priority: record.priority ?? 0,
      providerRecordId: record.providerRecordId ?? null,
      lastUpdated,
      createdAt
    };
    
    this.recordsMap.set(newRecord.id, newRecord);
    return newRecord;
  }
  
  async updateDnsRecord(id: string, recordData: Partial<InsertDnsRecord>): Promise<DnsRecord | undefined> {
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
  
  async deleteDnsRecord(id: string): Promise<boolean> {
    return this.recordsMap.delete(id);
  }
  
  // Provider management
  async getProvider(id: string): Promise<Provider | undefined> {
    return this.providersMap.get(id);
  }
  
  async getProviders(): Promise<Provider[]> {
    return Array.from(this.providersMap.values());
  }
  
  async createProvider(provider: InsertProvider): Promise<Provider> {
    const id = this.providerIdCounter++;
    const createdAt = new Date();
    
    const newProvider: Provider = { 
      id: id.toString(),
      name: provider.name,
      type: provider.type,
      isActive: provider.isActive ?? true,
      createdAt 
    };
    
    this.providersMap.set(newProvider.id, newProvider);
    return newProvider;
  }
  
  async updateProvider(id: string, providerData: Partial<InsertProvider>): Promise<Provider | undefined> {
    const provider = await this.getProvider(id);
    if (!provider) return undefined;
    
    const updatedProvider = { ...provider, ...providerData };
    this.providersMap.set(id, updatedProvider);
    return updatedProvider;
  }
  
  async deleteProvider(id: string): Promise<boolean> {
    return this.providersMap.delete(id);
  }
  
  // API Tokens
  async getApiToken(id: string): Promise<ApiToken | undefined> {
    return this.apiTokensMap.get(id);
  }
  
  async getApiTokenByToken(token: string): Promise<ApiToken | undefined> {
    return Array.from(this.apiTokensMap.values())
      .find(apiToken => apiToken.token === token);
  }
  
  async getApiTokensByCustomer(customerId: string): Promise<ApiToken[]> {
    // Get all tokens that have access to this customer
    const customerAccess = Array.from(this.apiTokenCustomerAccessMap.values())
      .filter(access => access.customerId === customerId);
    
    const tokens: ApiToken[] = [];
    for (const access of customerAccess) {
      const token = await this.getApiToken(access.tokenId);
      if (token) tokens.push(token);
    }
    
    return tokens;
  }
  
  async getApiTokens(): Promise<ApiToken[]> {
    return Array.from(this.apiTokensMap.values());
  }
  
  async createApiToken(token: InsertApiToken): Promise<ApiToken> {
    const id = this.apiTokenIdCounter++;
    const createdAt = new Date();
    let expiresAt = null;
    
    if (token.expiresAt) {
      expiresAt = new Date(token.expiresAt);
    }
    
    const newToken: ApiToken = {
      id: id.toString(),
      name: token.name || `Token ${id}`,
      token: token.token || randomBytes(32).toString('hex'),
      role: token.role || 'readonly',
      createdBy: token.createdBy || '1', // Default to admin user
      isActive: token.isActive ?? true,
      expiresAt,
      createdAt
    };
    
    this.apiTokensMap.set(newToken.id, newToken);
    
    // Add customer access if provided
    if (token.customerIds && Array.isArray(token.customerIds)) {
      for (const customerId of token.customerIds) {
        await this.addApiTokenCustomerAccess({
          tokenId: newToken.id,
          customerId
        });
      }
    }
    
    return newToken;
  }
  
  async updateApiToken(id: string, tokenData: Partial<InsertApiToken>): Promise<ApiToken | undefined> {
    const token = await this.getApiToken(id);
    if (!token) return undefined;
    
    const updatedToken = { ...token };
    
    if (tokenData.name) updatedToken.name = tokenData.name;
    if (tokenData.role) updatedToken.role = tokenData.role;
    if (tokenData.isActive !== undefined) updatedToken.isActive = tokenData.isActive;
    if (tokenData.expiresAt) {
      updatedToken.expiresAt = new Date(tokenData.expiresAt);
    }
    
    this.apiTokensMap.set(id, updatedToken);
    
    // Update customer access if provided
    if (tokenData.customerIds && Array.isArray(tokenData.customerIds)) {
      // Remove existing access
      const existingAccess = await this.getApiTokenCustomerAccess(id);
      for (const access of existingAccess) {
        await this.removeApiTokenCustomerAccess(id, access.customerId);
      }
      
      // Add new access
      for (const customerId of tokenData.customerIds) {
        await this.addApiTokenCustomerAccess({
          tokenId: id,
          customerId
        });
      }
    }
    
    return updatedToken;
  }
  
  async deleteApiToken(id: string): Promise<boolean> {
    return this.apiTokensMap.delete(id);
  }
  
  // API Token Customer Access
  async getApiTokenCustomerAccess(tokenId: string): Promise<ApiTokenCustomerAccess[]> {
    return Array.from(this.apiTokenCustomerAccessMap.values())
      .filter(access => access.tokenId === tokenId);
  }
  
  async addApiTokenCustomerAccess(access: InsertApiTokenCustomerAccess): Promise<ApiTokenCustomerAccess> {
    // Check for existing access
    const existingAccess = Array.from(this.apiTokenCustomerAccessMap.values())
      .find(a => a.tokenId === access.tokenId && a.customerId === access.customerId);
    
    if (existingAccess) {
      return existingAccess;
    }
    
    // Create new access
    const id = this.apiTokenCustomerAccessIdCounter++;
    const createdAt = new Date();
    
    const newAccess: ApiTokenCustomerAccess = {
      id: id.toString(),
      tokenId: access.tokenId,
      customerId: access.customerId,
      createdAt
    };
    
    this.apiTokenCustomerAccessMap.set(newAccess.id, newAccess);
    return newAccess;
  }
  
  async removeApiTokenCustomerAccess(tokenId: string, customerId: string): Promise<boolean> {
    const access = Array.from(this.apiTokenCustomerAccessMap.values())
      .find(a => a.tokenId === tokenId && a.customerId === customerId);
    
    if (!access) return false;
    
    return this.apiTokenCustomerAccessMap.delete(access.id);
  }
  
  // DNS History
  async addDnsHistory(recordId: string, action: string, previousValue?: string, newValue?: string, userId?: string): Promise<DnsHistory> {
    const id = this.historyIdCounter++;
    const timestamp = new Date();
    
    const historyEntry: DnsHistory = {
      id: id.toString(),
      recordId,
      action,
      previousValue: previousValue || null,
      newValue: newValue || null,
      userId: userId || null,
      timestamp
    };
    
    this.historyMap.set(historyEntry.id, historyEntry);
    return historyEntry;
  }
  
  async getDnsHistoryByRecord(recordId: string): Promise<DnsHistory[]> {
    return Array.from(this.historyMap.values())
      .filter(history => history.recordId === recordId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()); // Most recent first
  }
  
  async getDnsHistoryByDomain(domainId: string): Promise<DnsHistory[]> {
    // Get all records for the domain
    const records = await this.getDnsRecordsByDomain(domainId);
    const recordIds = records.map(record => record.id);
    
    // Get history for all records
    return Array.from(this.historyMap.values())
      .filter(history => recordIds.includes(history.recordId))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()); // Most recent first
  }
  
  // Webhook management
  async getWebhook(id: string): Promise<Webhook | undefined> {
    return this.webhooksMap.get(id);
  }
  
  async getWebhooksByCustomer(customerId: string): Promise<Webhook[]> {
    return Array.from(this.webhooksMap.values())
      .filter(webhook => webhook.customerId === customerId);
  }
  
  async createWebhook(webhook: InsertWebhook): Promise<Webhook> {
    const id = this.webhookIdCounter++;
    const createdAt = new Date();
    
    const newWebhook: Webhook = {
      id: id.toString(),
      name: webhook.name,
      url: webhook.url,
      customerId: webhook.customerId,
      secret: webhook.secret || null,
      events: webhook.events,
      isActive: webhook.isActive ?? true,
      lastTriggered: null,
      createdBy: webhook.createdBy,
      createdAt
    };
    
    this.webhooksMap.set(newWebhook.id, newWebhook);
    return newWebhook;
  }
  
  async updateWebhook(id: string, webhookData: Partial<InsertWebhook>): Promise<Webhook | undefined> {
    const webhook = await this.getWebhook(id);
    if (!webhook) return undefined;
    
    const updatedWebhook = { ...webhook, ...webhookData };
    this.webhooksMap.set(id, updatedWebhook);
    return updatedWebhook;
  }
  
  async deleteWebhook(id: string): Promise<boolean> {
    return this.webhooksMap.delete(id);
  }
  
  async triggerWebhook(webhookId: string, payload: any, retryCount: number = 0): Promise<boolean> {
    const webhook = await this.getWebhook(webhookId);
    if (!webhook || !webhook.isActive) return false;
    
    // In memory storage, we just log the event and update lastTriggered
    console.log(`Triggering webhook ${webhookId} with payload:`, payload);
    
    webhook.lastTriggered = new Date();
    this.webhooksMap.set(webhookId, webhook);
    
    // Add a delivery log
    const success = Math.random() > 0.2; // 80% chance of success for testing
    await this.addWebhookDeliveryLog({
      webhookId,
      event: payload.event || 'unknown',
      payload,
      status: success,
      statusCode: success ? 200 : 500,
      message: success ? 'Success' : 'Failed',
      retryCount,
      signature: 'test-signature'
    });
    
    return success;
  }
  
  // Webhook Delivery Logs
  async addWebhookDeliveryLog(log: InsertWebhookDeliveryLog): Promise<WebhookDeliveryLog> {
    const id = this.webhookDeliveryLogIdCounter++;
    const createdAt = new Date();
    
    const newLog: WebhookDeliveryLog = {
      id: id.toString(),
      webhookId: log.webhookId,
      event: log.event,
      payload: log.payload,
      signature: log.signature || null,
      status: log.status,
      statusCode: log.statusCode || null,
      message: log.message,
      responseBody: log.responseBody || null,
      retryCount: log.retryCount || 0,
      createdAt
    };
    
    this.webhookDeliveryLogsMap.set(newLog.id, newLog);
    return newLog;
  }
  
  async getWebhookDeliveryLog(id: string): Promise<WebhookDeliveryLog | undefined> {
    return this.webhookDeliveryLogsMap.get(id);
  }
  
  async getWebhookDeliveryLogsByWebhook(webhookId: string): Promise<WebhookDeliveryLog[]> {
    return Array.from(this.webhookDeliveryLogsMap.values())
      .filter(log => log.webhookId === webhookId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); // Most recent first
  }
  
  // DNS Metrics
  async addDnsMetric(metric: InsertDnsMetric): Promise<DnsMetric> {
    const id = this.metricIdCounter++;
    const timestamp = new Date();
    
    const newMetric: DnsMetric = {
      id: id.toString(),
      domainId: metric.domainId || null,
      recordId: metric.recordId || null,
      metricType: metric.metricType,
      value: metric.value,
      source: metric.source || null,
      tags: metric.tags || [],
      timestamp
    };
    
    this.metricsMap.set(newMetric.id, newMetric);
    return newMetric;
  }
  
  async getDnsMetric(id: string): Promise<DnsMetric | undefined> {
    return this.metricsMap.get(id);
  }
  
  async getDnsMetricsByDomain(
    domainId: string, 
    metricType?: string, 
    startDate?: Date, 
    endDate?: Date
  ): Promise<DnsMetric[]> {
    return Array.from(this.metricsMap.values())
      .filter(metric => {
        // Filter by domainId
        if (metric.domainId !== domainId) return false;
        
        // Filter by metricType if provided
        if (metricType && metric.metricType !== metricType) return false;
        
        // Filter by date range if provided
        if (startDate && metric.timestamp < startDate) return false;
        if (endDate && metric.timestamp > endDate) return false;
        
        return true;
      })
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()); // Most recent first
  }
  
  async getDnsMetricsByRecord(
    recordId: string, 
    metricType?: string, 
    startDate?: Date, 
    endDate?: Date
  ): Promise<DnsMetric[]> {
    return Array.from(this.metricsMap.values())
      .filter(metric => {
        // Filter by recordId
        if (metric.recordId !== recordId) return false;
        
        // Filter by metricType if provided
        if (metricType && metric.metricType !== metricType) return false;
        
        // Filter by date range if provided
        if (startDate && metric.timestamp < startDate) return false;
        if (endDate && metric.timestamp > endDate) return false;
        
        return true;
      })
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()); // Most recent first
  }
  
  async getDnsMetricsByType(
    metricType: string, 
    startDate?: Date, 
    endDate?: Date
  ): Promise<DnsMetric[]> {
    return Array.from(this.metricsMap.values())
      .filter(metric => {
        // Filter by metricType
        if (metric.metricType !== metricType) return false;
        
        // Filter by date range if provided
        if (startDate && metric.timestamp < startDate) return false;
        if (endDate && metric.timestamp > endDate) return false;
        
        return true;
      })
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()); // Most recent first
  }
  
  // Custom Roles management
  async getCustomRole(id: string): Promise<CustomRole | undefined> {
    return this.customRolesMap.get(id);
  }
  
  async getCustomRoles(): Promise<CustomRole[]> {
    return Array.from(this.customRolesMap.values());
  }
  
  async getCustomRoleByName(name: string): Promise<CustomRole | undefined> {
    return Array.from(this.customRolesMap.values())
      .find(role => role.name === name);
  }
  
  async createCustomRole(role: InsertCustomRole): Promise<CustomRole> {
    const id = this.customRoleIdCounter++;
    const createdAt = new Date();
    
    const newRole: CustomRole = {
      id: id.toString(),
      name: role.name,
      description: role.description || null,
      permissions: role.permissions,
      isActive: role.isActive ?? true,
      createdBy: role.createdBy,
      createdAt
    };
    
    this.customRolesMap.set(newRole.id, newRole);
    return newRole;
  }
  
  async updateCustomRole(id: string, roleData: Partial<InsertCustomRole>): Promise<CustomRole | undefined> {
    const role = await this.getCustomRole(id);
    if (!role) return undefined;
    
    const updatedRole = { ...role, ...roleData };
    this.customRolesMap.set(id, updatedRole);
    return updatedRole;
  }
  
  async deleteCustomRole(id: string): Promise<boolean> {
    return this.customRolesMap.delete(id);
  }
}