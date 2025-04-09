import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MainLayout } from "@/components/layouts/main-layout";
import { DomainTable } from "@/components/domain/domain-table";
import { Domain, InsertDomain } from "@shared/schema";
import { useOrganization } from "@/context/organization-context";
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
import { Loader2 } from "lucide-react";

// Domain form schema
const domainFormSchema = z.object({
  name: z.string().min(3, "Domain name must be at least 3 characters"),
  providerId: z.number({
    required_error: "Please select a DNS provider",
  }),
  isActive: z.boolean().default(true),
});

export default function DomainsPage() {
  const { toast } = useToast();
  const { currentOrganization } = useOrganization();
  
  const [isAddDomainDialogOpen, setIsAddDomainDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);

  // Fetch domains
  const { data: domains = [], isLoading } = useQuery<Domain[]>({
    queryKey: ["/api/domains", currentOrganization?.id],
    enabled: !!currentOrganization?.id,
  });
  
  // Fetch providers for the form
  const { data: providers = [] } = useQuery({
    queryKey: ["/api/providers"],
  });

  // Form for adding a domain
  const form = useForm<z.infer<typeof domainFormSchema>>({
    resolver: zodResolver(domainFormSchema),
    defaultValues: {
      name: "",
      isActive: true,
    },
  });

  // Add domain mutation
  const addDomainMutation = useMutation({
    mutationFn: async (data: z.infer<typeof domainFormSchema>) => {
      const domainData: InsertDomain = {
        ...data,
        organizationId: currentOrganization?.id || 0,
      };
      
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
    mutationFn: async (domainId: number) => {
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
    // Navigate to DNS records for this domain
    window.location.href = `/dns-records?domainId=${domain.id}`;
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
    }
  };

  return (
    <MainLayout
      title="Domains"
      description="Manage your DNS domains across providers."
    >
      <div className="mb-6 flex justify-end">
        <Button onClick={() => setIsAddDomainDialogOpen(true)}>
          Add Domain
        </Button>
      </div>

      {/* Domains Table */}
      <DomainTable 
        onManageDomain={handleManageDomain}
        onDeleteDomain={handleDeleteDomain}
      />

      {/* Add Domain Dialog */}
      <Dialog open={isAddDomainDialogOpen} onOpenChange={setIsAddDomainDialogOpen}>
        <DialogContent>
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
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      defaultValue={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a provider" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {providers.map((provider) => (
                          <SelectItem 
                            key={provider.id} 
                            value={provider.id.toString()}
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
        <AlertDialogContent>
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
