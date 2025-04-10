import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MainLayout } from "@/components/layouts/main-layout";
import { DnsRecord, InsertDnsRecord, Domain, recordTypes } from "@shared/schema";
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
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { RecentActivity } from "@/components/activity/recent-activity";
import { Pagination } from "@/components/shared/pagination";
import { Loader2, Home, Plus, Pencil, Trash2, ArrowLeft, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";

// DNS Record form schema
const dnsRecordSchema = z.object({
  name: z.string().min(1, "Record name is required"),
  type: z.enum(recordTypes),
  content: z.string().min(1, "Content is required"),
  ttl: z.number().int().min(1).default(3600),
  proxied: z.boolean().default(false),
  isActive: z.boolean().default(true),
  isAutoIP: z.boolean().default(false),
  notes: z.string().optional(),
});

export default function DnsRecordsPage() {
  const { toast } = useToast();
  const [domainId, setDomainId] = useState<string | null>(null);
  
  // Get domainId from query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("domainId");
    if (id) {
      setDomainId(id);
    }
  }, []);

  const [isAddRecordDialogOpen, setIsAddRecordDialogOpen] = useState(false);
  const [isEditRecordDialogOpen, setIsEditRecordDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<DnsRecord | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  
  // Fetch domain details
  const { data: domain } = useQuery<Domain>({
    queryKey: ["/api/domains", domainId],
    enabled: !!domainId,
  });

  // Fetch DNS records for domain
  const { data: records = [], isLoading } = useQuery<DnsRecord[]>({
    queryKey: ["/api/dns-records", domainId],
    enabled: !!domainId,
  });

  // Form for adding/editing a DNS record
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

  // Reset form when selected record changes
  useEffect(() => {
    if (selectedRecord) {
      form.reset({
        name: selectedRecord.name,
        type: selectedRecord.type as any,
        content: selectedRecord.content,
        ttl: selectedRecord.ttl ?? 3600,
        proxied: selectedRecord.proxied ?? false,
        isActive: selectedRecord.isActive,
        isAutoIP: selectedRecord.isAutoIP ?? false,
        notes: selectedRecord.notes ?? "",
      });
    } else {
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
    }
  }, [selectedRecord, form]);

  // Add DNS record mutation
  const addRecordMutation = useMutation({
    mutationFn: async (data: z.infer<typeof dnsRecordSchema>) => {
      if (!domainId) throw new Error("Domain ID is required");
      
      const recordData: InsertDnsRecord = {
        ...data,
        domainId,
      };
      
      const res = await apiRequest("POST", "/api/dns-records", recordData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dns-records", domainId] });
      setIsAddRecordDialogOpen(false);
      form.reset();
      toast({
        title: "Record added",
        description: "The DNS record has been successfully added.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to add record",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update DNS record mutation
  const updateRecordMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: z.infer<typeof dnsRecordSchema> }) => {
      const res = await apiRequest("PUT", `/api/dns-records/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dns-records", domainId] });
      setIsEditRecordDialogOpen(false);
      setSelectedRecord(null);
      toast({
        title: "Record updated",
        description: "The DNS record has been successfully updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update record",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete DNS record mutation
  const deleteRecordMutation = useMutation({
    mutationFn: async (recordId: string) => {
      await apiRequest("DELETE", `/api/dns-records/${recordId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dns-records", domainId] });
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

  // Form submission handler for adding
  const onAddSubmit = (data: z.infer<typeof dnsRecordSchema>) => {
    addRecordMutation.mutate(data);
  };

  // Form submission handler for editing
  const onEditSubmit = (data: z.infer<typeof dnsRecordSchema>) => {
    if (selectedRecord) {
      updateRecordMutation.mutate({ id: selectedRecord.id, data });
    }
  };

  // Handle record editing
  const handleEditRecord = (record: DnsRecord) => {
    setSelectedRecord(record);
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

  // Calculate pagination
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedRecords = records.slice(startIndex, endIndex);
  const totalPages = Math.ceil(records.length / pageSize);

  if (!domainId) {
    return (
      <MainLayout title="DNS Records">
        <Card>
          <CardContent className="pt-6 flex flex-col items-center justify-center h-64">
            <Home className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Domain Selected</h3>
            <p className="text-center text-muted-foreground mb-4">
              Please select a domain to manage its DNS records.
            </p>
            <Link href="/domains">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Go to Domains
              </Button>
            </Link>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title={`DNS Records ${domain ? `for ${domain.name}` : ''}`}
      description="Manage DNS records for your domain."
    >
      {/* Breadcrumb */}
      <div className="mb-6">
        <Breadcrumb>
          <BreadcrumbItem>
            <BreadcrumbLink href="/domains">Domains</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="#">{domain?.name || 'Loading...'}</BreadcrumbLink>
          </BreadcrumbItem>
        </Breadcrumb>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="md:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>DNS Records</CardTitle>
              <Button onClick={() => setIsAddRecordDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Record
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : records.length === 0 ? (
                <div className="text-center py-8">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Home className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="mt-4 text-lg font-medium">No DNS records found</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Get started by adding your first DNS record.
                  </p>
                  <div className="mt-6">
                    <Button onClick={() => setIsAddRecordDialogOpen(true)}>
                      Add DNS Record
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Content</TableHead>
                          <TableHead>TTL</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Updated</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedRecords.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell className="font-medium">{record.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{record.type}</Badge>
                              {record.isAutoIP && (record.type === 'A' || record.type === 'AAAA') && (
                                <Badge variant="outline" className="ml-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                                  Auto IP
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {record.content.length > 30 
                                ? record.content.substring(0, 30) + '...' 
                                : record.content}
                            </TableCell>
                            <TableCell>{record.ttl}</TableCell>
                            <TableCell>
                              {record.isActive ? (
                                <Badge variant="default" className="bg-success/20 text-success hover:bg-success/30">
                                  Active
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-muted/20 text-muted-foreground">
                                  Inactive
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {record.lastUpdated 
                                ? formatDistanceToNow(new Date(record.lastUpdated), { addSuffix: true }) 
                                : "Never"}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end">
                                {record.notes && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon">
                                          <FileText className="h-4 w-4 text-muted-foreground" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent side="left">
                                        <p className="font-normal">{record.notes}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
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
                                  onClick={() => handleDeleteRecord(record)}
                                  className="text-destructive"
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
                    <div className="mt-4">
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
                </>
              )}
            </CardContent>
          </Card>
        </div>
        
        <div>
          <RecentActivity domainId={domainId} />
        </div>
      </div>

      {/* Add Record Dialog */}
      <Dialog open={isAddRecordDialogOpen} onOpenChange={setIsAddRecordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add DNS Record</DialogTitle>
            <DialogDescription>
              Add a new DNS record to {domain?.name || 'your domain'}.
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
              
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Content</FormLabel>
                    <FormControl>
                      <Input placeholder="192.168.1.1, example.com, etc" {...field} />
                    </FormControl>
                    <FormDescription>
                      {form.watch("type") === "A" && "IP address (e.g. 192.168.1.1)"}
                      {form.watch("type") === "AAAA" && "IPv6 address"}
                      {form.watch("type") === "CNAME" && "Domain name (e.g. example.com)"}
                      {form.watch("type") === "MX" && "Mail server (e.g. mail.example.com)"}
                      {form.watch("type") === "TXT" && "Text content"}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="ttl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>TTL (seconds)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        {...field} 
                        value={field.value}
                        onChange={e => field.onChange(parseInt(e.target.value || "3600"))}
                      />
                    </FormControl>
                    <FormDescription>
                      Time-to-live in seconds. 3600 = 1 hour
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
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
              
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active</FormLabel>
                      <FormDescription>
                        Enable this record to be used
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
                      Add any additional information about this record
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button 
                  type="submit" 
                  disabled={addRecordMutation.isPending}
                >
                  {addRecordMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    "Add Record"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Record Dialog */}
      <Dialog open={isEditRecordDialogOpen} onOpenChange={setIsEditRecordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit DNS Record</DialogTitle>
            <DialogDescription>
              Update the DNS record for {domain?.name || 'your domain'}.
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
              
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Content</FormLabel>
                    <FormControl>
                      <Input placeholder="192.168.1.1, example.com, etc" {...field} />
                    </FormControl>
                    <FormDescription>
                      {form.watch("type") === "A" && "IP address (e.g. 192.168.1.1)"}
                      {form.watch("type") === "AAAA" && "IPv6 address"}
                      {form.watch("type") === "CNAME" && "Domain name (e.g. example.com)"}
                      {form.watch("type") === "MX" && "Mail server (e.g. mail.example.com)"}
                      {form.watch("type") === "TXT" && "Text content"}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="ttl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>TTL (seconds)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        {...field} 
                        value={field.value}
                        onChange={e => field.onChange(parseInt(e.target.value || "3600"))}
                      />
                    </FormControl>
                    <FormDescription>
                      Time-to-live in seconds. 3600 = 1 hour
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
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
              
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active</FormLabel>
                      <FormDescription>
                        Enable this record to be used
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
                      Add any additional information about this record
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button 
                  type="submit" 
                  disabled={updateRecordMutation.isPending}
                >
                  {updateRecordMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Record"
                  )}
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
              This will permanently delete the DNS record <strong>{selectedRecord?.name}</strong> of type <strong>{selectedRecord?.type}</strong>. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteRecord}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteRecordMutation.isPending}
            >
              {deleteRecordMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
