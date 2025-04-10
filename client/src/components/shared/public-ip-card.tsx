import { useState, useEffect } from 'react';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Network, Info, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

export function PublicIpCard() {
  const [ipv4, setIpv4] = useState<string | null>(null);
  const [ipv6, setIpv6] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchPublicIp = async () => {
      try {
        setLoading(true);

        // Fetch IPv4
        const ipv4Response = await fetch('https://api.ipify.org?format=json')
          .then(res => res.json())
          .catch(() => ({ ip: null }));

        // Fetch IPv6 (might not be available for all users)
        const ipv6Response = await fetch('https://api64.ipify.org?format=json')
          .then(res => res.json())
          .catch(() => ({ ip: null }));

        setIpv4(ipv4Response.ip);
        setIpv6(ipv6Response.ip);
        setError(false);
      } catch (err) {
        console.error('Error fetching public IP:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchPublicIp();

    // Refresh every 5 minutes
    const interval = setInterval(fetchPublicIp, 300000);
    return () => clearInterval(interval);
  }, []);

  const copyToClipboard = (text: string | null) => {
    if (text) {
      navigator.clipboard.writeText(text);
      toast({
        title: 'Copied to clipboard',
        description: text,
      });
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center mb-4">
          <Network className="h-5 w-5 text-primary mr-2" />
          <CardTitle className="text-lg font-semibold">Public IP Addresses</CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 ml-1">
                  <Info className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Your current public IP addresses as seen from the internet.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-muted-foreground">IPv4 Address</span>
              {ipv4 && (
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => copyToClipboard(ipv4)}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <div className="bg-card border rounded-md p-3 text-sm font-mono">
              {loading ? 'Loading...' : error ? 'Error fetching IP' : ipv4 || 'N/A'}
            </div>
          </div>

          <Separator />

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-muted-foreground">IPv6 Address</span>
              {ipv6 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => copyToClipboard(ipv6)}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <div className="bg-card border rounded-md p-3 text-sm font-mono overflow-x-auto">
              {loading ? 'Loading...' : error ? 'Error fetching IP' : ipv6 || 'N/A'}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}