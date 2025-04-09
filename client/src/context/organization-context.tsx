import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Organization } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";

type OrganizationContextType = {
  organizations: Organization[];
  currentOrganization: Organization | null;
  setCurrentOrganization: (organization: Organization) => void;
  isLoading: boolean;
};

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);

  const { data: organizations = [], isLoading } = useQuery<Organization[]>({
    queryKey: ["/api/organizations"],
    // Only fetch if user is logged in
    enabled: !!user,
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
      value={{ organizations, currentOrganization, setCurrentOrganization, isLoading }}
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
