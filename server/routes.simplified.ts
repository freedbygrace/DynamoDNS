import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { getCurrentIpAddress, getCurrentIpv6Address } from "./utils/ip-utils";
import { setupAuth, requireRole } from "./auth";
import { z } from "zod";
import { insertCustomerSchema, insertDomainSchema, insertDnsRecordSchema } from "@shared/schema";

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
  
  return httpServer;
}