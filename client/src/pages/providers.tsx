import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MainLayout } from "@/components/layouts/main-layout";
import { Provider, InsertProvider, providerTypes } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/shared/pagination";
import { Loader2, CreditCard, MoreVertical, Lock, Cloud, Home, CircleHelp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// Provider form schema
const providerFormSchema = z.object({
  name: z.string().min(1, "Provider name is required"),
  type: z.enum(providerTypes as [string, ...string[]]),
  apiKey: z.string().min(1, "API key is required"),
  apiSecret: z.string().optional(),
  isActive: z.boolean().default(true),
});

export default function ProvidersPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [isAddProviderDialogOpen, setIsAddProviderDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;
  
  // Fetch providers
  const { data: providers = [], isLoading } = useQuery<Provider[]>({
    queryKey: ["/api/providers"],
  });

  // Form for adding a provider
  const form = useForm<z.infer<typeof providerFormSchema>>({
    resolver: zodResolver(providerFormSchema),
    defaultValues: {
      name: "",
      type: "cloudflare",
      apiKey: "",
      apiSecret: "",
      isActive: true,
    },
  });

  // Add provider mutation
  const addProviderMutation = useMutation({
    mutationFn: async (data: z.infer<typeof providerFormSchema>) => {
      const providerData: InsertProvider = {
        name: data.name,
        type: data.type,
        credentials: {
          apiKey: data.apiKey,
          apiSecret: data.apiSecret,
        },
        isActive: data.isActive,
      };
      
      const res = await apiRequest("POST", "/api/providers", providerData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/providers"] });
      setIsAddProviderDialogOpen(false);
      form.reset();
      toast({
        title: "Provider added",
        description: "The DNS provider has been successfully added.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to add provider",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete provider mutation
  const deleteProviderMutation = useMutation({
    mutationFn: async (providerId: number) => {
      await apiRequest("DELETE", `/api/providers/${providerId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/providers"] });
      setIsDeleteDialogOpen(false);
      setSelectedProvider(null);
      toast({
        title: "Provider deleted",
        description: "The DNS provider has been successfully deleted.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete provider",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Form submission handler
  const onSubmit = (data: z.infer<typeof providerFormSchema>) => {
    addProviderMutation.mutate(data);
  };

  // Handle provider deletion
  const handleDeleteProvider = (provider: Provider) => {
    setSelectedProvider(provider);
    setIsDeleteDialogOpen(true);
  };

  // Confirm deletion
  const confirmDeleteProvider = () => {
    if (selectedProvider) {
      deleteProviderMutation.mutate(selectedProvider.id);
    }
  };

  // Get provider icon
  const getProviderIcon = (type: string) => {
    switch (type) {
      case "cloudflare":
        return <Cloud className="mr-2 h-5 w-5 text-primary" />;
      case "route53":
        return <Home className="mr-2 h-5 w-5 text-primary" />;
      case "godaddy":
        return <CreditCard className="mr-2 h-5 w-5 text-primary" />;
      default:
        return <CircleHelp className="mr-2 h-5 w-5 text-primary" />;
    }
  };

  // Get provider description
  const getProviderDescription = (type: string) => {
    switch (type) {
      case "cloudflare":
        return "Cloudflare DNS provider";
      case "route53":
        return "Amazon Route 53 DNS provider";
      case "godaddy":
        return "GoDaddy DNS provider";
      default:
        return "Other DNS provider";
    }
  };

  // Calculate pagination
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedProviders = providers.slice(startIndex, endIndex);
  const totalPages = Math.ceil(providers.length / pageSize);

  // Check if current user has permission
  const hasManagePermission = user?.role === "admin" || user?.role === "manager";

  if (!hasManagePermission) {
    return (
      <MainLayout
        title="DNS Providers"
        description="Manage DNS provider integrations."
      >
        <Card>
          <CardContent className="pt-6 flex flex-col items-center justify-center h-64">
            <Lock className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Access Restricted</h3>
            <p className="text-center text-muted-foreground">
              You don't have permission to access this page. Only administrators and managers can manage DNS providers.
            </p>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="DNS Providers"
      description="Manage DNS provider integrations for your domains."
    >
      <div className="mb-6 flex justify-between items-center">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">DNS Providers</h2>
          <p className="text-sm text-muted-foreground">
            Connect to various DNS providers to manage your domain records.
          </p>
        </div>
        <Button onClick={() => setIsAddProviderDialogOpen(true)}>
          <CreditCard className="mr-2 h-4 w-4" />
          Add Provider
        </Button>
      </div>

      {/* Provider overview cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center text-lg">
              <Cloud className="mr-2 h-5 w-5" />
              Cloudflare
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-2">
              Full DNS management and CDN services with API access.
            </p>
            <a 
              href="https://developers.cloudflare.com/api/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline"
            >
              API Documentation
            </a>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center text-lg">
              <Home className="mr-2 h-5 w-5" />
              Amazon Route 53
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-2">
              Scalable DNS management service from AWS.
            </p>
            <a 
              href="https://docs.aws.amazon.com/Route53/latest/APIReference/Welcome.html" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline"
            >
              API Documentation
            </a>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center text-lg">
              <CreditCard className="mr-2 h-5 w-5" />
              GoDaddy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-2">
              Domain registration and DNS management provider.
            </p>
            <a 
              href="https://developer.godaddy.com/doc" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline"
            >
              API Documentation
            </a>
          </CardContent>
        </Card>
      </div>

      {/* Providers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Your Configured Providers</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : providers.length === 0 ? (
            <div className="text-center py-8">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <CreditCard className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mt-4 text-lg font-medium">No providers found</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Get started by adding your first DNS provider.
              </p>
              <div className="mt-6">
                <Button onClick={() => setIsAddProviderDialogOpen(true)}>
                  Add Provider
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Provider</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedProviders.map((provider) => (
                      <TableRow key={provider.id}>
                        <TableCell className="font-medium">{provider.name}</TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            {getProviderIcon(provider.type)}
                            <span>{provider.type.charAt(0).toUpperCase() + provider.type.slice(1)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {provider.isActive ? (
                            <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-muted/10 text-muted-foreground">
                              Inactive
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {provider.createdAt && formatDistanceToNow(new Date(provider.createdAt), { addSuffix: true })}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleDeleteProvider(provider)}
                                className="text-destructive focus:text-destructive"
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {providers.length > pageSize && (
                <div className="mt-4">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    itemLabel="providers"
                    totalItems={providers.length}
                    itemsPerPage={pageSize}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Add Provider Dialog */}
      <Dialog open={isAddProviderDialogOpen} onOpenChange={setIsAddProviderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add DNS Provider</DialogTitle>
            <DialogDescription>
              Connect to a DNS provider to manage your domains.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Provider Name</FormLabel>
                    <FormControl>
                      <Input placeholder="My Cloudflare Account" {...field} />
                    </FormControl>
                    <FormDescription>
                      A descriptive name for this provider account
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
                    <FormLabel>Provider Type</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select provider type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {providerTypes.map(type => (
                          <SelectItem key={type} value={type}>
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {getProviderDescription(form.watch("type"))}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="apiKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>API Key</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter API key" {...field} />
                    </FormControl>
                    <FormDescription>
                      API key for authentication with the provider
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {form.watch("type") !== "cloudflare" && (
                <FormField
                  control={form.control}
                  name="apiSecret"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>API Secret</FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          placeholder="Enter API secret" 
                          {...field} 
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormDescription>
                        API secret or token (required for some providers)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              
              <DialogFooter>
                <Button 
                  type="submit" 
                  disabled={addProviderMutation.isPending}
                >
                  {addProviderMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    "Add Provider"
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
            <AlertDialogTitle>Delete Provider</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the provider <strong>{selectedProvider?.name}</strong>.
              Any domains using this provider will no longer be able to update their DNS records.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteProvider}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteProviderMutation.isPending}
            >
              {deleteProviderMutation.isPending ? (
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
