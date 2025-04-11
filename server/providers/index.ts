import { Provider, DnsRecord, Domain } from '@shared/schema';
import { CloudflareProvider } from './cloudflare';
import { Route53Provider } from './route53';
import { GoDaddyProvider } from './godaddy';
import { GenericProvider } from './generic';

// Define the provider interface all implementations should adhere to
export interface DNSProvider {
  name: string;
  type: string;
  initialize(credentials: any): Promise<boolean>;
  getZones(): Promise<any[]>;
  getRecords(zoneId: string): Promise<any[]>;
  createRecord(zoneId: string, record: Partial<DnsRecord>): Promise<any>;
  updateRecord(zoneId: string, recordId: string, record: Partial<DnsRecord>): Promise<any>;
  deleteRecord(zoneId: string, recordId: string): Promise<boolean>;
  getZoneIdByName(domain: string): Promise<string | null>;
}

// Factory function to create the appropriate provider instance
export function createProvider(provider: Provider): DNSProvider {
  switch (provider.type) {
    case 'cloudflare':
      return new CloudflareProvider(provider);
    case 'route53':
      return new Route53Provider(provider);
    case 'godaddy':
      return new GoDaddyProvider(provider);
    case 'other':
    default:
      return new GenericProvider(provider);
  }
}

// Helper function to get the provider instance for a domain
export async function getProviderForDomain(domain: Domain, provider: Provider): Promise<DNSProvider | null> {
  try {
    if (!provider || !provider.credentials) {
      console.error('Provider not found or missing credentials');
      return null;
    }
    
    const dnsProvider = createProvider(provider);
    const initialized = await dnsProvider.initialize(provider.credentials);
    
    if (!initialized) {
      console.error(`Failed to initialize provider ${provider.name}`);
      return null;
    }
    
    return dnsProvider;
  } catch (error) {
    console.error('Error getting provider for domain:', error);
    return null;
  }
}

// Utility function to synchronize DNS records with the provider
export async function syncDnsRecords(domain: Domain, provider: Provider, records: DnsRecord[]): Promise<boolean> {
  try {
    const dnsProvider = await getProviderForDomain(domain, provider);
    if (!dnsProvider) {
      return false;
    }
    
    // Get zone ID from the provider
    const zoneId = await dnsProvider.getZoneIdByName(domain.name);
    if (!zoneId) {
      console.error(`Zone not found for domain ${domain.name}`);
      return false;
    }
    
    // Get existing records from the provider
    const providerRecords = await dnsProvider.getRecords(zoneId);
    
    // Perform the synchronization logic here
    // This would involve matching local records with remote records
    // and creating/updating/deleting as needed
    
    return true;
  } catch (error) {
    console.error('Error syncing DNS records:', error);
    return false;
  }
}