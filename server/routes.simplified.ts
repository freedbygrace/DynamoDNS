import type { Express } from "express";
import { createServer, type Server } from "http";
import { getCurrentIpAddress, getCurrentIpv6Address } from "./utils/ip-utils";

export async function registerRoutes(app: Express): Promise<Server> {
  // Create HTTP server
  const httpServer = createServer(app);

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
  
  return httpServer;
}