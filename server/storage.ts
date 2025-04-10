import { 
  type User, type InsertUser, 
  type Organization, type InsertOrganization,
  type Domain, type InsertDomain,
  type DnsRecord, type InsertDnsRecord,
  type Provider, type InsertProvider,
  type ApiToken, type InsertApiToken,
  type DnsHistory,
  type Webhook, type InsertWebhook,
  type WebhookDeliveryLog, type InsertWebhookDeliveryLog,
  type DnsMetric, type InsertDnsMetric
} from "@shared/schema";
import session from "express-session";
import { DatabaseStorage } from "./database-storage";

export interface IStorage {
  // User management
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  
  // Organization management
  getOrganization(id: string): Promise<Organization | undefined>;
  getOrganizations(): Promise<Organization[]>;
  createOrganization(org: InsertOrganization): Promise<Organization>;
  updateOrganization(id: string, org: Partial<InsertOrganization>): Promise<Organization | undefined>;
  deleteOrganization(id: string): Promise<boolean>;
  
  // Domain management
  getDomain(id: string): Promise<Domain | undefined>;
  getDomainsByOrganization(organizationId: string): Promise<Domain[]>;
  getAllDomains(): Promise<Domain[]>;
  createDomain(domain: InsertDomain): Promise<Domain>;
  updateDomain(id: string, domain: Partial<InsertDomain>): Promise<Domain | undefined>;
  deleteDomain(id: string): Promise<boolean>;
  
  // DNS Record management
  getDnsRecord(id: string): Promise<DnsRecord | undefined>;
  getDnsRecordsByDomain(domainId: string): Promise<DnsRecord[]>;
  createDnsRecord(record: InsertDnsRecord): Promise<DnsRecord>;
  updateDnsRecord(id: string, record: Partial<InsertDnsRecord>): Promise<DnsRecord | undefined>;
  deleteDnsRecord(id: string): Promise<boolean>;
  
  // Provider management
  getProvider(id: string): Promise<Provider | undefined>;
  getProviders(): Promise<Provider[]>;
  createProvider(provider: InsertProvider): Promise<Provider>;
  updateProvider(id: string, provider: Partial<InsertProvider>): Promise<Provider | undefined>;
  deleteProvider(id: string): Promise<boolean>;
  
  // API Token management
  getApiToken(id: string): Promise<ApiToken | undefined>;
  getApiTokenByToken(token: string): Promise<ApiToken | undefined>;
  getApiTokensByOrganization(organizationId: string): Promise<ApiToken[]>;
  createApiToken(token: InsertApiToken): Promise<ApiToken>;
  updateApiToken(id: string, token: Partial<InsertApiToken>): Promise<ApiToken | undefined>;
  deleteApiToken(id: string): Promise<boolean>;
  
  // DNS History
  addDnsHistory(recordId: string, action: string, previousValue?: string, newValue?: string, userId?: string): Promise<DnsHistory>;
  getDnsHistoryByRecord(recordId: string): Promise<DnsHistory[]>;
  getDnsHistoryByDomain(domainId: string): Promise<DnsHistory[]>;
  
  // Webhook management
  getWebhook(id: string): Promise<Webhook | undefined>;
  getWebhooksByOrganization(organizationId: string): Promise<Webhook[]>;
  createWebhook(webhook: InsertWebhook): Promise<Webhook>;
  updateWebhook(id: string, webhook: Partial<InsertWebhook>): Promise<Webhook | undefined>;
  deleteWebhook(id: string): Promise<boolean>;
  triggerWebhook(webhookId: string, payload: any, retryCount?: number): Promise<boolean>;
  
  // Webhook Delivery Logs
  addWebhookDeliveryLog(log: InsertWebhookDeliveryLog): Promise<WebhookDeliveryLog>;
  getWebhookDeliveryLog(id: string): Promise<WebhookDeliveryLog | undefined>;
  getWebhookDeliveryLogsByWebhook(webhookId: string): Promise<WebhookDeliveryLog[]>;
  
  // DNS Metrics
  addDnsMetric(metric: InsertDnsMetric): Promise<DnsMetric>;
  getDnsMetric(id: string): Promise<DnsMetric | undefined>;
  getDnsMetricsByDomain(domainId: string, metricType?: string, startDate?: Date, endDate?: Date): Promise<DnsMetric[]>;
  getDnsMetricsByRecord(recordId: string, metricType?: string, startDate?: Date, endDate?: Date): Promise<DnsMetric[]>;
  getDnsMetricsByType(metricType: string, startDate?: Date, endDate?: Date): Promise<DnsMetric[]>;
  
  // Session store
  sessionStore: any;
}

export class MemStorage implements IStorage {
  private usersMap: Map<number, User>;
  private orgsMap: Map<number, Organization>;
  private domainsMap: Map<number, Domain>;
  private recordsMap: Map<number, DnsRecord>;
  private providersMap: Map<number, Provider>;
  private apiTokensMap: Map<number, ApiToken>;
  private historyMap: Map<number, DnsHistory>;
  private webhooksMap: Map<number, Webhook>;
  private webhookDeliveryLogsMap: Map<number, WebhookDeliveryLog>;
  private metricsMap: Map<number, DnsMetric>;
  
  // Counters for IDs
  private userIdCounter: number;
  private orgIdCounter: number;
  private domainIdCounter: number;
  private recordIdCounter: number;
  private providerIdCounter: number;
  private apiTokenIdCounter: number;
  private historyIdCounter: number;
  private webhookIdCounter: number;
  private webhookDeliveryLogIdCounter: number;
  private metricIdCounter: number;
  
  public sessionStore: any;

  constructor() {
    this.usersMap = new Map();
    this.orgsMap = new Map();
    this.domainsMap = new Map();
    this.recordsMap = new Map();
    this.providersMap = new Map();
    this.apiTokensMap = new Map();
    this.historyMap = new Map();
    this.webhooksMap = new Map();
    this.webhookDeliveryLogsMap = new Map();
    this.metricsMap = new Map();
    
    this.userIdCounter = 1;
    this.orgIdCounter = 1;
    this.domainIdCounter = 1;
    this.recordIdCounter = 1;
    this.providerIdCounter = 1;
    this.apiTokenIdCounter = 1;
    this.historyIdCounter = 1;
    this.webhookIdCounter = 1;
    this.webhookDeliveryLogIdCounter = 1;
    this.metricIdCounter = 1;
    
    // Session store is created in the DatabaseStorage class
    this.sessionStore = null;
    
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
  async getUser(id: string): Promise<User | undefined> {
    return this.usersMap.get(parseInt(id));
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
    const numId = this.userIdCounter++;
    const createdAt = new Date();
    const newUser: User = { 
      id: numId.toString(), 
      username: user.username,
      password: user.password,
      email: user.email,
      fullName: user.fullName || null,
      role: user.role || 'user',
      organizationId: user.organizationId || null,
      createdAt
    };
    this.usersMap.set(numId, newUser);
    return newUser;
  }
  
  async updateUser(id: string, userData: Partial<InsertUser>): Promise<User | undefined> {
    const numId = parseInt(id);
    const user = await this.getUser(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...userData };
    this.usersMap.set(numId, updatedUser);
    return updatedUser;
  }
  
  async deleteUser(id: string): Promise<boolean> {
    return this.usersMap.delete(parseInt(id));
  }
  
  // Organizations
  async getOrganization(id: string): Promise<Organization | undefined> {
    return this.orgsMap.get(parseInt(id));
  }
  
  async getOrganizations(): Promise<Organization[]> {
    return Array.from(this.orgsMap.values());
  }
  
  async createOrganization(org: InsertOrganization): Promise<Organization> {
    const numId = this.orgIdCounter++;
    const createdAt = new Date();
    const newOrg: Organization = {
      id: numId.toString(),
      name: org.name,
      isActive: org.isActive ?? true,
      createdAt
    };
    this.orgsMap.set(numId, newOrg);
    return newOrg;
  }
  
  async updateOrganization(id: string, orgData: Partial<InsertOrganization>): Promise<Organization | undefined> {
    const numId = parseInt(id);
    const org = await this.getOrganization(id);
    if (!org) return undefined;
    
    const updatedOrg = { ...org, ...orgData };
    this.orgsMap.set(numId, updatedOrg);
    return updatedOrg;
  }
  
  async deleteOrganization(id: string): Promise<boolean> {
    return this.orgsMap.delete(parseInt(id));
  }
  
  // Domains
  async getDomain(id: string): Promise<Domain | undefined> {
    return this.domainsMap.get(parseInt(id));
  }
  
  async getDomainsByOrganization(organizationId: string): Promise<Domain[]> {
    return Array.from(this.domainsMap.values())
      .filter(domain => domain.organizationId === organizationId);
  }
  
  async getAllDomains(): Promise<Domain[]> {
    return Array.from(this.domainsMap.values());
  }
  
  async createDomain(domain: InsertDomain): Promise<Domain> {
    const numId = this.domainIdCounter++;
    const createdAt = new Date();
    const lastUpdated = new Date();
    const newDomain: Domain = { 
      id: numId.toString(),
      name: domain.name,
      organizationId: domain.organizationId,
      providerId: domain.providerId,
      isActive: domain.isActive ?? true,
      lastUpdated,
      createdAt
    };
    this.domainsMap.set(numId, newDomain);
    return newDomain;
  }
  
  async updateDomain(id: string, domainData: Partial<InsertDomain>): Promise<Domain | undefined> {
    const numId = parseInt(id);
    const domain = await this.getDomain(id);
    if (!domain) return undefined;
    
    const updatedDomain = { 
      ...domain, 
      ...domainData,
      lastUpdated: new Date()
    };
    this.domainsMap.set(numId, updatedDomain);
    return updatedDomain;
  }
  
  async deleteDomain(id: string): Promise<boolean> {
    return this.domainsMap.delete(parseInt(id));
  }
  
  // DNS Records
  async getDnsRecord(id: string): Promise<DnsRecord | undefined> {
    return this.recordsMap.get(parseInt(id));
  }
  
  async getDnsRecordsByDomain(domainId: string): Promise<DnsRecord[]> {
    return Array.from(this.recordsMap.values())
      .filter(record => record.domainId === domainId);
  }
  
  async createDnsRecord(record: InsertDnsRecord): Promise<DnsRecord> {
    const numId = this.recordIdCounter++;
    const createdAt = new Date();
    const lastUpdated = new Date();
    const newRecord: DnsRecord = { 
      id: numId.toString(),
      domainId: record.domainId,
      name: record.name,
      type: record.type,
      content: record.content,
      ttl: record.ttl ?? 3600,
      proxied: record.proxied ?? false,
      isActive: record.isActive ?? true,
      isAutoIP: record.isAutoIP ?? false,
      notes: record.notes ?? null,
      lastUpdated,
      createdAt
    };
    this.recordsMap.set(numId, newRecord);
    return newRecord;
  }
  
  async updateDnsRecord(id: string, recordData: Partial<InsertDnsRecord>): Promise<DnsRecord | undefined> {
    const numId = parseInt(id);
    const record = await this.getDnsRecord(id);
    if (!record) return undefined;
    
    const updatedRecord = { 
      ...record, 
      ...recordData,
      lastUpdated: new Date()
    };
    this.recordsMap.set(numId, updatedRecord);
    return updatedRecord;
  }
  
  async deleteDnsRecord(id: string): Promise<boolean> {
    return this.recordsMap.delete(parseInt(id));
  }
  
  // Providers
  async getProvider(id: string): Promise<Provider | undefined> {
    return this.providersMap.get(parseInt(id));
  }
  
  async getProviders(): Promise<Provider[]> {
    return Array.from(this.providersMap.values());
  }
  
  async createProvider(provider: InsertProvider): Promise<Provider> {
    const numId = this.providerIdCounter++;
    const createdAt = new Date();
    const newProvider: Provider = { 
      id: numId.toString(),
      name: provider.name,
      type: provider.type,
      credentials: provider.credentials ?? null,
      isActive: provider.isActive ?? true,
      createdAt 
    };
    this.providersMap.set(numId, newProvider);
    return newProvider;
  }
  
  async updateProvider(id: string, providerData: Partial<InsertProvider>): Promise<Provider | undefined> {
    const numId = parseInt(id);
    const provider = await this.getProvider(id);
    if (!provider) return undefined;
    
    const updatedProvider = { ...provider, ...providerData };
    this.providersMap.set(numId, updatedProvider);
    return updatedProvider;
  }
  
  async deleteProvider(id: string): Promise<boolean> {
    return this.providersMap.delete(parseInt(id));
  }
  
  // API Tokens
  async getApiToken(id: string): Promise<ApiToken | undefined> {
    return this.apiTokensMap.get(parseInt(id));
  }
  
  async getApiTokenByToken(token: string): Promise<ApiToken | undefined> {
    return Array.from(this.apiTokensMap.values())
      .find(apiToken => apiToken.token === token);
  }
  
  async getApiTokensByOrganization(organizationId: string): Promise<ApiToken[]> {
    return Array.from(this.apiTokensMap.values())
      .filter(token => token.organizationId === organizationId);
  }
  
  async createApiToken(token: InsertApiToken): Promise<ApiToken> {
    const numId = this.apiTokenIdCounter++;
    const createdAt = new Date();
    const newToken: ApiToken = { 
      id: numId.toString(),
      name: token.name,
      token: token.token,
      organizationId: token.organizationId,
      permissions: token.permissions ?? null,
      createdBy: token.createdBy,
      isActive: token.isActive ?? true,
      expiresAt: token.expiresAt ?? null,
      createdAt
    };
    this.apiTokensMap.set(numId, newToken);
    return newToken;
  }
  
  async updateApiToken(id: string, tokenData: Partial<InsertApiToken>): Promise<ApiToken | undefined> {
    const numId = parseInt(id);
    const token = await this.getApiToken(id);
    if (!token) return undefined;
    
    const updatedToken = { ...token, ...tokenData };
    this.apiTokensMap.set(numId, updatedToken);
    return updatedToken;
  }
  
  async deleteApiToken(id: string): Promise<boolean> {
    return this.apiTokensMap.delete(parseInt(id));
  }
  
  // DNS History
  async addDnsHistory(
    recordId: string, 
    action: string, 
    previousValue?: string, 
    newValue?: string, 
    userId?: string
  ): Promise<DnsHistory> {
    const numId = this.historyIdCounter++;
    const timestamp = new Date();
    
    const historyEntry: DnsHistory = {
      id: numId.toString(),
      recordId,
      action,
      previousValue: previousValue ?? null,
      newValue: newValue ?? null,
      userId: userId ?? null,
      timestamp
    };
    
    this.historyMap.set(numId, historyEntry);
    return historyEntry;
  }
  
  async getDnsHistoryByRecord(recordId: string): Promise<DnsHistory[]> {
    return Array.from(this.historyMap.values())
      .filter(history => history.recordId === recordId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
  
  async getDnsHistoryByDomain(domainId: string): Promise<DnsHistory[]> {
    // Get all records for domain
    const records = await this.getDnsRecordsByDomain(domainId);
    const recordIds = records.map(r => r.id);
    
    // Get history entries for all records
    return Array.from(this.historyMap.values())
      .filter(history => recordIds.includes(history.recordId))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // Webhook management
  async getWebhook(id: string): Promise<Webhook | undefined> {
    return this.webhooksMap.get(parseInt(id));
  }

  async getWebhooksByOrganization(organizationId: string): Promise<Webhook[]> {
    return Array.from(this.webhooksMap.values())
      .filter(webhook => webhook.organizationId === organizationId);
  }

  async createWebhook(webhook: InsertWebhook): Promise<Webhook> {
    const numId = this.webhookIdCounter++;
    const createdAt = new Date();
    const newWebhook: Webhook = {
      id: numId.toString(),
      name: webhook.name,
      url: webhook.url,
      organizationId: webhook.organizationId,
      secret: webhook.secret ?? null,
      events: webhook.events,
      isActive: webhook.isActive ?? true,
      lastTriggered: null,
      createdBy: webhook.createdBy,
      createdAt
    };
    this.webhooksMap.set(numId, newWebhook);
    return newWebhook;
  }

  async updateWebhook(id: string, webhookData: Partial<InsertWebhook>): Promise<Webhook | undefined> {
    const numId = parseInt(id);
    const webhook = await this.getWebhook(id);
    if (!webhook) return undefined;
    
    const updatedWebhook = { ...webhook, ...webhookData };
    this.webhooksMap.set(numId, updatedWebhook);
    return updatedWebhook;
  }

  async deleteWebhook(id: string): Promise<boolean> {
    return this.webhooksMap.delete(parseInt(id));
  }

  async triggerWebhook(webhookId: string, payload: any, retryCount: number = 0): Promise<boolean> {
    const webhook = await this.getWebhook(webhookId);
    if (!webhook || !webhook.isActive) return false;

    try {
      // Import the webhook utility functions
      const webhookUtils = await import('./utils/webhook');
      
      console.log(`Triggering webhook ${webhook.name} (${webhook.id})`);
      
      // Setup delivery options with the provided retry count
      const deliveryOptions = {
        startRetryCount: retryCount
      };
      
      // In a real implementation with an actual HTTP request, this would call
      // the deliverWebhook function. For now, we'll simulate the delivery
      // to avoid making actual HTTP requests in the demo environment.
      
      // Simulated webhook delivery (for demo purposes only)
      const isRetry = retryCount > 0;
      const deliveryResult = {
        success: true,
        statusCode: 200,
        message: isRetry ? 
          `Webhook delivered successfully after ${retryCount} ${retryCount === 1 ? 'retry' : 'retries'} (simulated)` : 
          'Webhook delivered successfully (simulated)',
        timestamp: new Date(),
        responseBody: JSON.stringify({ 
          success: true, 
          received_at: new Date().toISOString(),
          message: "Webhook received successfully"
        }),
        retryCount
      };
      
      // In a production environment, you would use the actual delivery code:
      // const deliveryResult = await deliverWebhook(webhook, payload, deliveryOptions);
      
      // Log the delivery attempt
      await this.addWebhookDeliveryLog({
        webhookId: webhook.id,
        event: payload.event || 'unknown',
        payload,
        signature: webhook.secret ? 'simulated-signature' : '',
        status: deliveryResult.success,
        statusCode: deliveryResult.statusCode,
        message: deliveryResult.message,
        responseBody: deliveryResult.responseBody,
        retryCount
      });
      
      // Update the lastTriggered timestamp
      const updatedWebhook = { 
        ...webhook, 
        lastTriggered: new Date() 
      };
      this.webhooksMap.set(parseInt(webhookId), updatedWebhook);
      
      return true;
    } catch (error) {
      console.error(`Error triggering webhook ${webhook.id}:`, error);
      
      // Log the failed delivery attempt
      await this.addWebhookDeliveryLog({
        webhookId: webhook.id,
        event: payload.event || 'unknown',
        payload,
        signature: '',
        status: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        retryCount
      });
      
      return false;
    }
  }
  
  // Webhook Delivery Logs
  async addWebhookDeliveryLog(log: InsertWebhookDeliveryLog): Promise<WebhookDeliveryLog> {
    const numId = this.webhookDeliveryLogIdCounter++;
    const createdAt = new Date();
    
    const newLog: WebhookDeliveryLog = {
      id: numId.toString(),
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
    
    this.webhookDeliveryLogsMap.set(numId, newLog);
    return newLog;
  }
  
  async getWebhookDeliveryLog(id: string): Promise<WebhookDeliveryLog | undefined> {
    return this.webhookDeliveryLogsMap.get(parseInt(id));
  }
  
  async getWebhookDeliveryLogsByWebhook(webhookId: string): Promise<WebhookDeliveryLog[]> {
    return Array.from(this.webhookDeliveryLogsMap.values())
      .filter(log => log.webhookId === webhookId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // DNS Metrics
  async addDnsMetric(metric: InsertDnsMetric): Promise<DnsMetric> {
    const numId = this.metricIdCounter++;
    const timestamp = new Date();
    
    const newMetric: DnsMetric = {
      id: numId.toString(),
      domainId: metric.domainId || null,
      recordId: metric.recordId || null,
      metricType: metric.metricType,
      value: metric.value,
      source: metric.source || null,
      tags: metric.tags || null,
      timestamp
    };
    
    this.metricsMap.set(numId, newMetric);
    return newMetric;
  }
  
  async getDnsMetric(id: string): Promise<DnsMetric | undefined> {
    return this.metricsMap.get(parseInt(id));
  }
  
  async getDnsMetricsByDomain(
    domainId: string, 
    metricType?: string, 
    startDate?: Date, 
    endDate?: Date
  ): Promise<DnsMetric[]> {
    let metrics = Array.from(this.metricsMap.values())
      .filter(metric => metric.domainId === domainId);
    
    if (metricType) {
      metrics = metrics.filter(metric => metric.metricType === metricType);
    }
    
    if (startDate) {
      metrics = metrics.filter(metric => metric.timestamp >= startDate);
    }
    
    if (endDate) {
      metrics = metrics.filter(metric => metric.timestamp <= endDate);
    }
    
    return metrics.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
  
  async getDnsMetricsByRecord(
    recordId: string, 
    metricType?: string, 
    startDate?: Date, 
    endDate?: Date
  ): Promise<DnsMetric[]> {
    let metrics = Array.from(this.metricsMap.values())
      .filter(metric => metric.recordId === recordId);
    
    if (metricType) {
      metrics = metrics.filter(metric => metric.metricType === metricType);
    }
    
    if (startDate) {
      metrics = metrics.filter(metric => metric.timestamp >= startDate);
    }
    
    if (endDate) {
      metrics = metrics.filter(metric => metric.timestamp <= endDate);
    }
    
    return metrics.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
  
  async getDnsMetricsByType(
    metricType: string, 
    startDate?: Date, 
    endDate?: Date
  ): Promise<DnsMetric[]> {
    let metrics = Array.from(this.metricsMap.values())
      .filter(metric => metric.metricType === metricType);
    
    if (startDate) {
      metrics = metrics.filter(metric => metric.timestamp >= startDate);
    }
    
    if (endDate) {
      metrics = metrics.filter(metric => metric.timestamp <= endDate);
    }
    
    return metrics.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
}

export const storage = new DatabaseStorage();
