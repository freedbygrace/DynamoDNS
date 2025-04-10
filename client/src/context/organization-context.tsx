import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery, useMutation, UseMutationResult } from "@tanstack/react-query";
import { Organization, InsertOrganization, Domain } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type OrganizationContextType = {
  organizations: Organization[];
  currentOrganization: Organization | null;
  setCurrentOrganization: (organization: Organization) => void;
  isLoading: boolean;
  createOrganizationMutation: UseMutationResult<Organization, Error, InsertOrganization>;
  updateOrganizationMutation: UseMutationResult<Organization, Error, { id: string; data: Partial<InsertOrganization> }>;
  deleteOrganizationMutation: UseMutationResult<boolean, Error, string>;
  domainsLoading: boolean;
  domainsByOrganization: Record<string, Domain[]>;
};

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [domainsByOrganization, setDomainsByOrganization] = useState<Record<string, Domain[]>>({});

  const { data: organizations = [], isLoading } = useQuery<Organization[]>({
    queryKey: ["/api/organizations"],
    // Only fetch if user is logged in
    enabled: !!user,
  });
  
  // Load domains for each organization
  const { isLoading: domainsLoading } = useQuery<Domain[]>({
    queryKey: ["/api/domains"],
    enabled: !!currentOrganization
  });
  
  // Use the domains data to group by organization
  const { data: domains = [] } = useQuery<Domain[]>({
    queryKey: ["/api/domains"],
    enabled: !!currentOrganization
  });
  
  // Group domains by organization when domains change
  useEffect(() => {
    if (domains.length > 0) {
      const domainsByOrg: Record<string, Domain[]> = {};
      domains.forEach(domain => {
        if (!domainsByOrg[domain.organizationId]) {
          domainsByOrg[domain.organizationId] = [];
        }
        domainsByOrg[domain.organizationId].push(domain);
      });
      setDomainsByOrganization(domainsByOrg);
    }
  }, [domains]);
  
  const createOrganizationMutation = useMutation({
    mutationFn: async (orgData: InsertOrganization) => {
      const res = await apiRequest("POST", "/api/organizations", orgData);
      return await res.json();
    },
    onSuccess: (newOrg: Organization) => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
      toast({
        title: "Organization created",
        description: `Organization '${newOrg.name}' has been created successfully.`,
      });
      setCurrentOrganization(newOrg);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create organization",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const updateOrganizationMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertOrganization> }) => {
      const res = await apiRequest("PATCH", `/api/organizations/${id}`, data);
      return await res.json();
    },
    onSuccess: (updatedOrg: Organization) => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
      toast({
        title: "Organization updated",
        description: `Organization '${updatedOrg.name}' has been updated successfully.`,
      });
      
      // If the current organization was updated, update it in the state
      if (currentOrganization?.id === updatedOrg.id) {
        setCurrentOrganization(updatedOrg);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update organization",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const deleteOrganizationMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/organizations/${id}`);
      return res.ok;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
      
      // If the current organization was deleted, set another one as current
      if (currentOrganization?.id === id) {
        const remainingOrgs = organizations.filter(org => org.id !== id);
        if (remainingOrgs.length > 0) {
          setCurrentOrganization(remainingOrgs[0]);
        } else {
          setCurrentOrganization(null);
        }
      }
      
      toast({
        title: "Organization deleted",
        description: "Organization has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete organization",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Set default organization when organizations are loaded
  useEffect(() => {
    if (organizations.length > 0 && !currentOrganization) {
      // If user has an organization ID, try to find it in the list
      if (user?.organizationId) {
        const userOrg = organizations.find(org => org.id === user.organizationId);
        if (userOrg) {
          setCurrentOrganization(userOrg);
          return;
        }
      }
      
      // Otherwise, use the first organization
      setCurrentOrganization(organizations[0]);
    }
  }, [organizations, currentOrganization, user]);

  return (
    <OrganizationContext.Provider
      value={{ 
        organizations, 
        currentOrganization, 
        setCurrentOrganization, 
        isLoading,
        domainsLoading,
        domainsByOrganization,
        createOrganizationMutation,
        updateOrganizationMutation,
        deleteOrganizationMutation 
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  
  if (context === undefined) {
    throw new Error("useOrganization must be used within an OrganizationProvider");
  }
  
  return context;
}
