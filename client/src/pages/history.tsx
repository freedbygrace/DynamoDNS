import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layouts/main-layout";
import { DnsHistory, Domain } from "@shared/schema";
import { useOrganization } from "@/context/organization-context";
import { formatDistanceToNow, format } from "date-fns";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pagination } from "@/components/shared/pagination";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Pencil, Trash, AlertCircle } from "lucide-react";

export default function HistoryPage() {
  const { currentOrganization } = useOrganization();
  const [selectedDomain, setSelectedDomain] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  
  // Fetch domains for filter
  const { data: domains = [] } = useQuery<Domain[]>({
    queryKey: ["/api/domains", currentOrganization?.id],
    enabled: !!currentOrganization?.id,
  });

  // Fetch DNS history
  const { data: historyEntries = [], isLoading } = useQuery<DnsHistory[]>({
    queryKey: ["/api/dns-history", selectedDomain !== "all" ? parseInt(selectedDomain) : undefined],
    enabled: selectedDomain !== "all", 
  });

  // Reset page when domain changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedDomain]);

  const getActionIcon = (action: string) => {
    switch (action) {
      case "create":
        return <Plus className="h-4 w-4 text-success" />;
      case "update":
        return <Pencil className="h-4 w-4 text-primary" />;
      case "delete":
        return <Trash className="h-4 w-4 text-destructive" />;
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case "create":
        return (
          <Badge variant="outline" className="bg-success/10 text-success border-success/20">
            Created
          </Badge>
        );
      case "update":
        return (
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
            Updated
          </Badge>
        );
      case "delete":
        return (
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
            Deleted
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            Unknown
          </Badge>
        );
    }
  };

  const getHistoryDetails = (entry: DnsHistory) => {
    if (!entry.previousValue && !entry.newValue) return { name: "Unknown", type: "Unknown", details: "No details available" };
    
    try {
      if (entry.action === "create" && entry.newValue) {
        const data = JSON.parse(entry.newValue);
        return {
          name: data.name,
          type: data.type,
          details: `New value: ${data.content}`
        };
      } else if (entry.action === "update" && entry.previousValue && entry.newValue) {
        const oldData = JSON.parse(entry.previousValue);
        const newData = JSON.parse(entry.newValue);
        return {
          name: newData.name,
          type: newData.type,
          details: `From: ${oldData.content} → To: ${newData.content}`
        };
      } else if (entry.action === "delete" && entry.previousValue) {
        const data = JSON.parse(entry.previousValue);
        return {
          name: data.name,
          type: data.type,
          details: `Deleted value: ${data.content}`
        };
      }
    } catch (e) {
      console.error("Error parsing history data:", e);
    }

    return { name: "Unknown", type: "Unknown", details: "Error parsing details" };
  };

  // Calculate pagination
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedHistory = historyEntries.slice(startIndex, endIndex);
  const totalPages = Math.ceil(historyEntries.length / pageSize);

  return (
    <MainLayout
      title="DNS History"
      description="View and analyze historical changes to your DNS records."
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

      {/* History Table */}
      <Card>
        <CardHeader>
          <CardTitle>Change History</CardTitle>
          <CardDescription>
            A chronological log of all DNS record changes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {selectedDomain === "all" ? (
            <div className="text-center py-8">
              <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">Select a Domain</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Please select a specific domain to view its history.
              </p>
            </div>
          ) : isLoading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : historyEntries.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">No history available</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                There are no recorded changes for this domain yet.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Action</TableHead>
                      <TableHead>Record</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Timestamp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedHistory.map((entry) => {
                      const details = getHistoryDetails(entry);
                      return (
                        <TableRow key={entry.id}>
                          <TableCell>
                            <div className="flex items-center">
                              {getActionIcon(entry.action)}
                              <span className="ml-2">{getActionBadge(entry.action)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">{details.name}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{details.type}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs max-w-xs truncate">
                            {details.details}
                          </TableCell>
                          <TableCell>
                            {entry.userId ? `User ID: ${entry.userId}` : "System"}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-sm" title={format(new Date(entry.timestamp), 'PPpp')}>
                                {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(entry.timestamp), 'MMM d, yyyy HH:mm')}
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {historyEntries.length > pageSize && (
                <div className="mt-4">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    itemLabel="changes"
                    totalItems={historyEntries.length}
                    itemsPerPage={pageSize}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </MainLayout>
  );
}
