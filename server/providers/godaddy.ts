import { DnsRecord, Provider } from '@shared/schema';
import { DNSProvider } from './index';

interface GoDaddyCredentials {
  apiKey: string;
  apiSecret: string;
  shopper?: string; // Optional shopper ID for reseller accounts
}

interface GoDaddyRecord {
  type: string;
  name: string;
  data: string;
  ttl: number;
  priority?: number;
}

export class GoDaddyProvider implements DNSProvider {
  name: string;
  type: string;
  private credentials: GoDaddyCredentials | null = null;
  private baseUrl = 'https://api.godaddy.com/v1';
  private headers: HeadersInit = {};
  private isProduction = true; // Set to false for OTE environment

  constructor(provider: Provider) {
    this.name = provider.name;
    this.type = provider.type;
  }

  async initialize(credentials: GoDaddyCredentials): Promise<boolean> {
    try {
      if (!credentials.apiKey || !credentials.apiSecret) {
        console.error('Missing required GoDaddy credentials');
        return false;
      }

      this.credentials = credentials;
      
      // Set API base URL based on environment
      this.baseUrl = this.isProduction 
        ? 'https://api.godaddy.com/v1'
        : 'https://api.ote-godaddy.com/v1';

      // Set up headers for authentication
      this.headers = {
        'Authorization': `sso-key ${credentials.apiKey}:${credentials.apiSecret}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };

      // Verify credentials by fetching domains
      const response = await fetch(`${this.baseUrl}/domains`, {
        method: 'GET',
        headers: this.headers
      });

      return response.status === 200;
    } catch (error) {
      console.error('Error initializing GoDaddy provider:', error);
      return false;
    }
  }

  async getZones(): Promise<any[]> {
    try {
      if (!this.headers) {
        throw new Error('Provider not initialized');
      }

      const response = await fetch(`${this.baseUrl}/domains`, {
        method: 'GET',
        headers: this.headers
      });

      if (!response.ok) {
        throw new Error(`Failed to get domains: ${response.statusText}`);
      }

      const domains = await response.json();
      return domains || [];
    } catch (error) {
      console.error('Error getting GoDaddy domains:', error);
      return [];
    }
  }

  async getZoneIdByName(domainName: string): Promise<string | null> {
    try {
      // GoDaddy API uses domain names as identifiers, not separate IDs
      // Check if the domain exists in the account
      const domains = await this.getZones();
      const domain = domains.find(d => d.domain === domainName);
      
      // Return the domain name itself as the "ID" if it exists
      return domain ? domainName : null;
    } catch (error) {
      console.error(`Error getting domain info for ${domainName}:`, error);
      return null;
    }
  }

  async getRecords(domain: string): Promise<any[]> {
    try {
      if (!this.headers) {
        throw new Error('Provider not initialized');
      }

      // GoDaddy API allows getting all records or filtering by type and name
      const response = await fetch(`${this.baseUrl}/domains/${domain}/records`, {
        method: 'GET',
        headers: this.headers
      });

      if (!response.ok) {
        throw new Error(`Failed to get records: ${response.statusText}`);
      }

      const records = await response.json();
      return records || [];
    } catch (error) {
      console.error(`Error getting GoDaddy records for domain ${domain}:`, error);
      return [];
    }
  }

  async createRecord(domain: string, record: Partial<DnsRecord>): Promise<any> {
    try {
      if (!this.headers) {
        throw new Error('Provider not initialized');
      }

      // Convert to GoDaddy format
      const godaddyRecord: GoDaddyRecord = {
        type: record.type || 'A',
        name: record.name === '@' ? '@' : record.name || '',
        data: record.content || '',
        ttl: record.ttl || 3600
      };

      // Add priority for MX and SRV records
      if ((record.type === 'MX' || record.type === 'SRV') && record.priority) {
        godaddyRecord.priority = record.priority;
      }

      // GoDaddy API requires an array of records for updates
      const response = await fetch(`${this.baseUrl}/domains/${domain}/records`, {
        method: 'PATCH',
        headers: this.headers,
        body: JSON.stringify([godaddyRecord])
      });

      if (!response.ok) {
        throw new Error(`Failed to create record: ${response.statusText}`);
      }

      // GoDaddy doesn't return the created record, so we need to fetch it
      const records = await this.getRecords(domain);
      const createdRecord = records.find(r => 
        r.type === godaddyRecord.type && 
        r.name === godaddyRecord.name
      );

      return createdRecord;
    } catch (error) {
      console.error(`Error creating GoDaddy record for domain ${domain}:`, error);
      throw error;
    }
  }

  async updateRecord(domain: string, recordId: string, record: Partial<DnsRecord>): Promise<any> {
    try {
      if (!this.headers) {
        throw new Error('Provider not initialized');
      }

      // Parse the record ID to get the type and name
      // In GoDaddy, we're using type-name as the recordId
      const [type, name] = recordId.split('-');

      // Convert to GoDaddy format
      const godaddyRecord: GoDaddyRecord = {
        type: record.type || type,
        name: record.name || name,
        data: record.content || '',
        ttl: record.ttl || 3600
      };

      // Add priority for MX and SRV records
      if ((godaddyRecord.type === 'MX' || godaddyRecord.type === 'SRV') && record.priority) {
        godaddyRecord.priority = record.priority;
      }

      // GoDaddy API requires updating by type and name
      const response = await fetch(`${this.baseUrl}/domains/${domain}/records/${type}/${name}`, {
        method: 'PUT',
        headers: this.headers,
        body: JSON.stringify([godaddyRecord])
      });

      if (!response.ok) {
        throw new Error(`Failed to update record: ${response.statusText}`);
      }

      // GoDaddy doesn't return the updated record, so we need to fetch it
      const records = await this.getRecords(domain);
      const updatedRecord = records.find(r => 
        r.type === godaddyRecord.type && 
        r.name === godaddyRecord.name
      );

      return updatedRecord;
    } catch (error) {
      console.error(`Error updating GoDaddy record ${recordId} for domain ${domain}:`, error);
      throw error;
    }
  }

  async deleteRecord(domain: string, recordId: string): Promise<boolean> {
    try {
      if (!this.headers) {
        throw new Error('Provider not initialized');
      }

      // Parse the record ID to get the type and name
      const [type, name] = recordId.split('-');

      // GoDaddy doesn't allow deleting records via API directly
      // Instead, we need to replace them with an empty array
      const response = await fetch(`${this.baseUrl}/domains/${domain}/records/${type}/${name}`, {
        method: 'PUT',
        headers: this.headers,
        body: JSON.stringify([])
      });

      return response.ok;
    } catch (error) {
      console.error(`Error deleting GoDaddy record ${recordId} for domain ${domain}:`, error);
      return false;
    }
  }
}