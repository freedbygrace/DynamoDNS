import { DnsRecord, Provider } from '@shared/schema';
import { DNSProvider } from './index';

interface CloudflareCredentials {
  apiToken?: string;
  apiKey?: string;
  email?: string;
}

interface CloudflareRecord {
  id: string;
  name: string;
  type: string;
  content: string;
  ttl: number;
  proxied?: boolean;
  priority?: number;
  comment?: string;
}

export class CloudflareProvider implements DNSProvider {
  name: string;
  type: string;
  private credentials: CloudflareCredentials | null = null;
  private baseUrl = 'https://api.cloudflare.com/client/v4';
  private headers: HeadersInit = {};

  constructor(provider: Provider) {
    this.name = provider.name;
    this.type = provider.type;
  }

  async initialize(credentials: CloudflareCredentials): Promise<boolean> {
    try {
      this.credentials = credentials;

      // Set up headers based on authentication method
      if (credentials.apiToken) {
        this.headers = {
          'Authorization': `Bearer ${credentials.apiToken}`,
          'Content-Type': 'application/json'
        };
      } else if (credentials.apiKey && credentials.email) {
        this.headers = {
          'X-Auth-Key': credentials.apiKey,
          'X-Auth-Email': credentials.email,
          'Content-Type': 'application/json'
        };
      } else {
        console.error('Missing required Cloudflare credentials');
        return false;
      }

      // Verify credentials with a simple API call
      const response = await fetch(`${this.baseUrl}/user/tokens/verify`, {
        method: 'GET',
        headers: this.headers
      });

      const data = await response.json();
      return data.success === true;
    } catch (error) {
      console.error('Error initializing Cloudflare provider:', error);
      return false;
    }
  }

  async getZones(): Promise<any[]> {
    try {
      if (!this.headers) {
        throw new Error('Provider not initialized');
      }

      const response = await fetch(`${this.baseUrl}/zones`, {
        method: 'GET',
        headers: this.headers
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(`Failed to get zones: ${data.errors[0]?.message || 'Unknown error'}`);
      }

      return data.result || [];
    } catch (error) {
      console.error('Error getting Cloudflare zones:', error);
      return [];
    }
  }

  async getZoneIdByName(domainName: string): Promise<string | null> {
    try {
      const zones = await this.getZones();
      const zone = zones.find(z => z.name === domainName);
      return zone ? zone.id : null;
    } catch (error) {
      console.error(`Error getting zone ID for domain ${domainName}:`, error);
      return null;
    }
  }

  async getRecords(zoneId: string): Promise<any[]> {
    try {
      if (!this.headers) {
        throw new Error('Provider not initialized');
      }

      const response = await fetch(`${this.baseUrl}/zones/${zoneId}/dns_records`, {
        method: 'GET',
        headers: this.headers
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(`Failed to get records: ${data.errors[0]?.message || 'Unknown error'}`);
      }

      return data.result || [];
    } catch (error) {
      console.error(`Error getting Cloudflare records for zone ${zoneId}:`, error);
      return [];
    }
  }

  async createRecord(zoneId: string, record: Partial<DnsRecord>): Promise<any> {
    try {
      if (!this.headers) {
        throw new Error('Provider not initialized');
      }

      // Convert from our application record format to Cloudflare format
      const cloudflareRecord: Partial<CloudflareRecord> = {
        name: record.name || '',
        type: record.type || 'A',
        content: record.content || '',
        ttl: record.ttl || 3600,
        priority: record.priority || undefined,
        proxied: (record as any).proxied || false,
        comment: record.notes || undefined
      };

      const response = await fetch(`${this.baseUrl}/zones/${zoneId}/dns_records`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(cloudflareRecord)
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(`Failed to create record: ${data.errors[0]?.message || 'Unknown error'}`);
      }

      return data.result;
    } catch (error) {
      console.error(`Error creating Cloudflare record in zone ${zoneId}:`, error);
      throw error;
    }
  }

  async updateRecord(zoneId: string, recordId: string, record: Partial<DnsRecord>): Promise<any> {
    try {
      if (!this.headers) {
        throw new Error('Provider not initialized');
      }

      // Convert from our application record format to Cloudflare format
      const cloudflareRecord: Partial<CloudflareRecord> = {
        name: record.name || '',
        type: record.type || 'A',
        content: record.content || '',
        ttl: record.ttl || 3600,
        priority: record.priority || undefined,
        proxied: (record as any).proxied || false,
        comment: record.notes || undefined
      };

      const response = await fetch(`${this.baseUrl}/zones/${zoneId}/dns_records/${recordId}`, {
        method: 'PUT',
        headers: this.headers,
        body: JSON.stringify(cloudflareRecord)
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(`Failed to update record: ${data.errors[0]?.message || 'Unknown error'}`);
      }

      return data.result;
    } catch (error) {
      console.error(`Error updating Cloudflare record ${recordId} in zone ${zoneId}:`, error);
      throw error;
    }
  }

  async deleteRecord(zoneId: string, recordId: string): Promise<boolean> {
    try {
      if (!this.headers) {
        throw new Error('Provider not initialized');
      }

      const response = await fetch(`${this.baseUrl}/zones/${zoneId}/dns_records/${recordId}`, {
        method: 'DELETE',
        headers: this.headers
      });

      const data = await response.json();
      return data.success === true;
    } catch (error) {
      console.error(`Error deleting Cloudflare record ${recordId} in zone ${zoneId}:`, error);
      return false;
    }
  }
}