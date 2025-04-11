import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { setupAuth, requireRole } from "./auth";
import { z } from "zod";
import { eq } from "drizzle-orm";
import {
  insertDomainSchema,
  insertDnsRecordSchema,
  insertProviderSchema,
  insertApiTokenSchema,
  insertOrganizationSchema,
  insertWebhookSchema,
  insertDnsMetricSchema,
  insertCustomRoleSchema,
  insertGroupSchema,
  insertGroupMemberSchema,
  recordTypes,
  providerTypes,
  customRoles,
  memberTypes
} from "@shared/schema";
import { randomBytes } from "crypto";
import { getProviderForDomain } from './providers';

// Helper function to sync DNS record with provider
async function syncDnsRecordWithProvider(
  action: string,
  domainId: string,
  recordData: any,
  recordId?: string
): Promise<string | null> {
  try {
    // Get the domain to find the provider
    const domain = await storage.getDomain(domainId);
    if (!domain || !domain.providerId) {
      console.log(`No domain or provider found for domain ID: ${domainId}`);
      return null;
    }

    // Get the provider
    const provider = await storage.getProvider(domain.providerId);
    if (!provider) {
      console.log(`Provider not found with ID: ${domain.providerId}`);
      return null;
    }

    // Initialize the provider
    const dnsProvider = await getProviderForDomain(domain, provider);
    if (!dnsProvider) {
      console.log(`Failed to initialize provider ${provider.name} for domain ${domain.name}`);
      return null;
    }

    // Get the zone ID for the domain
    const zoneId = await dnsProvider.getZoneIdByName(domain.name);
    if (!zoneId) {
      console.log(`Zone not found for domain ${domain.name}`);
      return null;
    }

    // Perform the requested action
    let result = null;
    switch (action) {
      case 'create':
        console.log(`Creating record in provider ${provider.name} for domain ${domain.name}`);
        result = await dnsProvider.createRecord(zoneId, recordData);
        if (result && result.id) {
          console.log(`Record created in provider with ID: ${result.id}`);
          return result.id;
        }
        break;
      case 'update':
        if (!recordId) {
          console.log('Record ID is required for update operation');
          return null;
        }
        console.log(`Updating record ${recordId} in provider ${provider.name} for domain ${domain.name}`);
        result = await dnsProvider.updateRecord(zoneId, recordId, recordData);
        if (result) {
          console.log(`Record updated in provider: ${result.id || recordId}`);
          return result.id || recordId;
        }
        break;
      case 'delete':
        if (!recordId) {
          console.log('Record ID is required for delete operation');
          return null;
        }
        console.log(`Deleting record ${recordId} in provider ${provider.name} for domain ${domain.name}`);
        const success = await dnsProvider.deleteRecord(zoneId, recordId);
        if (success) {
          console.log(`Record deleted from provider: ${recordId}`);
          return recordId;
        }
        break;
      default:
        console.log(`Unknown action: ${action}`);
        return null;
    }

    return null;
  } catch (error) {
    console.error(`Error syncing DNS record with provider (${action}):`, error);
    return null;
  }
}

// Helper function to trigger webhooks for DNS operations
async function triggerDnsWebhooks(
  action: string, 
  domainId: string,
  recordData: any, 
  previousData: any = null, 
  userId: string | null = null
) {
  try {
    // First, get the domain to find the organization
    const domain = await storage.getDomain(domainId);
    if (!domain) return;
    
    // Get webhooks for this organization
    const webhooks = await storage.getWebhooksByOrganization(domain.organizationId);
    
    // Filter webhooks that have subscribed to DNS events
    const dnsWebhooks = webhooks.filter(webhook => 
      webhook.isActive && 
      (webhook.events.includes('dns.*') || webhook.events.includes(`dns.${action}`))
    );
    
    if (dnsWebhooks.length === 0) return;
    
    // Create webhook payload
    const payload = {
      event: `dns.${action}`,
      timestamp: new Date().toISOString(),
      data: {
        domain: domain.name,
        record: recordData,
        previousRecord: previousData,
        userId
      }
    };
    
    // Trigger each webhook
    for (const webhook of dnsWebhooks) {
      await storage.triggerWebhook(webhook.id, payload);
    }
  } catch (error) {
    console.error("Error triggering webhooks:", error);
    // Don't throw - we don't want to interrupt the main operation if webhooks fail
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuth(app);

  // DNS Records routes
  app.get("/api/dns-records", requireRole(["admin", "manager", "user", "readonly"]), async (req, res) => {
    try {
      const domainId = req.query.domainId as string;
      
      if (!domainId) {
        return res.status(400).json({ message: "Domain ID is required" });
      }
      
      console.log(`API endpoint: Fetching DNS records for domain: ${domainId}`);
      const records = await storage.getDnsRecordsByDomain(domainId);
      console.log(`API endpoint: Retrieved ${records.length} DNS records from storage`);
      res.json(records);
    } catch (error) {
      console.error("Error fetching DNS records:", error);
      res.status(500).json({ 
        message: "Failed to fetch DNS records", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.get("/api/dns-records/:id", requireRole(["admin", "manager", "user", "readonly"]), async (req, res) => {
    try {
      const recordId = req.params.id;
      const record = await storage.getDnsRecord(recordId);
      
      if (!record) {
        return res.status(404).json({ message: "DNS record not found" });
      }
      
      res.json(record);
    } catch (error) {
      console.error("Error fetching DNS record:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/dns-records", requireRole(["admin", "manager"]), async (req, res) => {
    try {
      console.log("Creating DNS record with request body:", JSON.stringify(req.body));
      
      // Validate the request data
      const validatedData = insertDnsRecordSchema.parse(req.body);
      console.log("Data after validation:", JSON.stringify(validatedData));
      
      // Convert "none" to null for providerId if present
      if (validatedData.providerId === "none") {
        validatedData.providerId = null;
      }
      
      // Get domain to retrieve providerId if not provided
      if (!validatedData.providerId) {
        const domain = await storage.getDomain(validatedData.domainId);
        if (domain) {
          validatedData.providerId = domain.providerId;
          console.log(`Setting providerId from domain: ${domain.providerId}`);
        } else {
          console.log(`Domain not found: ${validatedData.domainId}`);
        }
      }
      
      // Make sure content is never undefined or null for non-AUTO records
      if (!validatedData.isAutoIP && (!validatedData.content || validatedData.content.trim() === '')) {
        validatedData.content = '';
        console.log("Setting empty content for non-AUTO record");
      }
      
      try {
        console.log("Calling storage.createDnsRecord with:", JSON.stringify(validatedData));
        const record = await storage.createDnsRecord(validatedData);
        console.log("DNS record created successfully:", JSON.stringify(record));
        
        // Track history
        await storage.addDnsHistory(
          record.id,
          "create",
          undefined,
          JSON.stringify(record),
          req.user?.id
        );
        
        // Sync with provider if applicable
        try {
          const providerRecordId = await syncDnsRecordWithProvider('create', record.domainId, record);
          if (providerRecordId) {
            console.log(`Record synced with provider, got provider record ID: ${providerRecordId}`);
            // Update the record with the provider record ID
            await storage.updateDnsRecord(record.id, { 
              providerRecordId 
            });
          }
        } catch (providerError) {
          console.error("Error syncing with provider (continuing):", providerError);
          // We don't fail the request if provider sync fails
        }
        
        // Trigger webhooks
        await triggerDnsWebhooks("create", record.domainId, record, null, req.user?.id);
        
        res.status(201).json(record);
      } catch (error) {
        console.error("Error creating DNS record in storage:", error);
        res.status(500).json({ 
          message: "Failed to create DNS record", 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Validation error:", error.errors);
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        console.error("Unexpected error creating DNS record:", error);
        res.status(500).json({ 
          message: "Internal server error", 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }
  });

  // PATCH endpoint for simple updates (like toggling active status)
  app.patch("/api/dns-records/:id", requireRole(["admin", "manager"]), async (req, res) => {
    try {
      console.log("Processing DNS record PATCH for id:", req.params.id);
      console.log("PATCH payload:", JSON.stringify(req.body));
      
      const recordId = req.params.id;
      const validatedData = insertDnsRecordSchema.partial().parse(req.body);
      
      // Get current record for history
      const currentRecord = await storage.getDnsRecord(recordId);
      if (!currentRecord) {
        console.log(`DNS record not found with ID: ${recordId}`);
        return res.status(404).json({ message: "DNS record not found" });
      }
      
      console.log(`Found existing record:`, JSON.stringify(currentRecord));
      
      // For PATCH operations, we only update the specific fields provided
      console.log(`Applying PATCH with data:`, JSON.stringify(validatedData));
      
      // Update the record
      const record = await storage.updateDnsRecord(recordId, validatedData);
      
      if (!record) {
        console.log(`PATCH failed - record not found or update failed`);
        return res.status(404).json({ message: "DNS record not found or update failed" });
      }
      
      console.log(`Record patched successfully:`, JSON.stringify(record));
      
      // Track history
      await storage.addDnsHistory(
        recordId,
        "patch",
        JSON.stringify(currentRecord),
        JSON.stringify(record),
        req.user?.id
      );
      
      // Sync with provider if applicable, but only if we're changing isActive status
      if (validatedData.isActive !== undefined) {
        try {
          const providerRecordId = await syncDnsRecordWithProvider(
            'update', 
            record.domainId, 
            record, 
            record.providerRecordId || undefined
          );
          
          if (providerRecordId && providerRecordId !== record.providerRecordId) {
            console.log(`Record synced with provider, updating provider record ID: ${providerRecordId}`);
            // Update the record with the provider record ID
            await storage.updateDnsRecord(record.id, { providerRecordId });
          }
        } catch (syncError) {
          console.error("Failed to sync with provider:", syncError);
          // Don't fail the request if sync fails, just log the error
        }
      }
      
      return res.json(record);
    } catch (error) {
      console.error("Error in PATCH DNS record:", error);
      return res.status(500).json({ message: "Failed to update DNS record", error: String(error) });
    }
  });

  app.put("/api/dns-records/:id", requireRole(["admin", "manager"]), async (req, res) => {
    try {
      console.log("Processing DNS record update for id:", req.params.id);
      console.log("Update payload:", JSON.stringify(req.body));
      
      const recordId = req.params.id;
      const validatedData = insertDnsRecordSchema.partial().parse(req.body);
      
      // Convert "none" to null for providerId if present
      if (validatedData.providerId === "none") {
        validatedData.providerId = null;
      }
      
      // Get current record for history
      const currentRecord = await storage.getDnsRecord(recordId);
      if (!currentRecord) {
        console.log(`DNS record not found with ID: ${recordId}`);
        return res.status(404).json({ message: "DNS record not found" });
      }
      
      console.log(`Found existing record:`, JSON.stringify(currentRecord));
      
      // Get domain to retrieve providerId if needed
      if (!validatedData.providerId) {
        const domain = await storage.getDomain(currentRecord.domainId);
        if (domain) {
          console.log(`Using domain provider ID from domain:`, domain.providerId);
          validatedData.providerId = domain.providerId;
        }
      }
      
      // Handle the proxied field separately for Cloudflare records
      if (validatedData.proxied !== undefined) {
        console.log(`Handling proxied field with value:`, validatedData.proxied);
      }
      
      // Log what we're about to update
      console.log(`Updating record with data:`, JSON.stringify(validatedData));
      
      // Update the record
      const record = await storage.updateDnsRecord(recordId, validatedData);
      
      if (!record) {
        console.log(`Update failed - record not found or update failed`);
        return res.status(404).json({ message: "DNS record not found or update failed" });
      }
      
      console.log(`Record updated successfully:`, JSON.stringify(record));
      
      try {
        // Track history
        await storage.addDnsHistory(
          recordId,
          "update",
          JSON.stringify(currentRecord),
          JSON.stringify(record),
          req.user?.id
        );
        
        // Sync with provider if applicable
        try {
          const providerRecordId = await syncDnsRecordWithProvider(
            'update', 
            record.domainId, 
            record, 
            record.providerRecordId || undefined
          );
          
          if (providerRecordId && providerRecordId !== record.providerRecordId) {
            console.log(`Record synced with provider, updating provider record ID: ${providerRecordId}`);
            // Update the record with the provider record ID
            await storage.updateDnsRecord(record.id, { 
              providerRecordId 
            });
          }
        } catch (providerError) {
          console.error("Error syncing with provider (continuing):", providerError);
          // We don't fail the request if provider sync fails
        }
        
        // Trigger webhooks
        await triggerDnsWebhooks("update", record.domainId, record, currentRecord, req.user?.id);
      } catch (historyError) {
        // Don't fail the request if history tracking fails
        console.error("Error tracking history:", historyError);
      }
      
      res.json(record);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Validation error:", error.errors);
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        console.error("Error updating DNS record:", error);
        res.status(500).json({ 
          message: "Failed to update DNS record",
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  });

  app.delete("/api/dns-records/:id", requireRole(["admin", "manager"]), async (req, res) => {
    try {
      const recordId = req.params.id;
      console.log(`Processing DNS record deletion for ID: ${recordId}`);
      
      // Get current record for history and webhooks
      const currentRecord = await storage.getDnsRecord(recordId);
      if (!currentRecord) {
        console.log(`DNS record not found for deletion with ID: ${recordId}`);
        return res.status(404).json({ message: "DNS record not found" });
      }
      
      console.log(`Found record to delete:`, JSON.stringify(currentRecord));
      
      // Perform the deletion
      const success = await storage.deleteDnsRecord(recordId);
      
      if (!success) {
        console.log(`Delete operation failed for record ID: ${recordId}`);
        return res.status(404).json({ message: "DNS record not found or could not be deleted" });
      }
      
      console.log(`Successfully deleted record with ID: ${recordId}`);
      
      try {
        // Track history
        await storage.addDnsHistory(
          recordId,
          "delete",
          JSON.stringify(currentRecord),
          undefined,
          req.user?.id
        );
        
        // Sync with provider if applicable
        try {
          if (currentRecord.providerRecordId) {
            console.log(`Deleting record with provider record ID: ${currentRecord.providerRecordId}`);
            await syncDnsRecordWithProvider('delete', currentRecord.domainId, null, currentRecord.providerRecordId);
            console.log(`Record deleted from provider successfully`);
          } else {
            console.log(`No provider record ID found for record ${recordId}, skipping provider sync`);
          }
        } catch (providerError) {
          console.error("Error syncing with provider (continuing):", providerError);
          // We don't fail the request if provider sync fails
        }
        
        // Trigger webhooks
        await triggerDnsWebhooks("delete", currentRecord.domainId, null, currentRecord, req.user?.id);
        
        console.log(`History and webhooks processed for deleted record ${recordId}`);
      } catch (historyError) {
        // Don't fail the request if history tracking fails
        console.error("Error tracking history for deleted record:", historyError);
      }
      
      // Return success
      res.status(204).end();
    } catch (error) {
      console.error("Error deleting DNS record:", error);
      res.status(500).json({ 
        message: "Failed to delete DNS record", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  const httpServer = createServer(app);

  // Organizations
  app.get("/api/organizations", requireRole(["admin", "manager", "user", "readonly"]), async (req, res) => {
    try {
      const organizations = await storage.getOrganizations();
      res.json(organizations);
    } catch (error) {
      console.error("Error fetching organizations:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/organizations/:id", requireRole(["admin", "manager", "user", "readonly"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const organization = await storage.getOrganization(id);
      
      if (!organization) {
        return res.status(404).json({ message: "Organization not found" });
      }
      
      res.json(organization);
    } catch (error) {
      console.error("Error fetching organization:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/organizations", requireRole(["admin"]), async (req, res) => {
    try {
      const validatedData = insertOrganizationSchema.parse(req.body);
      const organization = await storage.createOrganization(validatedData);
      res.status(201).json(organization);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        console.error("Error creating organization:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.put("/api/organizations/:id", requireRole(["admin"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertOrganizationSchema.partial().parse(req.body);
      
      const updatedOrganization = await storage.updateOrganization(id, validatedData);
      
      if (!updatedOrganization) {
        return res.status(404).json({ message: "Organization not found" });
      }
      
      res.json(updatedOrganization);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        console.error("Error updating organization:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.delete("/api/organizations/:id", requireRole(["admin"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteOrganization(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Organization not found" });
      }
      
      res.status(204).end();
    } catch (error) {
      console.error("Error deleting organization:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Domains
  app.get("/api/domains", requireRole(["admin", "manager", "user", "readonly"]), async (req, res) => {
    try {
      let domains;
      const orgId = req.query.organizationId ? parseInt(req.query.organizationId as string) : undefined;
      
      if (orgId) {
        domains = await storage.getDomainsByOrganization(orgId);
      } else {
        domains = await storage.getAllDomains();
      }
      
      res.json(domains);
    } catch (error) {
      console.error("Error fetching domains:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/domains/:id", requireRole(["admin", "manager", "user", "readonly"]), async (req, res) => {
    try {
      // Use the id as a string directly without parsing as integer
      const id = req.params.id;
      const domain = await storage.getDomain(id);
      
      if (!domain) {
        return res.status(404).json({ message: "Domain not found" });
      }
      
      res.json(domain);
    } catch (error) {
      console.error("Error fetching domain:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/domains", requireRole(["admin", "manager"]), async (req, res) => {
    try {
      // Create a custom validation schema for the API that makes providerId optional
      const domainSchema = z.object({
        name: z.string(),
        organizationId: z.string().uuid(),
        providerId: z.string().uuid().optional(),
        isActive: z.boolean().optional().default(true)
      });
      
      const validatedData = domainSchema.parse(req.body);
      const domain = await storage.createDomain(validatedData);
      res.status(201).json(domain);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        console.error("Error creating domain:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.put("/api/domains/:id", requireRole(["admin", "manager"]), async (req, res) => {
    try {
      // Use id as string without parsing to int
      const id = req.params.id;
      
      // Create custom validation schema with optional providerId
      const domainUpdateSchema = z.object({
        name: z.string().optional(),
        organizationId: z.string().uuid().optional(),
        providerId: z.string().uuid().optional().nullable(),
        isActive: z.boolean().optional()
      });
      
      const validatedData = domainUpdateSchema.parse(req.body);
      
      const updatedDomain = await storage.updateDomain(id, validatedData);
      
      if (!updatedDomain) {
        return res.status(404).json({ message: "Domain not found" });
      }
      
      res.json(updatedDomain);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        console.error("Error updating domain:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.delete("/api/domains/:id", requireRole(["admin", "manager"]), async (req, res) => {
    try {
      // Use id as string without parsing
      const id = req.params.id;
      const deleted = await storage.deleteDomain(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Domain not found" });
      }
      
      res.status(204).end();
    } catch (error) {
      console.error("Error deleting domain:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // DNS Records API routes are already defined above

  // Providers
  app.get("/api/providers", requireRole(["admin", "manager", "user", "readonly"]), async (req, res) => {
    try {
      const providers = await storage.getProviders();
      
      // Mask credentials in response
      const maskedProviders = providers.map(provider => {
        if (provider.credentials) {
          return {
            ...provider,
            credentials: { masked: true }
          };
        }
        return provider;
      });
      
      res.json(maskedProviders);
    } catch (error) {
      console.error("Error fetching providers:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/providers/:id", requireRole(["admin", "manager"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const provider = await storage.getProvider(id);
      
      if (!provider) {
        return res.status(404).json({ message: "Provider not found" });
      }
      
      // Mask credentials in response
      const maskedProvider = {
        ...provider,
        credentials: provider.credentials ? { masked: true } : null
      };
      
      res.json(maskedProvider);
    } catch (error) {
      console.error("Error fetching provider:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/providers", requireRole(["admin"]), async (req, res) => {
    try {
      // Validate provider type
      const providerTypeValidator = z.enum(providerTypes);
      
      // Extend schema with validation
      const schema = insertProviderSchema.extend({
        type: providerTypeValidator
      });
      
      const validatedData = schema.parse(req.body);
      const provider = await storage.createProvider(validatedData);
      
      // Mask credentials in response
      const maskedProvider = {
        ...provider,
        credentials: provider.credentials ? { masked: true } : null
      };
      
      res.status(201).json(maskedProvider);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        console.error("Error creating provider:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.put("/api/providers/:id", requireRole(["admin"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Validate provider type
      const providerTypeValidator = z.enum(providerTypes);
      
      // Extend schema with validation
      const schema = insertProviderSchema.partial().extend({
        type: providerTypeValidator.optional()
      });
      
      const validatedData = schema.parse(req.body);
      
      const updatedProvider = await storage.updateProvider(id, validatedData);
      
      if (!updatedProvider) {
        return res.status(404).json({ message: "Provider not found" });
      }
      
      // Mask credentials in response
      const maskedProvider = {
        ...updatedProvider,
        credentials: updatedProvider.credentials ? { masked: true } : null
      };
      
      res.json(maskedProvider);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        console.error("Error updating provider:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.delete("/api/providers/:id", requireRole(["admin"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteProvider(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Provider not found" });
      }
      
      res.status(204).end();
    } catch (error) {
      console.error("Error deleting provider:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Groups
  app.get("/api/groups", requireRole(["admin", "manager"]), async (req, res) => {
    try {
      const groups = await storage.getGroups();
      res.json(groups);
    } catch (error) {
      console.error("Error fetching groups:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/groups/:id", requireRole(["admin", "manager"]), async (req, res) => {
    try {
      const id = req.params.id;
      const group = await storage.getGroup(id);
      
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
      
      res.json(group);
    } catch (error) {
      console.error("Error fetching group:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/groups/:id/members", requireRole(["admin", "manager"]), async (req, res) => {
    try {
      const id = req.params.id;
      const members = await storage.getGroupMembers(id);
      res.json(members);
    } catch (error) {
      console.error("Error fetching group members:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/groups", requireRole(["admin", "manager"]), async (req, res) => {
    try {
      const validatedData = insertGroupSchema.parse({
        ...req.body,
        createdBy: req.user?.id
      });
      const group = await storage.createGroup(validatedData);
      res.status(201).json(group);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        console.error("Error creating group:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.put("/api/groups/:id", requireRole(["admin", "manager"]), async (req, res) => {
    try {
      const id = req.params.id;
      const validatedData = insertGroupSchema.partial().parse(req.body);
      
      const updatedGroup = await storage.updateGroup(id, validatedData);
      
      if (!updatedGroup) {
        return res.status(404).json({ message: "Group not found" });
      }
      
      res.json(updatedGroup);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        console.error("Error updating group:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.delete("/api/groups/:id", requireRole(["admin", "manager"]), async (req, res) => {
    try {
      const id = req.params.id;
      const deleted = await storage.deleteGroup(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Group not found" });
      }
      
      res.status(204).end();
    } catch (error) {
      console.error("Error deleting group:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Group Members
  app.post("/api/group-members", requireRole(["admin", "manager"]), async (req, res) => {
    try {
      // Validate member type
      const memberTypeValidator = z.enum(memberTypes);
      
      // Extend schema with validation
      const schema = insertGroupMemberSchema.extend({
        memberType: memberTypeValidator
      });
      
      const validatedData = schema.parse({
        ...req.body,
        addedBy: req.user?.id
      });
      
      const member = await storage.addGroupMember(validatedData);
      res.status(201).json(member);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        console.error("Error adding group member:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.delete("/api/group-members/:id", requireRole(["admin", "manager"]), async (req, res) => {
    try {
      const id = req.params.id;
      const deleted = await storage.removeGroupMember(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Group member not found" });
      }
      
      res.status(204).end();
    } catch (error) {
      console.error("Error removing group member:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // API Tokens
  app.get("/api/api-tokens", requireRole(["admin", "manager"]), async (req, res) => {
    try {
      let tokens;
      const orgId = req.query.organizationId ? parseInt(req.query.organizationId as string) : undefined;
      
      if (orgId) {
        tokens = await storage.getApiTokensByOrganization(orgId);
      } else if (req.user?.role === "admin") {
        // Admins can see all tokens
        const allOrgs = await storage.getOrganizations();
        tokens = await Promise.all(
          allOrgs.map(org => storage.getApiTokensByOrganization(org.id))
        ).then(results => results.flat());
      } else {
        // Others can only see tokens for their organization
        tokens = req.user?.organizationId 
          ? await storage.getApiTokensByOrganization(req.user.organizationId)
          : [];
      }
      
      // Mask token values
      const maskedTokens = tokens.map(token => ({
        ...token,
        token: token.token.substring(0, 8) + '...'
      }));
      
      res.json(maskedTokens);
    } catch (error) {
      console.error("Error fetching API tokens:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/api-tokens", requireRole(["admin", "manager"]), async (req, res) => {
    try {
      // Generate a random token
      const tokenValue = randomBytes(32).toString('hex');
      
      // Validate permissions
      const permissionsValidator = z.array(z.enum(["admin", "manager", "user", "readonly"]));
      
      // Create schema with additional validation
      const schema = insertApiTokenSchema
        .omit({ token: true })
        .extend({
          permissions: permissionsValidator,
          name: z.string().min(1)
        });
      
      const validatedData = schema.parse(req.body);
      
      // Set token value and created by
      const tokenData = {
        ...validatedData,
        token: tokenValue,
        createdBy: req.user?.id
      };
      
      const token = await storage.createApiToken(tokenData);
      
      // Return the full token only on creation
      res.status(201).json(token);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        console.error("Error creating API token:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.put("/api/api-tokens/:id", requireRole(["admin", "manager"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Get the token
      const token = await storage.getApiToken(id);
      
      if (!token) {
        return res.status(404).json({ message: "API token not found" });
      }
      
      // Verify permission: only admin can modify any token, managers can only modify their org's tokens
      if (req.user?.role !== "admin" && token.organizationId !== req.user?.organizationId) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      
      // Validate permissions
      const permissionsValidator = z.array(z.enum(["admin", "manager", "user", "readonly"])).optional();
      
      // Create schema with additional validation
      const schema = insertApiTokenSchema
        .omit({ token: true })
        .partial()
        .extend({
          permissions: permissionsValidator,
          name: z.string().min(1).optional()
        });
      
      const validatedData = schema.parse(req.body);
      
      const updatedToken = await storage.updateApiToken(id, validatedData);
      
      if (!updatedToken) {
        return res.status(404).json({ message: "API token not found" });
      }
      
      // Mask token in response
      const maskedToken = {
        ...updatedToken,
        token: updatedToken.token.substring(0, 8) + '...'
      };
      
      res.json(maskedToken);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        console.error("Error updating API token:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.delete("/api/api-tokens/:id", requireRole(["admin", "manager"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Get the token
      const token = await storage.getApiToken(id);
      
      if (!token) {
        return res.status(404).json({ message: "API token not found" });
      }
      
      // Verify permission: only admin can delete any token, managers can only delete their org's tokens
      if (req.user?.role !== "admin" && token.organizationId !== req.user?.organizationId) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      
      const deleted = await storage.deleteApiToken(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "API token not found" });
      }
      
      res.status(204).end();
    } catch (error) {
      console.error("Error deleting API token:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // DNS History
  app.get("/api/dns-history/record/:recordId", requireRole(["admin", "manager", "user", "readonly"]), async (req, res) => {
    try {
      const recordId = parseInt(req.params.recordId);
      const history = await storage.getDnsHistoryByRecord(recordId);
      res.json(history);
    } catch (error) {
      console.error("Error fetching DNS history:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/dns-history/domain/:domainId", requireRole(["admin", "manager", "user", "readonly"]), async (req, res) => {
    try {
      const domainId = parseInt(req.params.domainId);
      const history = await storage.getDnsHistoryByDomain(domainId);
      res.json(history);
    } catch (error) {
      console.error("Error fetching DNS history:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // User Management (admin only)
  app.get("/api/users", requireRole(["admin"]), async (req, res) => {
    try {
      // This would use a real database query to get all users
      // For the in-memory storage, we'll return the currently stored users
      const users = Array.from(storage.usersMap ? storage.usersMap.values() : []);
      
      // Remove passwords from response
      const sanitizedUsers = users.map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });
      
      res.json(sanitizedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // DNS Metrics
  app.get("/api/dns-metrics", requireRole(["admin", "manager", "user", "readonly"]), async (req, res) => {
    try {
      const metricType = req.query.type ? req.query.type as string : undefined;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      
      const metrics = await storage.getDnsMetricsByType(
        metricType || "all",
        startDate,
        endDate
      );
      
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching DNS metrics:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get("/api/dns-metrics/domain/:domainId", requireRole(["admin", "manager", "user", "readonly"]), async (req, res) => {
    try {
      const domainId = req.params.domainId;
      const metricType = req.query.type ? req.query.type as string : undefined;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      
      const metrics = await storage.getDnsMetricsByDomain(
        domainId,
        metricType,
        startDate,
        endDate
      );
      
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching domain DNS metrics:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get("/api/dns-metrics/record/:recordId", requireRole(["admin", "manager", "user", "readonly"]), async (req, res) => {
    try {
      const recordId = req.params.recordId;
      const metricType = req.query.type ? req.query.type as string : undefined;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      
      const metrics = await storage.getDnsMetricsByRecord(
        recordId,
        metricType,
        startDate,
        endDate
      );
      
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching record DNS metrics:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post("/api/dns-metrics", requireRole(["admin", "manager"]), async (req, res) => {
    try {
      const validatedData = insertDnsMetricSchema.parse(req.body);
      const metric = await storage.addDnsMetric(validatedData);
      res.status(201).json(metric);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        console.error("Error creating DNS metric:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  // Webhooks
  app.get("/api/webhooks", async (req, res) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      // Check if user has appropriate role (admin or manager)
      const userRole = req.user?.role;
      if (userRole !== 'admin' && userRole !== 'manager') {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      
      let webhooks;
      const orgId = req.query.organizationId as string;
      
      if (orgId) {
        // For specific organization, check if user belongs to that org
        if (userRole !== "admin" && req.user?.organizationId !== orgId) {
          return res.status(403).json({ message: "Insufficient permissions" });
        }
        webhooks = await storage.getWebhooksByOrganization(orgId);
      } else if (userRole === "admin") {
        // Admins can see all webhooks
        const allOrgs = await storage.getOrganizations();
        webhooks = await Promise.all(
          allOrgs.map(org => storage.getWebhooksByOrganization(org.id))
        ).then(results => results.flat());
      } else {
        // Others can only see webhooks for their organization
        webhooks = req.user?.organizationId 
          ? await storage.getWebhooksByOrganization(req.user.organizationId)
          : [];
      }
      
      res.json(webhooks);
    } catch (error) {
      console.error("Error fetching webhooks:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/webhooks/:id", requireRole(["admin", "manager"]), async (req, res) => {
    try {
      const webhook = await storage.getWebhook(req.params.id);
      
      if (!webhook) {
        return res.status(404).json({ message: "Webhook not found" });
      }
      
      // Check authorization
      if (req.user?.role !== "admin" && webhook.organizationId !== req.user?.organizationId) {
        return res.status(403).json({ message: "Not authorized to access this webhook" });
      }
      
      res.json(webhook);
    } catch (error) {
      console.error("Error fetching webhook:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/webhooks", requireRole(["admin", "manager"]), async (req, res) => {
    try {
      // Merge request body with user ID before validation
      const requestData = {
        ...req.body,
        createdBy: req.user?.id // Add the user who created it
      };
      
      // Then validate the complete data
      const validatedData = insertWebhookSchema.parse(requestData);
      
      // Check authorization for non-admin users
      if (req.user?.role !== "admin" && validatedData.organizationId !== req.user?.organizationId) {
        return res.status(403).json({ message: "Not authorized to create webhooks for this organization" });
      }
      
      const webhook = await storage.createWebhook(validatedData);
      res.status(201).json(webhook);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Validation error:", error.errors);
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        console.error("Error creating webhook:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.put("/api/webhooks/:id", requireRole(["admin", "manager"]), async (req, res) => {
    try {
      const webhook = await storage.getWebhook(req.params.id);
      
      if (!webhook) {
        return res.status(404).json({ message: "Webhook not found" });
      }
      
      // Check authorization
      if (req.user?.role !== "admin" && webhook.organizationId !== req.user?.organizationId) {
        return res.status(403).json({ message: "Not authorized to modify this webhook" });
      }
      
      const validatedData = insertWebhookSchema.partial().parse(req.body);
      
      // Prevent changing organization for security reasons
      if (validatedData.organizationId && validatedData.organizationId !== webhook.organizationId) {
        return res.status(400).json({ message: "Cannot change webhook organization" });
      }
      
      const updatedWebhook = await storage.updateWebhook(req.params.id, validatedData);
      res.json(updatedWebhook);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        console.error("Error updating webhook:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.delete("/api/webhooks/:id", requireRole(["admin", "manager"]), async (req, res) => {
    try {
      const webhook = await storage.getWebhook(req.params.id);
      
      if (!webhook) {
        return res.status(404).json({ message: "Webhook not found" });
      }
      
      // Check authorization
      if (req.user?.role !== "admin" && webhook.organizationId !== req.user?.organizationId) {
        return res.status(403).json({ message: "Not authorized to delete this webhook" });
      }
      
      const deleted = await storage.deleteWebhook(req.params.id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Webhook not found" });
      }
      
      res.status(204).end();
    } catch (error) {
      console.error("Error deleting webhook:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Test webhook endpoint
  app.post("/api/webhooks/:id/test", requireRole(["admin", "manager"]), async (req, res) => {
    try {
      const webhook = await storage.getWebhook(req.params.id);
      
      if (!webhook) {
        return res.status(404).json({ message: "Webhook not found" });
      }
      
      // Check authorization
      if (req.user?.role !== "admin" && webhook.organizationId !== req.user?.organizationId) {
        return res.status(403).json({ message: "Not authorized to test this webhook" });
      }
      
      const testPayload = {
        event: "test",
        timestamp: new Date().toISOString(),
        data: {
          message: "This is a test notification from the DNS Manager",
          initiatedBy: {
            userId: req.user!.id,
            username: req.user!.username
          }
        }
      };
      
      const success = await storage.triggerWebhook(req.params.id, testPayload);
      
      if (success) {
        res.status(200).json({ message: "Test webhook triggered successfully" });
      } else {
        res.status(500).json({ message: "Failed to trigger webhook" });
      }
    } catch (error) {
      console.error("Error testing webhook:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Webhook Delivery Log endpoints
  
  // Get all delivery logs for a webhook
  app.get("/api/webhooks/:id/logs", requireRole(["admin", "manager"]), async (req, res) => {
    try {
      // First check if the webhook exists
      const webhook = await storage.getWebhook(req.params.id);
      
      if (!webhook) {
        return res.status(404).json({ message: "Webhook not found" });
      }
      
      // Permission check: admin can view all logs, others only for their organization's webhooks
      if (req.user?.role !== "admin" && webhook.organizationId !== req.user?.organizationId) {
        return res.status(403).json({ message: "Not authorized to access logs for this webhook" });
      }
      
      try {
        // Try to get logs with proper error handling
        const logs = await storage.getWebhookDeliveryLogsByWebhook(req.params.id);
        res.json(logs);
      } catch (logError) {
        // If there's a database schema issue, return an empty array instead of crashing
        console.error("Error fetching webhook logs:", logError);
        res.json([]);
      }
    } catch (error) {
      console.error("Error in webhook logs endpoint:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Get a specific delivery log by ID
  app.get("/api/webhook-logs/:id", requireRole(["admin", "manager"]), async (req, res) => {
    try {
      const log = await storage.getWebhookDeliveryLog(req.params.id);
      
      if (!log) {
        return res.status(404).json({ message: "Webhook delivery log not found" });
      }
      
      // Need to get the webhook to check permissions
      const webhook = await storage.getWebhook(log.webhookId);
      
      if (!webhook) {
        return res.status(404).json({ message: "Associated webhook not found" });
      }
      
      // Permission check
      if (req.user?.role !== "admin" && webhook.organizationId !== req.user?.organizationId) {
        return res.status(403).json({ message: "Not authorized to access this log" });
      }
      
      res.json(log);
    } catch (error) {
      console.error("Error fetching webhook delivery log:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Retry a failed webhook delivery
  app.post("/api/webhook-logs/:id/retry", requireRole(["admin", "manager"]), async (req, res) => {
    try {
      const log = await storage.getWebhookDeliveryLog(req.params.id);
      
      if (!log) {
        return res.status(404).json({ message: "Webhook delivery log not found" });
      }
      
      // Need to get the webhook to check permissions and retry
      const webhook = await storage.getWebhook(log.webhookId);
      
      if (!webhook) {
        return res.status(404).json({ message: "Associated webhook not found" });
      }
      
      // Permission check
      if (req.user?.role !== "admin" && webhook.organizationId !== req.user?.organizationId) {
        return res.status(403).json({ message: "Not authorized to retry this webhook" });
      }
      
      // Only retry failed deliveries
      if (log.status) {
        return res.status(400).json({ message: "Cannot retry successful webhook delivery" });
      }
      
      // Retry the webhook with the original payload but increment retry count
      const retrySuccess = await storage.triggerWebhook(
        webhook.id,
        log.payload,
        log.retryCount + 1
      );
      
      if (retrySuccess) {
        res.status(200).json({ message: "Webhook delivery retried successfully" });
      } else {
        res.status(500).json({ message: "Failed to retry webhook delivery" });
      }
    } catch (error) {
      console.error("Error retrying webhook delivery:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Custom Roles endpoints
  
  // Get all custom roles
  app.get("/api/roles/custom", requireRole(["admin"]), async (req, res) => {
    try {
      // Only admins can view custom roles
      const customRoles = await db.query.customRoles.findMany({
        orderBy: (roles, { desc }) => [desc(roles.createdAt)],
      });
      
      res.json(customRoles);
    } catch (error) {
      console.error("Error fetching custom roles:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Get a single custom role by ID
  app.get("/api/roles/custom/:id", requireRole(["admin"]), async (req, res) => {
    try {
      const role = await db.query.customRoles.findFirst({
        where: eq(customRoles.id, req.params.id),
      });
      
      if (!role) {
        return res.status(404).json({ message: "Role not found" });
      }
      
      res.json(role);
    } catch (error) {
      console.error("Error fetching custom role:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Create a new custom role
  app.post("/api/roles/custom", requireRole(["admin"]), async (req, res) => {
    try {
      const validatedData = insertCustomRoleSchema.parse(req.body);
      
      // Check if a role with this name already exists
      const existingRole = await db.query.customRoles.findFirst({
        where: eq(customRoles.name, validatedData.name),
      });
      
      if (existingRole) {
        return res.status(400).json({ message: "A role with this name already exists" });
      }
      
      const [newRole] = await db.insert(customRoles).values(validatedData).returning();
      
      res.status(201).json(newRole);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        console.error("Error creating custom role:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });
  
  // Update a custom role
  app.put("/api/roles/custom/:id", requireRole(["admin"]), async (req, res) => {
    try {
      const roleId = req.params.id;
      
      // Check if the role exists
      const existingRole = await db.query.customRoles.findFirst({
        where: eq(customRoles.id, roleId),
      });
      
      if (!existingRole) {
        return res.status(404).json({ message: "Role not found" });
      }
      
      // Validate the request data
      const validatedData = insertCustomRoleSchema.partial().parse(req.body);
      
      // If name is being updated, check for duplicates
      if (validatedData.name && validatedData.name !== existingRole.name) {
        const duplicateName = await db.query.customRoles.findFirst({
          where: eq(customRoles.name, validatedData.name),
        });
        
        if (duplicateName) {
          return res.status(400).json({ message: "A role with this name already exists" });
        }
      }
      
      // Update the role
      const [updatedRole] = await db
        .update(customRoles)
        .set(validatedData)
        .where(eq(customRoles.id, roleId))
        .returning();
      
      res.json(updatedRole);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        console.error("Error updating custom role:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });
  
  // Delete a custom role
  app.delete("/api/roles/custom/:id", requireRole(["admin"]), async (req, res) => {
    try {
      const roleId = req.params.id;
      
      // Check if the role exists
      const existingRole = await db.query.customRoles.findFirst({
        where: eq(customRoles.id, roleId),
      });
      
      if (!existingRole) {
        return res.status(404).json({ message: "Role not found" });
      }
      
      // Delete the role
      await db.delete(customRoles).where(eq(customRoles.id, roleId));
      
      res.status(204).end();
    } catch (error) {
      console.error("Error deleting custom role:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  return httpServer;
}
