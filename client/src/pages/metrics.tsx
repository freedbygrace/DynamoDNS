import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layouts/main-layout";
import { DnsUpdateChart } from "@/components/charts/dns-update-chart";
import { ProviderDistributionChart } from "@/components/charts/provider-distribution-chart";
import { RecordTypeChart } from "@/components/charts/record-type-chart";
import { Domain, DnsMetric } from "@shared/schema";
import { useOrganization } from "@/context/organization-context";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BarChart, LineChart, PieChart, Home, BarChart2, Activity, Clock } from "lucide-react";

export default function MetricsPage() {
  const { currentOrganization } = useOrganization();
  const [selectedTimeframe, setSelectedTimeframe] = useState("day");
  const [selectedDomain, setSelectedDomain] = useState<string>("all");
  
  // Fetch domains for filter
  const { data: domains = [] } = useQuery<Domain[]>({
    queryKey: ["/api/domains", currentOrganization?.id],
    enabled: !!currentOrganization?.id,
  });

  // Calculate date range for metrics queries
  const getDateRange = () => {
    const endDate = new Date();
    let startDate = new Date();
    
    if (selectedTimeframe === "day") {
      startDate.setDate(startDate.getDate() - 1);
    } else if (selectedTimeframe === "week") {
      startDate.setDate(startDate.getDate() - 7);
    } else if (selectedTimeframe === "month") {
      startDate.setMonth(startDate.getMonth() - 1);
    }
    
    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    };
  };
  
  const { startDate, endDate } = getDateRange();
  
  // Fetch DNS metrics for the performance cards
  const { data: performanceMetrics = [] } = useQuery<DnsMetric[]>({
    queryKey: ["/api/dns-metrics", "performance", startDate, endDate],
    queryFn: async () => {
      const url = new URL("/api/dns-metrics", window.location.origin);
      url.searchParams.append("type", "performance");
      url.searchParams.append("startDate", startDate);
      url.searchParams.append("endDate", endDate);
      
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error("Failed to fetch performance metrics");
      }
      
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  
  return (
    <MainLayout
      title="Metrics & Statistics"
      description="View performance metrics for your DNS configuration."
    >
      {/* Filter controls */}
      <div className="flex flex-col sm:flex-row justify-between mb-6 gap-4">
        <div className="flex items-center space-x-4">
          <Select
            value={selectedDomain}
            onValueChange={setSelectedDomain}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select domain" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Domains</SelectItem>
              {domains.map(domain => (
                <SelectItem key={domain.id} value={domain.id.toString()}>
                  {domain.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Update Activity Chart */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
            <div>
              <CardTitle>DNS Update Activity</CardTitle>
              <CardDescription>
                Frequency of DNS record updates over time
              </CardDescription>
            </div>
            <Tabs defaultValue="day" className="mt-2 sm:mt-0">
              <TabsList>
                <TabsTrigger 
                  value="day" 
                  onClick={() => setSelectedTimeframe("day")}
                >
                  Day
                </TabsTrigger>
                <TabsTrigger 
                  value="week" 
                  onClick={() => setSelectedTimeframe("week")}
                >
                  Week
                </TabsTrigger>
                <TabsTrigger 
                  value="month" 
                  onClick={() => setSelectedTimeframe("month")}
                >
                  Month
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <DnsUpdateChart timeframe={selectedTimeframe} domainId={selectedDomain !== "all" ? selectedDomain : undefined} />
          </div>
        </CardContent>
      </Card>

      {/* Distribution Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>DNS Provider Distribution</CardTitle>
            <CardDescription>
              Breakdown of domains by DNS provider
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ProviderDistributionChart />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Record Type Distribution</CardTitle>
            <CardDescription>
              Breakdown of DNS records by type
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <RecordTypeChart />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Metrics */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>DNS Performance Metrics</CardTitle>
          <CardDescription>
            Key metrics for your DNS configuration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-muted/30 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <Activity className="mr-2 h-5 w-5 text-primary" />
                <h3 className="text-sm font-medium">Avg. Response Time</h3>
              </div>
              <p className="text-2xl font-bold">38 ms</p>
              <p className="text-xs text-muted-foreground mt-1">5% faster than last week</p>
            </div>
            
            <div className="bg-muted/30 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <Clock className="mr-2 h-5 w-5 text-primary" />
                <h3 className="text-sm font-medium">Uptime</h3>
              </div>
              <p className="text-2xl font-bold">99.98%</p>
              <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
            </div>
            
            <div className="bg-muted/30 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <BarChart className="mr-2 h-5 w-5 text-primary" />
                <h3 className="text-sm font-medium">Update Frequency</h3>
              </div>
              <p className="text-2xl font-bold">4.2/day</p>
              <p className="text-xs text-muted-foreground mt-1">Avg. updates per day</p>
            </div>
            
            <div className="bg-muted/30 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <BarChart2 className="mr-2 h-5 w-5 text-primary" />
                <h3 className="text-sm font-medium">Propagation Time</h3>
              </div>
              <p className="text-2xl font-bold">43 sec</p>
              <p className="text-xs text-muted-foreground mt-1">Avg. global propagation</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* DNS Records Health */}
      <Card>
        <CardHeader>
          <CardTitle>DNS Records Health</CardTitle>
          <CardDescription>
            Health status of your DNS records
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-4 border-b">
              <div className="flex items-center">
                <Home className="mr-3 h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">example.com</p>
                  <p className="text-sm text-muted-foreground">A, CNAME, MX records</p>
                </div>
              </div>
              <div className="flex items-center">
                <span className="inline-block w-2 h-2 bg-success rounded-full mr-2"></span>
                <span className="text-sm font-medium">Healthy</span>
              </div>
            </div>
            
            <div className="flex items-center justify-between pb-4 border-b">
              <div className="flex items-center">
                <Home className="mr-3 h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">api.example.org</p>
                  <p className="text-sm text-muted-foreground">A, CNAME records</p>
                </div>
              </div>
              <div className="flex items-center">
                <span className="inline-block w-2 h-2 bg-warning rounded-full mr-2"></span>
                <span className="text-sm font-medium">Outdated</span>
              </div>
            </div>
            
            <div className="flex items-center justify-between pb-4 border-b">
              <div className="flex items-center">
                <Home className="mr-3 h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">cdn.testsite.com</p>
                  <p className="text-sm text-muted-foreground">A, AAAA records</p>
                </div>
              </div>
              <div className="flex items-center">
                <span className="inline-block w-2 h-2 bg-destructive rounded-full mr-2"></span>
                <span className="text-sm font-medium">Error</span>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Home className="mr-3 h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">prod-db.example.net</p>
                  <p className="text-sm text-muted-foreground">A record</p>
                </div>
              </div>
              <div className="flex items-center">
                <span className="inline-block w-2 h-2 bg-success rounded-full mr-2"></span>
                <span className="text-sm font-medium">Healthy</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </MainLayout>
  );
}
