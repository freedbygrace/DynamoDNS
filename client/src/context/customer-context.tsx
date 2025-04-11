import { createContext, ReactNode, useContext, useState, useEffect } from "react";
import { useQuery, useMutation, UseMutationResult } from "@tanstack/react-query";
import { Customer, Domain, InsertCustomer } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

type CustomerContextType = {
  customers: Customer[];
  currentCustomer: Customer | null;
  setCurrentCustomer: (customer: Customer) => void;
  isLoading: boolean;
  createCustomerMutation: UseMutationResult<Customer, Error, InsertCustomer>;
  updateCustomerMutation: UseMutationResult<Customer, Error, { id: string; data: Partial<InsertCustomer> }>;
  deleteCustomerMutation: UseMutationResult<boolean, Error, string>;
  domainsLoading: boolean;
  domainsByCustomer: Record<string, Domain[]>;
};

const CustomerContext = createContext<CustomerContextType | undefined>(undefined);

export function CustomerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentCustomer, setCurrentCustomer] = useState<Customer | null>(null);
  const [domainsByCustomer, setDomainsByCustomer] = useState<Record<string, Domain[]>>({});

  // Get customers
  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Load domains for current customer
  const { isLoading: domainsLoading } = useQuery<Domain[]>({
    queryKey: ["/api/domains", { customerId: currentCustomer?.id }],
    enabled: !!currentCustomer,
    staleTime: 1000 * 60 * 5, // 5 minutes
    onSuccess: (domains) => {
      if (currentCustomer) {
        setDomainsByCustomer(prev => ({
          ...prev,
          [currentCustomer.id]: domains
        }));
      }
    }
  });

  // Customer mutations
  const createCustomerMutation = useMutation({
    mutationFn: async (customer: InsertCustomer) => {
      const res = await apiRequest("POST", "/api/customers", customer);
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({
        title: "Customer created",
        description: "The customer has been successfully created.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to create customer",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateCustomerMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertCustomer> }) => {
      const res = await apiRequest("PUT", `/api/customers/${id}`, data);
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({
        title: "Customer updated",
        description: "The customer has been successfully updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update customer",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteCustomerMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/customers/${id}`);
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({
        title: "Customer deleted",
        description: "The customer has been successfully deleted.",
      });
      
      // Reset current customer if it was deleted
      if (currentCustomer && customers.length > 0 && !customers.find(c => c.id === currentCustomer.id)) {
        setCurrentCustomer(customers[0]);
      }
    },
    onError: (error) => {
      toast({
        title: "Failed to delete customer",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Set default customer when customers are loaded
  useEffect(() => {
    if (customers.length > 0 && !currentCustomer) {
      // Otherwise, use the first customer
      setCurrentCustomer(customers[0]);
    }
  }, [customers, currentCustomer]);

  return (
    <CustomerContext.Provider
      value={{ 
        customers, 
        currentCustomer, 
        setCurrentCustomer, 
        isLoading,
        domainsLoading,
        domainsByCustomer,
        createCustomerMutation,
        updateCustomerMutation,
        deleteCustomerMutation 
      }}
    >
      {children}
    </CustomerContext.Provider>
  );
}

export function useCustomer() {
  const context = useContext(CustomerContext);
  
  if (context === undefined) {
    throw new Error("useCustomer must be used within a CustomerProvider");
  }
  
  return context;
}