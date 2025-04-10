import { useQuery } from "@tanstack/react-query";
import { Domain, DnsRecord, Provider, Organization } from "@shared/schema";
import { MainLayout } from "@/components/layouts/main-layout";
import { DomainStatusCard } from "@/components/domain/domain-status-card";
import { DomainTable } from "@/components/domain/domain-table";
import { RecentActivity } from "@/components/activity/recent-activity";
import { DnsUpdateChart } from "@/components/charts/dns-update-chart";
import { ProviderDistributionChart } from "@/components/charts/provider-distribution-chart";
import { RecordTypeChart } from "@/components/charts/record-type-chart";
import { OrganizationListCard } from "@/components/organization/organization-list-card";
import { Button } from "@/components/ui/button";
import { useOrganization } from "@/context/organization-context";
import { Home, CheckCircle, AlertTriangle, AlertCircle, Plus, Wrench, FileText } from "lucide-react";
import { Link } from "wouter";

export default function DashboardPage() {
  const { currentOrganization, organizations } = useOrganization();

  // Fetch domains, DNS records, and providers
  const { data: domains = [] } = useQuery<Domain[]>({
    queryKey: ["/api/domains", currentOrganization?.id],
    enabled: !!currentOrganization?.id,
  });

  const { data: allRecords = [] } = useQuery<DnsRecord[]>({
    queryKey: ["/api/dns-records/all"],
    enabled: false, // We'll fetch records for individual domains as needed
  });

  const { data: providers = [] } = useQuery<Provider[]>({
    queryKey: ["/api/providers"],
  });

  // Calculate statistics
  const activeDomains = domains.filter(d => d.isActive).length;
  const pendingUpdates = domains.filter(d => 
    d.isActive && d.lastUpdated && 
    new Date(d.lastUpdated).getTime() < Date.now() - 86400000
  ).length;
  
  // This would normally be calculated from actual error logs
  const errors = 0;
  
  // This would be calculated from actual DNS record updates
  const updatedRecords = 256;

  return (
    <MainLayout
      title="Dashboard"
      description="Overview of your dynamic DNS configuration and performance."
    >
      {/* Status Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <DomainStatusCard 
          title="Active Domains" 
          value={activeDomains} 
          icon={<Home className="h-6 w-6" />}
          iconClassName="bg-primary/10 text-primary" 
        />
        <DomainStatusCard 
          title="Updated Records" 
          value={updatedRecords} 
          icon={<CheckCircle className="h-6 w-6" />}
          iconClassName="bg-success/10 text-success" 
        />
        <DomainStatusCard 
          title="Pending Updates" 
          value={pendingUpdates} 
          icon={<AlertTriangle className="h-6 w-6" />}
          iconClassName="bg-warning/10 text-warning" 
        />
        <DomainStatusCard 
          title="Errors (Last 24h)" 
          value={errors} 
          icon={<AlertCircle className="h-6 w-6" />}
          iconClassName="bg-destructive/10 text-destructive" 
        />
      </div>

      {/* Recent Activity and DNS Update Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <DnsUpdateChart />
        </div>
        <div className="lg:col-span-1">
          <RecentActivity />
        </div>
      </div>

      {/* Organizations List */}
      <div className="mb-8">
        <OrganizationListCard organizations={organizations} />
      </div>

      {/* Domain Status Table */}
      <DomainTable />

      {/* Provider Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <ProviderDistributionChart />
        <RecordTypeChart />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Link href="/domains">
          <Button variant="outline" className="bg-card hover:bg-accent transition-colors duration-200 rounded-lg shadow-sm p-5 border border-border flex items-center justify-start w-full h-auto">
            <div className="p-2 rounded-full bg-primary/10 mr-4">
              <Plus className="h-5 w-5 text-primary" />
            </div>
            <div className="text-left">
              <p className="font-medium">Add New Domain</p>
              <p className="text-sm text-muted-foreground">Connect to DNS provider</p>
            </div>
          </Button>
        </Link>
        
        <Link href="/api-tokens">
          <Button variant="outline" className="bg-card hover:bg-accent transition-colors duration-200 rounded-lg shadow-sm p-5 border border-border flex items-center justify-start w-full h-auto">
            <div className="p-2 rounded-full bg-warning/10 mr-4">
              <Wrench className="h-5 w-5 text-warning" />
            </div>
            <div className="text-left">
              <p className="font-medium">Manage API Tokens</p>
              <p className="text-sm text-muted-foreground">Update access credentials</p>
            </div>
          </Button>
        </Link>
        
        <Link href="/history">
          <Button variant="outline" className="bg-card hover:bg-accent transition-colors duration-200 rounded-lg shadow-sm p-5 border border-border flex items-center justify-start w-full h-auto">
            <div className="p-2 rounded-full bg-success/10 mr-4">
              <FileText className="h-5 w-5 text-success" />
            </div>
            <div className="text-left">
              <p className="font-medium">View DNS History</p>
              <p className="text-sm text-muted-foreground">Export configuration</p>
            </div>
          </Button>
        </Link>
      </div>
    </MainLayout>
  );
}
