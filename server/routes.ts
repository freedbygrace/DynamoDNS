import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, requireRole } from "./auth";
import { z } from "zod";
import {
  insertDomainSchema,
  insertDnsRecordSchema,
  insertProviderSchema,
  insertApiTokenSchema,
  insertOrganizationSchema,
  insertWebhookSchema,
  insertDnsMetricSchema,
  recordTypes,
  providerTypes
} from "@shared/schema";
import { randomBytes } from "crypto";

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
      const id = parseInt(req.params.id);
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
      const validatedData = insertDomainSchema.parse(req.body);
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
      const id = parseInt(req.params.id);
      const validatedData = insertDomainSchema.partial().parse(req.body);
      
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
      const id = parseInt(req.params.id);
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

  // DNS Records
  app.get("/api/dns-records", requireRole(["admin", "manager", "user", "readonly"]), async (req, res) => {
    try {
      const domainId = req.query.domainId ? parseInt(req.query.domainId as string) : undefined;
      
      if (!domainId) {
        return res.status(400).json({ message: "Domain ID is required" });
      }
      
      const records = await storage.getDnsRecordsByDomain(domainId);
      res.json(records);
    } catch (error) {
      console.error("Error fetching DNS records:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/dns-records/:id", requireRole(["admin", "manager", "user", "readonly"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const record = await storage.getDnsRecord(id);
      
      if (!record) {
        return res.status(404).json({ message: "DNS record not found" });
      }
      
      res.json(record);
    } catch (error) {
      console.error("Error fetching DNS record:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/dns-records", requireRole(["admin", "manager", "user"]), async (req, res) => {
    try {
      // Validate record type
      const recordTypeValidator = z.enum(recordTypes);
      
      // Extend schema with validation
      const schema = insertDnsRecordSchema.extend({
        type: recordTypeValidator
      });
      
      const validatedData = schema.parse(req.body);
      
      // Get the previous record if it exists
      let previousRecord = null;
      const records = await storage.getDnsRecordsByDomain(validatedData.domainId);
      previousRecord = records.find(r => r.name === validatedData.name && r.type === validatedData.type);
      
      // Create the new record
      const record = await storage.createDnsRecord(validatedData);
      
      // Add to history
      await storage.addDnsHistory(
        record.id,
        "create",
        previousRecord ? JSON.stringify(previousRecord) : undefined,
        JSON.stringify(record),
        req.user?.id
      );
      
      // Trigger webhooks
      await triggerDnsWebhooks(
        "create",
        record.domainId,
        record,
        previousRecord,
        req.user?.id || null
      );
      
      res.status(201).json(record);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        console.error("Error creating DNS record:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.put("/api/dns-records/:id", requireRole(["admin", "manager", "user"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Get the previous record
      const previousRecord = await storage.getDnsRecord(id);
      
      if (!previousRecord) {
        return res.status(404).json({ message: "DNS record not found" });
      }
      
      // Validate record type
      const recordTypeValidator = z.enum(recordTypes);
      
      // Extend schema with validation
      const schema = insertDnsRecordSchema.partial().extend({
        type: recordTypeValidator.optional()
      });
      
      const validatedData = schema.parse(req.body);
      
      // Update the record
      const updatedRecord = await storage.updateDnsRecord(id, validatedData);
      
      if (!updatedRecord) {
        return res.status(404).json({ message: "DNS record not found" });
      }
      
      // Add to history
      await storage.addDnsHistory(
        id,
        "update",
        JSON.stringify(previousRecord),
        JSON.stringify(updatedRecord),
        req.user?.id
      );
      
      // Trigger webhooks
      await triggerDnsWebhooks(
        "update",
        updatedRecord.domainId,
        updatedRecord,
        previousRecord,
        req.user?.id || null
      );
      
      res.json(updatedRecord);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        console.error("Error updating DNS record:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.delete("/api/dns-records/:id", requireRole(["admin", "manager"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Get the record before deletion
      const record = await storage.getDnsRecord(id);
      
      if (!record) {
        return res.status(404).json({ message: "DNS record not found" });
      }
      
      const deleted = await storage.deleteDnsRecord(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "DNS record not found" });
      }
      
      // Add to history
      await storage.addDnsHistory(
        id,
        "delete",
        JSON.stringify(record),
        undefined,
        req.user?.id
      );
      
      // Trigger webhooks
      await triggerDnsWebhooks(
        "delete",
        record.domainId,
        record,
        null,
        req.user?.id || null
      );
      
      res.status(204).end();
    } catch (error) {
      console.error("Error deleting DNS record:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

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

  // Webhooks
  app.get("/api/webhooks", requireRole(["admin", "manager"]), async (req, res) => {
    try {
      let webhooks;
      const orgId = req.query.organizationId as string;
      
      if (orgId) {
        webhooks = await storage.getWebhooksByOrganization(orgId);
      } else if (req.user?.role === "admin") {
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
      const validatedData = insertWebhookSchema.parse(req.body);
      
      // Add the user who created it
      validatedData.createdBy = req.user!.id;
      
      // Check authorization for non-admin users
      if (req.user?.role !== "admin" && validatedData.organizationId !== req.user?.organizationId) {
        return res.status(403).json({ message: "Not authorized to create webhooks for this organization" });
      }
      
      const webhook = await storage.createWebhook(validatedData);
      res.status(201).json(webhook);
    } catch (error) {
      if (error instanceof z.ZodError) {
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
      const webhook = await storage.getWebhook(req.params.id);
      
      if (!webhook) {
        return res.status(404).json({ message: "Webhook not found" });
      }
      
      // Permission check: admin can view all logs, others only for their organization's webhooks
      if (req.user?.role !== "admin" && webhook.organizationId !== req.user?.organizationId) {
        return res.status(403).json({ message: "Not authorized to access logs for this webhook" });
      }
      
      const logs = await storage.getWebhookDeliveryLogsByWebhook(req.params.id);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching webhook delivery logs:", error);
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

  return httpServer;
}
