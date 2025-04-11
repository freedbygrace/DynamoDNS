import fetch from 'node-fetch';

/**
 * Gets the current public IP address of the server
 * Uses multiple services for redundancy
 */
export async function getCurrentIpAddress(): Promise<string | null> {
  const ipServices = [
    'https://api.ipify.org',
    'https://ifconfig.me/ip',
    'https://icanhazip.com',
    'https://ipecho.net/plain'
  ];

  // Try each service in sequence until we get a valid response
  for (const service of ipServices) {
    try {
      console.log(`Attempting to get IP address from ${service}`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(service, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const ip = (await response.text()).trim();
        console.log(`Got IP address: ${ip} from ${service}`);
        
        // Basic validation - IP should be a string with numbers and dots
        if (ip && /^[0-9.]+$/.test(ip)) {
          return ip;
        }
      }
    } catch (error) {
      console.error(`Error getting IP from ${service}:`, error);
      // Continue to the next service
    }
  }

  console.error('Failed to get IP address from any service');
  return null;
}

/**
 * Gets the current IPv6 address (if available)
 */
export async function getCurrentIpv6Address(): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch('https://ipv6.icanhazip.com', { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const ip = (await response.text()).trim();
      console.log(`Got IPv6 address: ${ip}`);
      
      // Basic validation for IPv6 format
      if (ip && ip.includes(':')) {
        return ip;
      }
    }
  } catch (error) {
    console.error('Error getting IPv6 address:', error);
  }
  
  return null;
}