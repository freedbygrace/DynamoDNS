import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MainLayout } from "@/components/layouts/main-layout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/shared/pagination";
import { Loader2, RefreshCw, CheckCircle, XCircle, Info, Search, Code, Clock, Webhook, Calendar } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type WebhookDeliveryLog = {
  id: string;
  webhookId: string;
  webhookUrl: string;
  payload: any;
  status: boolean;
  statusCode: number | null;
  error: string | null;
  responseBody: string | null;
  retryCount: number;
  createdAt: string;
};

type Webhook = {
  id: string;
  name: string;
  url: string;
  organizationId: string;
  events: string[];
  active: boolean;
  secretKey?: string;
};

export default function WebhookLogsPage() {
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedLog, setSelectedLog] = useState<WebhookDeliveryLog | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "failed">("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  
  // Fetch all webhook logs across all webhooks
  const { data: allLogs = [], isLoading } = useQuery({
    queryKey: ["/api/webhook-logs"],
    select: (data: WebhookDeliveryLog[]) => {
      // Apply filters
      let filtered = data;
      
      // Status filter
      if (statusFilter === "success") {
        filtered = filtered.filter(log => log.status);
      } else if (statusFilter === "failed") {
        filtered = filtered.filter(log => !log.status);
      }
      
      // Search filter (search in webhook URL or response)
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(log => 
          log.webhookUrl.toLowerCase().includes(term) || 
          (log.responseBody && log.responseBody.toLowerCase().includes(term)) ||
          (log.error && log.error.toLowerCase().includes(term))
        );
      }
      
      // Apply sorting
      return [...filtered].sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
      });
    }
  });
  
  // Fetch webhooks (for name display)
  const { data: webhooks = [] } = useQuery<Webhook[]>({
    queryKey: ["/api/webhooks"],
  });
  
  // Retry mutation
  const retryMutation = useMutation({
    mutationFn: async (logId: string) => {
      const res = await apiRequest("POST", `/api/webhook-logs/${logId}/retry`);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Webhook retry initiated",
        description: "The webhook delivery retry has been initiated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/webhook-logs"] });
      setDetailsOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Retry failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const handleRetry = (log: WebhookDeliveryLog) => {
    retryMutation.mutate(log.id);
  };
  
  const viewDetails = (log: WebhookDeliveryLog) => {
    setSelectedLog(log);
    setDetailsOpen(true);
  };
  
  // Calculate pagination
  const totalPages = Math.ceil(allLogs.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedLogs = allLogs.slice(startIndex, startIndex + pageSize);
  
  // Get webhook name by ID
  const getWebhookName = (webhookId: string) => {
    const webhook = webhooks.find(w => w.id === webhookId);
    return webhook ? webhook.name : `Webhook ${webhookId}`;
  };
  
  return (
    <MainLayout
      title="Webhook Logs Dashboard"
      description="View and manage webhook delivery logs across all organizations."
    >
      {/* Filters and controls */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center space-x-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search webhook URLs or responses..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as "all" | "success" | "failed")}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="success">Successful</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={sortOrder}
            onValueChange={(value) => setSortOrder(value as "newest" | "oldest")}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/webhook-logs"] })}
            title="Refresh logs"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center space-x-2">
          <Select
            value={pageSize.toString()}
            onValueChange={(value) => {
              setPageSize(parseInt(value));
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-[110px]">
              <SelectValue placeholder="Page size" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 per page</SelectItem>
              <SelectItem value="25">25 per page</SelectItem>
              <SelectItem value="50">50 per page</SelectItem>
              <SelectItem value="100">100 per page</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Logs table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Webhook Delivery Logs</CardTitle>
          <CardDescription>
            Comprehensive view of all webhook delivery attempts across the system
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : allLogs.length === 0 ? (
            <div className="text-center py-8">
              <Webhook className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">No webhook logs found</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {searchTerm || statusFilter !== "all" 
                  ? "Try adjusting your search or filters" 
                  : "Webhook logs will appear here after webhooks are triggered"}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Webhook</TableHead>
                      <TableHead>URL</TableHead>
                      <TableHead>Response</TableHead>
                      <TableHead>Retries</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedLogs.map((log) => (
                      <TableRow key={log.id} className="cursor-pointer hover:bg-muted/50" onClick={() => viewDetails(log)}>
                        <TableCell>
                          {log.status ? (
                            <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                              <CheckCircle className="w-3.5 h-3.5 mr-1" />
                              Success
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                              <XCircle className="w-3.5 h-3.5 mr-1" />
                              Failed
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {getWebhookName(log.webhookId)}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {log.webhookUrl}
                        </TableCell>
                        <TableCell>
                          {log.status ? (
                            <span className="text-sm text-muted-foreground">
                              {log.statusCode || 200} OK
                            </span>
                          ) : (
                            <span className="text-sm text-destructive">
                              {log.error || `Error ${log.statusCode || 'unknown'}`}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {log.retryCount > 0 ? (
                            <Badge variant="outline" className="text-muted-foreground">
                              <RefreshCw className="w-3 h-3 mr-1" /> {log.retryCount}
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">None</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Calendar className="w-3.5 h-3.5 mr-1.5" />
                            <span title={format(new Date(log.createdAt), 'PPpp')}>
                              {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              viewDetails(log);
                            }}
                          >
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {/* Pagination */}
              {allLogs.length > pageSize && (
                <div className="mt-4 p-4 border-t">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    itemLabel="logs"
                    totalItems={allLogs.length}
                    itemsPerPage={pageSize}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      {selectedLog && (
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedLog.status ? (
                  <div className="flex items-center">
                    <CheckCircle className="w-5 h-5 mr-2 text-success" />
                    Successful Webhook Delivery
                  </div>
                ) : (
                  <div className="flex items-center">
                    <XCircle className="w-5 h-5 mr-2 text-destructive" />
                    Failed Webhook Delivery
                  </div>
                )}
              </DialogTitle>
              <DialogDescription>
                Detailed information about this webhook delivery attempt
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium mb-1">Webhook</h3>
                  <p className="text-sm">{getWebhookName(selectedLog.webhookId)}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium mb-1">Time</h3>
                  <p className="text-sm">{format(new Date(selectedLog.createdAt), 'PPpp')}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium mb-1">Status</h3>
                  <p className="text-sm">
                    {selectedLog.status
                      ? `Success (${selectedLog.statusCode || 200})`
                      : `Failed${selectedLog.statusCode ? ` (${selectedLog.statusCode})` : ''}`}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium mb-1">Retry Count</h3>
                  <p className="text-sm">{selectedLog.retryCount}</p>
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium mb-1">Webhook URL</h3>
                <div className="text-sm bg-muted p-3 rounded-md">
                  {selectedLog.webhookUrl}
                </div>
              </div>
              
              {!selectedLog.status && selectedLog.error && (
                <div>
                  <h3 className="text-sm font-medium mb-1 text-destructive">Error</h3>
                  <div className="text-sm bg-destructive/10 text-destructive p-3 rounded-md">
                    {selectedLog.error}
                  </div>
                </div>
              )}
              
              <div>
                <h3 className="text-sm font-medium mb-1">Payload</h3>
                <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-40">
                  {JSON.stringify(selectedLog.payload, null, 2)}
                </pre>
              </div>
              
              {selectedLog.responseBody && (
                <div>
                  <h3 className="text-sm font-medium mb-1">Response Body</h3>
                  <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-40">
                    {typeof selectedLog.responseBody === 'string' 
                      ? (() => {
                          try {
                            return JSON.stringify(JSON.parse(selectedLog.responseBody), null, 2);
                          } catch {
                            return selectedLog.responseBody;
                          }
                        })() 
                      : JSON.stringify(selectedLog.responseBody, null, 2)}
                  </pre>
                </div>
              )}
            </div>
            
            <DialogFooter>
              {!selectedLog.status && (
                <Button 
                  onClick={() => handleRetry(selectedLog)}
                  disabled={retryMutation.isPending}
                  className="mr-auto"
                >
                  {retryMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Retrying...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Retry Webhook
                    </>
                  )}
                </Button>
              )}
              <Button variant="outline" onClick={() => setDetailsOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </MainLayout>
  );
}