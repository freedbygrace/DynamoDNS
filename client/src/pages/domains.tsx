import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MainLayout } from "@/components/layouts/main-layout";
import { DomainTable } from "@/components/domain/domain-table";
import { DomainDetails } from "@/components/domain/domain-details";
import { Domain, InsertDomain, Provider } from "@shared/schema";
import { useCustomer } from "@/context/customer-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Loader2, ArrowLeft } from "lucide-react";

// Domain name regex
const domainRegex = /^((?!-)[A-Za-z0-9-]{1,63}(?<!-)\.)+[A-Za-z]{2,}$/;

// Domain form schema
const domainFormSchema = z.object({
  name: z.string()
    .min(3, "Domain name must be at least 3 characters")
    .regex(domainRegex, "Please enter a valid domain name (e.g., example.com)"),
  providerId: z.string().uuid().optional(),
  isActive: z.boolean().default(true),
});

export default function DomainsPage() {
  const { toast } = useToast();
  const { currentCustomer } = useCustomer();
  
  const [isAddDomainDialogOpen, setIsAddDomainDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);
  const [activeDomain, setActiveDomain] = useState<Domain | null>(null);

  // Fetch domains
  const { data: domains = [], isLoading } = useQuery<Domain[]>({
    queryKey: ["/api/domains", currentCustomer?.id],
    enabled: !!currentCustomer?.id,
  });
  
  // Fetch providers for the form
  const { data: providers = [] } = useQuery<Provider[]>({
    queryKey: ["/api/providers"],
  });

  // Form for adding a domain
  const form = useForm<z.infer<typeof domainFormSchema>>({
    resolver: zodResolver(domainFormSchema),
    defaultValues: {
      name: "",
      providerId: undefined, // Explicitly set undefined to avoid empty string
      isActive: true,
    },
  });

  // Add domain mutation
  const addDomainMutation = useMutation({
    mutationFn: async (data: z.infer<typeof domainFormSchema>) => {
      // Prepare domain data with organizationId
      const domainData: InsertDomain = {
        ...data,
        organizationId: currentOrganization?.id || "",
      };
      
      // Add special handling for providerId
      // If providerId is an empty string or undefined, remove it completely
      // This ensures we don't send empty string which causes backend validation issues
      if (!domainData.providerId || domainData.providerId === "") {
        delete domainData.providerId; // Remove instead of setting to null to avoid type issues
      }
      
      console.log("Submitting domain with provider:", domainData.providerId);
      
      const res = await apiRequest("POST", "/api/domains", domainData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/domains", currentOrganization?.id] });
      setIsAddDomainDialogOpen(false);
      form.reset();
      toast({
        title: "Domain added",
        description: "The domain has been successfully added.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to add domain",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete domain mutation
  const deleteDomainMutation = useMutation({
    mutationFn: async (domainId: string) => {
      await apiRequest("DELETE", `/api/domains/${domainId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/domains", currentOrganization?.id] });
      setIsDeleteDialogOpen(false);
      setSelectedDomain(null);
      toast({
        title: "Domain deleted",
        description: "The domain has been successfully deleted.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete domain",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Form submission handler
  const onSubmit = (data: z.infer<typeof domainFormSchema>) => {
    addDomainMutation.mutate(data);
  };

  // Handle domain management
  const handleManageDomain = (domain: Domain) => {
    setActiveDomain(domain);
  };

  // Return to domain list
  const handleBackToDomains = () => {
    setActiveDomain(null);
  };

  // Handle domain deletion
  const handleDeleteDomain = (domain: Domain) => {
    setSelectedDomain(domain);
    setIsDeleteDialogOpen(true);
  };

  // Confirm deletion
  const confirmDeleteDomain = () => {
    if (selectedDomain) {
      deleteDomainMutation.mutate(selectedDomain.id);
      // If the deleted domain is the active domain, return to the domain list
      if (activeDomain && activeDomain.id === selectedDomain.id) {
        setActiveDomain(null);
      }
    }
  };

  return (
    <MainLayout
      title="Domains"
      description="Manage your DNS domains across providers."
    >
      {!activeDomain ? (
        // Domain list view
        <>
          <div className="mb-6 flex justify-end">
            <Button onClick={() => setIsAddDomainDialogOpen(true)}>
              Add Domain
            </Button>
          </div>

          {/* Domains Table */}
          <DomainTable 
            onManageDomain={handleManageDomain}
            onDeleteDomain={handleDeleteDomain}
            onAddDomain={() => setIsAddDomainDialogOpen(true)}
          />
        </>
      ) : (
        // Domain detail view with DNS records
        <>
          <div className="mb-6">
            <Button 
              variant="outline" 
              onClick={handleBackToDomains}
              className="mb-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Domains
            </Button>
            <DomainDetails domain={activeDomain} />
          </div>
        </>
      )}

      {/* Add Domain Dialog */}
      <Dialog open={isAddDomainDialogOpen} onOpenChange={setIsAddDomainDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Domain</DialogTitle>
            <DialogDescription>
              Add a new domain to manage its DNS records.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Domain Name</FormLabel>
                    <FormControl>
                      <Input placeholder="example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="providerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>DNS Provider</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value)}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a provider" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {providers.map((provider: Provider) => (
                          <SelectItem 
                            key={provider.id} 
                            value={provider.id}
                          >
                            {provider.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button 
                  type="submit" 
                  disabled={addDomainMutation.isPending}
                >
                  {addDomainMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    "Add Domain"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the domain <strong>{selectedDomain?.name}</strong> and 
              all associated DNS records. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteDomain}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteDomainMutation.isPending}
            >
              {deleteDomainMutation.isPending ? (
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