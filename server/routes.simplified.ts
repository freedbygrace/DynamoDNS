import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { getCurrentIpAddress, getCurrentIpv6Address } from "./utils/ip-utils";
import { setupAuth, requireRole } from "./auth";
import { z } from "zod";
import { 
  insertCustomerSchema, 
  insertDomainSchema, 
  insertDnsRecordSchema,
  insertCustomerUserAssignmentSchema,
  insertProviderSchema,
  insertDomainCredentialsSchema,
  insertApiTokenSchema,
  insertCustomRoleSchema
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Create HTTP server
  const httpServer = createServer(app);

  // Setup authentication routes
  setupAuth(app);

  // Add public IP endpoint for the frontend
  app.get('/api/public-ip', async (req, res) => {
    try {
      console.log('Fetching public IP addresses');
      // Get IPv4 address using our utility function
      const ipv4 = await getCurrentIpAddress();
      console.log(`Resolved IPv4: ${ipv4}`);
      
      // Try to get IPv6 as well
      const ipv6 = await getCurrentIpv6Address();
      console.log(`Resolved IPv6: ${ipv6}`);
      
      res.json({ ipv4, ipv6 });
    } catch (error) {
      console.error('Error getting public IP:', error);
      res.status(500).json({ error: 'Failed to get public IP address' });
    }
  });

  // Customer routes
  app.get("/api/customers", requireRole(["admin", "manager"]), async (req, res) => {
    try {
      const customers = await storage.getCustomers();
      res.json(customers);
    } catch (error) {
      console.error("Error getting customers:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/customers/:id", requireRole(["admin", "manager", "user", "readonly"]), async (req, res) => {
    try {
      const customer = await storage.getCustomer(req.params.id);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      console.error("Error getting customer:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/customers", requireRole(["admin"]), async (req, res) => {
    try {
      const validatedData = insertCustomerSchema.parse(req.body);
      const customer = await storage.createCustomer(validatedData);
      res.status(201).json(customer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        console.error("Error creating customer:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.put("/api/customers/:id", requireRole(["admin"]), async (req, res) => {
    try {
      const validatedData = insertCustomerSchema.partial().parse(req.body);
      const customer = await storage.updateCustomer(req.params.id, validatedData);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        console.error("Error updating customer:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.delete("/api/customers/:id", requireRole(["admin"]), async (req, res) => {
    try {
      const success = await storage.deleteCustomer(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Customer not found" });
      }
      res.status(204).end();
    } catch (error) {
      console.error("Error deleting customer:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Domain routes
  app.get("/api/domains", requireRole(["admin", "manager", "user", "readonly"]), async (req, res) => {
    try {
      const { customerId } = req.query;
      
      let domains;
      if (customerId) {
        domains = await storage.getDomainsByCustomer(customerId as string);
      } else {
        domains = await storage.getAllDomains();
      }
      
      res.json(domains);
    } catch (error) {
      console.error("Error getting domains:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/domains/:id", requireRole(["admin", "manager", "user", "readonly"]), async (req, res) => {
    try {
      const domain = await storage.getDomain(req.params.id);
      if (!domain) {
        return res.status(404).json({ message: "Domain not found" });
      }
      res.json(domain);
    } catch (error) {
      console.error("Error getting domain:", error);
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
      const validatedData = insertDomainSchema.partial().parse(req.body);
      const domain = await storage.updateDomain(req.params.id, validatedData);
      if (!domain) {
        return res.status(404).json({ message: "Domain not found" });
      }
      res.json(domain);
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
      const success = await storage.deleteDomain(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Domain not found" });
      }
      res.status(204).end();
    } catch (error) {
      console.error("Error deleting domain:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // DNS Records routes
  app.get("/api/dns-records", requireRole(["admin", "manager", "user", "readonly"]), async (req, res) => {
    try {
      const { domainId } = req.query;
      
      if (!domainId) {
        return res.status(400).json({ message: "Domain ID is required" });
      }
      
      const records = await storage.getDnsRecordsByDomain(domainId as string);
      res.json(records);
    } catch (error) {
      console.error("Error getting DNS records:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/dns-records/:id", requireRole(["admin", "manager", "user", "readonly"]), async (req, res) => {
    try {
      const record = await storage.getDnsRecord(req.params.id);
      if (!record) {
        return res.status(404).json({ message: "DNS record not found" });
      }
      res.json(record);
    } catch (error) {
      console.error("Error getting DNS record:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/dns-records", requireRole(["admin", "manager", "user"]), async (req, res) => {
    try {
      // Validate and parse input
      const validatedData = insertDnsRecordSchema.parse(req.body);
      
      // Special handling for AutoIP records
      if (validatedData.isAutoIP) {
        try {
          // Get the current IPv4 address
          const ipv4 = await getCurrentIpAddress();
          
          // If this is an A record, update the content with the current IP
          if (validatedData.type === "A") {
            validatedData.content = ipv4;
          }
          
          // If this is an AAAA record, try to get IPv6 address
          if (validatedData.type === "AAAA") {
            const ipv6 = await getCurrentIpv6Address();
            if (ipv6) {
              validatedData.content = ipv6;
            } else {
              // If no IPv6 available, return an error
              return res.status(400).json({ 
                message: "Cannot create an AAAA record with Auto IP enabled - no IPv6 address detected" 
              });
            }
          }
        } catch (ipError) {
          console.error("Error getting IP for AutoIP record:", ipError);
        }
      }
      
      // Create the record
      const record = await storage.createDnsRecord(validatedData);
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
      // Validate and parse input
      const validatedData = insertDnsRecordSchema.partial().parse(req.body);
      
      // Special handling for AutoIP records
      if (validatedData.isAutoIP) {
        // Get the current record to check its type
        const currentRecord = await storage.getDnsRecord(req.params.id);
        if (!currentRecord) {
          return res.status(404).json({ message: "DNS record not found" });
        }
        
        try {
          // Get the current IPv4 address
          const ipv4 = await getCurrentIpAddress();
          
          // If this is an A record, update the content with the current IP
          if (currentRecord.type === "A") {
            validatedData.content = ipv4;
          }
          
          // If this is an AAAA record, try to get IPv6 address
          if (currentRecord.type === "AAAA") {
            const ipv6 = await getCurrentIpv6Address();
            if (ipv6) {
              validatedData.content = ipv6;
            } else {
              // If no IPv6 available, return an error
              return res.status(400).json({ 
                message: "Cannot update an AAAA record with Auto IP enabled - no IPv6 address detected" 
              });
            }
          }
        } catch (ipError) {
          console.error("Error getting IP for AutoIP record:", ipError);
        }
      }
      
      // Update the record
      const record = await storage.updateDnsRecord(req.params.id, validatedData);
      if (!record) {
        return res.status(404).json({ message: "DNS record not found" });
      }
      res.json(record);
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
      const success = await storage.deleteDnsRecord(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "DNS record not found" });
      }
      res.status(204).end();
    } catch (error) {
      console.error("Error deleting DNS record:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Customer-User Assignment routes - for managing user access to customers
  app.get("/api/customer-users", requireRole(["admin", "manager"]), async (req, res) => {
    try {
      const { customerId, userId } = req.query;
      
      let assignments = [];
      if (customerId) {
        // Get all users assigned to a specific customer
        assignments = await storage.getCustomerUsers(customerId as string);
      } else if (userId) {
        // Get all customers assigned to a specific user
        assignments = await storage.getUserCustomers(userId as string);
      } else {
        return res.status(400).json({ message: "Either customerId or userId query parameter is required" });
      }
      
      res.json(assignments);
    } catch (error) {
      console.error("Error getting customer-user assignments:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/customer-users", requireRole(["admin"]), async (req, res) => {
    try {
      const validatedData = insertCustomerUserAssignmentSchema.parse(req.body);
      const assignment = await storage.assignUserToCustomer(validatedData);
      res.status(201).json(assignment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        console.error("Error creating customer-user assignment:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.put("/api/customer-users", requireRole(["admin"]), async (req, res) => {
    try {
      const { customerId, userId, role } = req.body;
      
      if (!customerId || !userId || !role) {
        return res.status(400).json({ message: "customerId, userId, and role are required" });
      }
      
      const assignment = await storage.updateUserCustomerRole(customerId, userId, role);
      if (!assignment) {
        return res.status(404).json({ message: "Customer-user assignment not found" });
      }
      
      res.json(assignment);
    } catch (error) {
      console.error("Error updating customer-user role:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/customer-users", requireRole(["admin"]), async (req, res) => {
    try {
      const { customerId, userId } = req.query;
      
      if (!customerId || !userId) {
        return res.status(400).json({ message: "customerId and userId query parameters are required" });
      }
      
      const success = await storage.removeUserFromCustomer(customerId as string, userId as string);
      if (!success) {
        return res.status(404).json({ message: "Customer-user assignment not found" });
      }
      
      res.status(204).end();
    } catch (error) {
      console.error("Error deleting customer-user assignment:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Provider routes
  app.get("/api/providers", requireRole(["admin", "manager", "user", "readonly"]), async (req, res) => {
    try {
      const providers = await storage.getProviders();
      res.json(providers);
    } catch (error) {
      console.error("Error getting providers:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get("/api/providers/:id", requireRole(["admin", "manager", "user", "readonly"]), async (req, res) => {
    try {
      const provider = await storage.getProvider(req.params.id);
      if (!provider) {
        return res.status(404).json({ message: "Provider not found" });
      }
      res.json(provider);
    } catch (error) {
      console.error("Error getting provider:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post("/api/providers", requireRole(["admin"]), async (req, res) => {
    try {
      const validatedData = insertProviderSchema.parse(req.body);
      const provider = await storage.createProvider(validatedData);
      res.status(201).json(provider);
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
      const validatedData = insertProviderSchema.partial().parse(req.body);
      const provider = await storage.updateProvider(req.params.id, validatedData);
      if (!provider) {
        return res.status(404).json({ message: "Provider not found" });
      }
      res.json(provider);
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
      const success = await storage.deleteProvider(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Provider not found" });
      }
      res.status(204).end();
    } catch (error) {
      console.error("Error deleting provider:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Domain Credentials routes
  app.get("/api/domain-credentials/:domainId", requireRole(["admin", "manager"]), async (req, res) => {
    try {
      const credentials = await storage.getDomainCredentials(req.params.domainId);
      if (!credentials) {
        return res.status(404).json({ message: "Domain credentials not found" });
      }
      res.json(credentials);
    } catch (error) {
      console.error("Error getting domain credentials:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post("/api/domain-credentials", requireRole(["admin", "manager"]), async (req, res) => {
    try {
      const validatedData = insertDomainCredentialsSchema.parse(req.body);
      const credentials = await storage.createDomainCredentials(validatedData);
      res.status(201).json(credentials);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        console.error("Error creating domain credentials:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });
  
  app.put("/api/domain-credentials/:domainId", requireRole(["admin", "manager"]), async (req, res) => {
    try {
      const validatedData = insertDomainCredentialsSchema.partial().parse(req.body);
      const credentials = await storage.updateDomainCredentials(req.params.domainId, validatedData);
      if (!credentials) {
        return res.status(404).json({ message: "Domain credentials not found" });
      }
      res.json(credentials);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        console.error("Error updating domain credentials:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });
  
  // API Token routes
  app.get("/api/api-tokens", requireRole(["admin"]), async (req, res) => {
    try {
      const { customerId } = req.query;
      
      let tokens = [];
      if (customerId) {
        tokens = await storage.getApiTokensByCustomer(customerId as string);
      } else {
        tokens = await storage.getApiTokens();
      }
      
      // Mask the actual token values for security
      const maskedTokens = tokens.map(token => ({
        ...token,
        token: token.token ? token.token.substring(0, 6) + "************" : null
      }));
      
      res.json(maskedTokens);
    } catch (error) {
      console.error("Error getting API tokens:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get("/api/api-tokens/:id", requireRole(["admin"]), async (req, res) => {
    try {
      const token = await storage.getApiToken(req.params.id);
      if (!token) {
        return res.status(404).json({ message: "API token not found" });
      }
      
      // Mask the actual token value for security
      const maskedToken = {
        ...token,
        token: token.token ? token.token.substring(0, 6) + "************" : null
      };
      
      res.json(maskedToken);
    } catch (error) {
      console.error("Error getting API token:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post("/api/api-tokens", requireRole(["admin"]), async (req, res) => {
    try {
      const validatedData = insertApiTokenSchema.parse(req.body);
      
      // Add the current user as the creator if not specified
      if (!validatedData.createdBy && req.user) {
        validatedData.createdBy = req.user.id;
      }
      
      const token = await storage.createApiToken(validatedData);
      
      // Return the full token value only once during creation
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
  
  app.put("/api/api-tokens/:id", requireRole(["admin"]), async (req, res) => {
    try {
      const validatedData = insertApiTokenSchema.partial().parse(req.body);
      const token = await storage.updateApiToken(req.params.id, validatedData);
      if (!token) {
        return res.status(404).json({ message: "API token not found" });
      }
      
      // Mask the token value for security in the response
      const maskedToken = {
        ...token,
        token: token.token ? token.token.substring(0, 6) + "************" : null
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
  
  app.delete("/api/api-tokens/:id", requireRole(["admin"]), async (req, res) => {
    try {
      const success = await storage.deleteApiToken(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "API token not found" });
      }
      res.status(204).end();
    } catch (error) {
      console.error("Error deleting API token:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // API Token Customer Access routes
  app.get("/api/api-token-access/:tokenId", requireRole(["admin"]), async (req, res) => {
    try {
      const access = await storage.getApiTokenCustomerAccess(req.params.tokenId);
      res.json(access);
    } catch (error) {
      console.error("Error getting API token customer access:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post("/api/api-token-access", requireRole(["admin"]), async (req, res) => {
    try {
      const { tokenId, customerId } = req.body;
      
      if (!tokenId || !customerId) {
        return res.status(400).json({ message: "tokenId and customerId are required" });
      }
      
      const access = await storage.addApiTokenCustomerAccess({
        tokenId,
        customerId
      });
      
      res.status(201).json(access);
    } catch (error) {
      console.error("Error adding API token customer access:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.delete("/api/api-token-access", requireRole(["admin"]), async (req, res) => {
    try {
      const { tokenId, customerId } = req.query;
      
      if (!tokenId || !customerId) {
        return res.status(400).json({ message: "tokenId and customerId query parameters are required" });
      }
      
      const success = await storage.removeApiTokenCustomerAccess(tokenId as string, customerId as string);
      if (!success) {
        return res.status(404).json({ message: "API token customer access not found" });
      }
      
      res.status(204).end();
    } catch (error) {
      console.error("Error removing API token customer access:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Custom Roles routes
  app.get("/api/custom-roles", requireRole(["admin"]), async (req, res) => {
    try {
      const roles = await storage.getCustomRoles();
      res.json(roles);
    } catch (error) {
      console.error("Error getting custom roles:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get("/api/custom-roles/:id", requireRole(["admin"]), async (req, res) => {
    try {
      const role = await storage.getCustomRole(req.params.id);
      if (!role) {
        return res.status(404).json({ message: "Custom role not found" });
      }
      res.json(role);
    } catch (error) {
      console.error("Error getting custom role:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post("/api/custom-roles", requireRole(["admin"]), async (req, res) => {
    try {
      const validatedData = insertCustomRoleSchema.parse(req.body);
      const role = await storage.createCustomRole(validatedData);
      res.status(201).json(role);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        console.error("Error creating custom role:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });
  
  app.put("/api/custom-roles/:id", requireRole(["admin"]), async (req, res) => {
    try {
      const validatedData = insertCustomRoleSchema.partial().parse(req.body);
      const role = await storage.updateCustomRole(req.params.id, validatedData);
      if (!role) {
        return res.status(404).json({ message: "Custom role not found" });
      }
      res.json(role);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        console.error("Error updating custom role:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });
  
  app.delete("/api/custom-roles/:id", requireRole(["admin"]), async (req, res) => {
    try {
      const success = await storage.deleteCustomRole(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Custom role not found" });
      }
      res.status(204).end();
    } catch (error) {
      console.error("Error deleting custom role:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  return httpServer;
}