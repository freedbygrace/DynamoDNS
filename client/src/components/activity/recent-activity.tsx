import { useQuery } from "@tanstack/react-query";
import { DnsHistory } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardTitle } from "@/components/ui/card";

interface RecentActivityProps {
  domainId?: string;
}

export function RecentActivity({ domainId }: RecentActivityProps) {
  // Fetch history data for the specified domain or all domains if not specified
  const queryKey = domainId 
    ? ["/api/dns-history/domain", domainId] 
    : ["/api/dns-history"];
  
  const { data: historyEntries = [], isLoading } = useQuery<DnsHistory[]>({
    queryKey,
    enabled: domainId !== undefined,
  });
  
  // Limit to last 5 entries
  const recentEntries = historyEntries.slice(0, 5);
  
  const getActivityIcon = (action: string) => {
    switch (action) {
      case "create":
        return "border-success";
      case "update":
        return "border-primary";
      case "delete":
        return "border-destructive";
      default:
        return "border-muted-foreground";
    }
  };
  
  const getActivityTitle = (entry: DnsHistory) => {
    if (!entry.previousValue || !entry.newValue) return "Unknown action";
    
    try {
      const prev = JSON.parse(entry.previousValue);
      const curr = JSON.parse(entry.newValue);
      
      switch (entry.action) {
        case "create":
          return `${curr.name} ${curr.type} record created`;
        case "update":
          return `${curr.name} ${curr.type} record updated`;
        case "delete":
          return `${prev.name} ${prev.type} record deleted`;
        default:
          return "Unknown action";
      }
    } catch (e) {
      return "Error parsing history";
    }
  };
  
  const getActivityDetails = (entry: DnsHistory) => {
    if (!entry.newValue) return "";
    
    try {
      const data = JSON.parse(entry.newValue);
      switch (entry.action) {
        case "create":
        case "update":
          return `Value: ${data.content}`;
        default:
          return "";
      }
    } catch (e) {
      return "";
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <CardTitle className="text-lg font-semibold mb-4">Recent Activity</CardTitle>
        {recentEntries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No recent activity found
          </div>
        ) : (
          <div className="space-y-4">
            {recentEntries.map((entry) => (
              <div 
                key={entry.id}
                className={`border-l-2 ${getActivityIcon(entry.action)} pl-4 pb-5 relative`}
              >
                <div className={`w-2 h-2 rounded-full ${entry.action === 'create' ? 'bg-success' : entry.action === 'update' ? 'bg-primary' : 'bg-destructive'} absolute -left-[5px] top-1.5`}></div>
                <p className="text-sm font-medium">{getActivityTitle(entry)}</p>
                <p className="text-xs text-muted-foreground">{getActivityDetails(entry)}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
