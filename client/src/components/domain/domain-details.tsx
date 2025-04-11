import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DnsRecord, InsertDnsRecord, Domain, Provider, recordTypes } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";
import { RecentActivity } from "@/components/activity/recent-activity";
import { Pagination } from "@/components/shared/pagination";
import { Loader2, FileText, Pencil, Trash2, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// DNS Record form schema
const dnsRecordSchema = z.object({
  name: z.string().min(1, "Record name is required"),
  type: z.enum(recordTypes),
  content: z.string().optional().or(z.literal('')),
  ttl: z.number().int().min(1).default(3600),
  proxied: z.boolean().default(false),
  isActive: z.boolean().default(true),
  isAutoIP: z.boolean().default(false),
  notes: z.string().optional(),
}).refine(data => {
  // Different validation based on record type
  if ((data.type === 'A' || data.type === 'AAAA') && data.isAutoIP) {
    // Auto IP enabled, content not required
    return true;
  } else if (data.type === 'A') {
    // A record - validate IPv4
    return !!data.content && /^(\d{1,3}\.){3}\d{1,3}$/.test(data.content.trim());
  } else if (data.type === 'AAAA') {
    // AAAA record - accept any non-empty content for IPv6 (simplified validation)
    return !!data.content && data.content.trim().length > 0;
  } else if (data.type === 'CNAME' || data.type === 'MX' || data.type === 'NS') {
    // Domain-based records - ensure content is present and looks like domain
    return !!data.content && data.content.trim().length > 0;
  } else {
    // For all other types, just ensure content is non-empty
    return !!data.content && data.content.trim().length > 0;
  }
}, {
  message: "Content is required and must be valid for the selected record type",
  path: ["content"]
});

interface DomainDetailsProps {
  domain: Domain;
  onBack?: () => void;
}

export function DomainDetails({ domain, onBack }: DomainDetailsProps) {
  const { toast } = useToast();
  
  const [isAddRecordDialogOpen, setIsAddRecordDialogOpen] = useState(false);
  const [isEditRecordDialogOpen, setIsEditRecordDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<DnsRecord | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;
  
  // Fetch providers for the form
  const { data: providers = [] } = useQuery<Provider[]>({
    queryKey: ["/api/providers"],
  });

  // Fetch DNS Records
  const { 
    data: records = [], 
    isLoading 
  } = useQuery<DnsRecord[]>({
    queryKey: ["/api/dns-records", domain.id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/dns-records?domainId=${domain.id}`);
      return await res.json();
    },
    enabled: !!domain?.id,
  });

  // Form for adding/editing a record
  const form = useForm<z.infer<typeof dnsRecordSchema>>({
    resolver: zodResolver(dnsRecordSchema),
    defaultValues: {
      name: "",
      type: "A",
      content: "",
      ttl: 3600,
      proxied: false,
      isActive: true,
      isAutoIP: false,
      notes: "",
    },
  });

  // Add record mutation
  const addRecordMutation = useMutation({
    mutationFn: async (data: z.infer<typeof dnsRecordSchema>) => {
      // Prepare record data
      const recordData: InsertDnsRecord = {
        ...data,
        domainId: domain.id,
        // Inherit providerId from domain
        providerId: domain.providerId
      };
      
      console.log("Adding record:", recordData);
      
      // Check if there are duplicate records before adding
      const potentialDuplicate = records.find(r => 
        r.name === recordData.name && 
        r.type === recordData.type
      );
      
      if (potentialDuplicate) {
        throw new Error(`A record with name "${recordData.name}" and type "${recordData.type}" already exists. Please use a different name or type.`);
      }
      
      const res = await apiRequest("POST", "/api/dns-records", recordData);
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to add record");
      }
      
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dns-records", domain.id] });
      setIsAddRecordDialogOpen(false);
      form.reset();
      toast({
        title: "Record added",
        description: "The DNS record has been successfully added.",
      });
    },
    onError: (error) => {
      console.error("Add record error:", error);
      toast({
        title: "Failed to add record",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    },
  });

  // Update record mutation
  const updateRecordMutation = useMutation({
    mutationFn: async (data: z.infer<typeof dnsRecordSchema> & { id: string }) => {
      const { id, ...updateData } = data;
      
      // Always use domain's provider for the record
      const updatedData = {
        ...updateData,
        domainId: domain.id, // Make sure domainId is included
        providerId: domain.providerId // Always use domain's provider
      };
      
      console.log("Updating record:", id, "with data:", updatedData);
      
      // Check if there are duplicate records before updating
      // We do this by matching against name and type but excluding the current record
      const potentialDuplicate = records.find(r => 
        r.name === updatedData.name && 
        r.type === updatedData.type && 
        r.id !== id
      );
      
      if (potentialDuplicate) {
        throw new Error(`A record with name "${updatedData.name}" and type "${updatedData.type}" already exists. Please use a different name or type.`);
      }
      
      const res = await apiRequest("PUT", `/api/dns-records/${id}`, updatedData);
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to update record");
      }
      
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dns-records", domain.id] });
      setIsEditRecordDialogOpen(false);
      setSelectedRecord(null);
      toast({
        title: "Record updated",
        description: "The DNS record has been successfully updated.",
      });
    },
    onError: (error) => {
      console.error("Update record error:", error);
      toast({
        title: "Failed to update record",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    },
  });

  // Delete record mutation
  const deleteRecordMutation = useMutation({
    mutationFn: async (recordId: string) => {
      await apiRequest("DELETE", `/api/dns-records/${recordId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dns-records", domain.id] });
      setIsDeleteDialogOpen(false);
      setSelectedRecord(null);
      toast({
        title: "Record deleted",
        description: "The DNS record has been successfully deleted.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete record",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Form submission handlers
  const onAddSubmit = (data: z.infer<typeof dnsRecordSchema>) => {
    addRecordMutation.mutate(data);
  };

  const onEditSubmit = (data: z.infer<typeof dnsRecordSchema>) => {
    if (selectedRecord) {
      updateRecordMutation.mutate({ ...data, id: selectedRecord.id });
    }
  };

  // Handle record editing
  const handleEditRecord = (record: DnsRecord) => {
    setSelectedRecord(record);
    
    // Set form values for editing
    form.reset({
      name: record.name,
      type: record.type as any, // Type cast to handle compatibility
      content: record.content,
      ttl: record.ttl as number, // Type cast to handle nullable
      proxied: record.proxied as boolean, // Type cast to handle nullable
      isActive: record.isActive,
      isAutoIP: record.isAutoIP,
      notes: record.notes || "",
    });
    
    setIsEditRecordDialogOpen(true);
  };

  // Handle record deletion
  const handleDeleteRecord = (record: DnsRecord) => {
    setSelectedRecord(record);
    setIsDeleteDialogOpen(true);
  };

  // Confirm deletion
  const confirmDeleteRecord = () => {
    if (selectedRecord) {
      deleteRecordMutation.mutate(selectedRecord.id);
    }
  };
  
  // Toggle active status mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      console.log("Toggling record active status:", id, "to", isActive);
      const res = await apiRequest("PATCH", `/api/dns-records/${id}`, {
        isActive
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to update record status");
      }
      
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dns-records", domain.id] });
      toast({
        title: "Record status updated",
        description: "The DNS record status has been successfully updated.",
      });
    },
    onError: (error) => {
      console.error("Toggle active status error:", error);
      toast({
        title: "Failed to update record status",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    },
  });
  
  // Handle toggle active
  const handleToggleActive = (record: DnsRecord, checked: boolean) => {
    toggleActiveMutation.mutate({ id: record.id, isActive: checked });
  };

  // Get a human-readable provider name from the provider ID
  const getProviderName = (providerId: string | null) => {
    if (!providerId) return "None";
    const provider = providers.find(p => p.id === providerId);
    return provider ? provider.name : "Unknown Provider";
  };

  // Calculate pagination
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedRecords = records.slice(startIndex, endIndex);
  const totalPages = Math.ceil(records.length / pageSize);

  // Handle adding a new record
  const handleAddRecord = () => {
    // Reset form with defaults
    form.reset({
      name: "",
      type: "A",
      content: "",
      ttl: 3600,
      proxied: false,
      isActive: true,
      isAutoIP: false,
      notes: "",
    });
    setIsAddRecordDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          {onBack && (
            <Button variant="outline" onClick={onBack} className="h-9">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-4 w-4"><path d="m15 18-6-6 6-6"/></svg>
              Back
            </Button>
          )}
          <h2 className="text-xl font-semibold">DNS Records for {domain.name}</h2>
        </div>
        <Button onClick={handleAddRecord}>
          <Plus className="mr-2 h-4 w-4" />
          Add Record
        </Button>
      </div>

      {records.length === 0 ? (
        <div className="text-center py-8 border rounded-lg">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <h3 className="mt-4 text-lg font-medium">No DNS records found</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Get started by adding your first DNS record.
          </p>
          <div className="mt-6">
            <Button onClick={handleAddRecord}>Add DNS Record</Button>
          </div>
        </div>
      ) : (
        <div className="bg-card rounded-lg border shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Content</TableHead>
                  <TableHead>TTL</TableHead>
                  <TableHead>Last Update</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedRecords.map(record => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">
                      {record.name === "@" ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>{record.name}</span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Root domain: {domain.name}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        record.name
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{record.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="truncate max-w-[150px] inline-block">
                              {record.isAutoIP ? "Auto IP" : record.content}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{record.isAutoIP ? "Auto IP" : record.content}</p>
                            {record.notes && (
                              <>
                                <div className="border-t my-1"></div>
                                <p className="italic text-xs">{record.notes}</p>
                              </>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell>{record.ttl}s</TableCell>
                    <TableCell>
                      {record.lastUpdated 
                        ? formatDistanceToNow(new Date(record.lastUpdated), { addSuffix: true }) 
                        : "Never"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={record.isActive}
                          onCheckedChange={(checked) => handleToggleActive(record, checked)}
                          className="data-[state=checked]:bg-green-500"
                          size="lg"
                        />
                        <span className={record.isActive ? "text-green-700 font-medium" : "text-muted-foreground"}>
                          {record.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleEditRecord(record)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteRecord(record)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {records.length > pageSize && (
            <div className="p-4 border-t">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                itemLabel="records"
                totalItems={records.length}
                itemsPerPage={pageSize}
              />
            </div>
          )}
        </div>
      )}

      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <RecentActivity domainId={domain.id} />
          </CardContent>
        </Card>
      </div>

      {/* Add Record Dialog */}
      <Dialog open={isAddRecordDialogOpen} onOpenChange={setIsAddRecordDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add DNS Record</DialogTitle>
            <DialogDescription>
              Add a new DNS record to {domain.name}.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onAddSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="@, www, subdomain, etc" {...field} />
                    </FormControl>
                    <FormDescription>
                      Use @ for root domain or enter subdomain name
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Record Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select record type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {recordTypes.map((type) => (
                          <SelectItem 
                            key={type} 
                            value={type}
                          >
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Moved proxied toggle above isAutoIP */}
              <FormField
                control={form.control}
                name="proxied"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Proxied</FormLabel>
                      <FormDescription>
                        Enable proxying through CDN (Cloudflare only)
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              {(form.watch("type") === "A" || form.watch("type") === "AAAA") && (
                <FormField
                  control={form.control}
                  name="isAutoIP"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Auto IP Address</FormLabel>
                        <FormDescription>
                          Automatically determine IP address using STUN
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}
              
              {(!form.watch("isAutoIP") || (form.watch("type") !== "A" && form.watch("type") !== "AAAA")) && (
                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Content</FormLabel>
                      <FormControl>
                        <Input placeholder="Record value" {...field} />
                      </FormControl>
                      <FormDescription>
                        The content of the DNS record (e.g. IP address, domain name)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              
              <FormField
                control={form.control}
                name="ttl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>TTL (seconds)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min={1} 
                        {...field} 
                        onChange={e => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      Time to live in seconds, how long DNS servers should cache this record
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active</FormLabel>
                      <FormDescription>
                        Enable or disable this DNS record
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Input placeholder="Optional notes about this record" {...field} />
                    </FormControl>
                    <FormDescription>
                      Add optional notes about this record (for internal reference only)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsAddRecordDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={addRecordMutation.isPending}
                >
                  {addRecordMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Add Record
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Edit Record Dialog */}
      <Dialog open={isEditRecordDialogOpen} onOpenChange={setIsEditRecordDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit DNS Record</DialogTitle>
            <DialogDescription>
              Update the DNS record for {domain.name}.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="@, www, subdomain, etc" {...field} />
                    </FormControl>
                    <FormDescription>
                      Use @ for root domain or enter subdomain name
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Record Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select record type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {recordTypes.map((type) => (
                          <SelectItem 
                            key={type} 
                            value={type}
                          >
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Moved proxied toggle above isAutoIP */}
              <FormField
                control={form.control}
                name="proxied"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Proxied</FormLabel>
                      <FormDescription>
                        Enable proxying through CDN (Cloudflare only)
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              {(form.watch("type") === "A" || form.watch("type") === "AAAA") && (
                <FormField
                  control={form.control}
                  name="isAutoIP"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Auto IP Address</FormLabel>
                        <FormDescription>
                          Automatically determine IP address using STUN
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}
              
              {(!form.watch("isAutoIP") || (form.watch("type") !== "A" && form.watch("type") !== "AAAA")) && (
                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Content</FormLabel>
                      <FormControl>
                        <Input placeholder="Record value" {...field} />
                      </FormControl>
                      <FormDescription>
                        The content of the DNS record (e.g. IP address, domain name)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              
              <FormField
                control={form.control}
                name="ttl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>TTL (seconds)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min={1} 
                        {...field} 
                        onChange={e => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      Time to live in seconds, how long DNS servers should cache this record
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active</FormLabel>
                      <FormDescription>
                        Enable or disable this DNS record
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Input placeholder="Optional notes about this record" {...field} />
                    </FormControl>
                    <FormDescription>
                      Add optional notes about this record (for internal reference only)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsEditRecordDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={updateRecordMutation.isPending}
                >
                  {updateRecordMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Update Record
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the DNS record "{selectedRecord?.name}" 
              of type {selectedRecord?.type}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteRecord}
              className="bg-destructive text-destructive-foreground"
            >
              {deleteRecordMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Back Button */}
      {onBack && (
        <div className="mt-6">
          <Button 
            variant="outline" 
            onClick={onBack}
          >
            Back to Domains
          </Button>
        </div>
      )}
    </>
  );
}