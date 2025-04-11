import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Domain, Provider } from "@shared/schema";
import { Link } from "wouter";
import { useCustomer } from "@/context/customer-context";
import { Pagination } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";
import { Cloud, Home, MoreVertical, Loader2, CircleHelp } from "lucide-react";

interface DomainTableProps {
  onManageDomain?: (domain: Domain) => void;
  onDeleteDomain?: (domain: Domain) => void;
  onAddDomain?: () => void;
}

export function DomainTable({ onManageDomain, onDeleteDomain, onAddDomain }: DomainTableProps) {
  const { currentCustomer } = useCustomer();
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const { data: domains = [], isLoading } = useQuery<Domain[]>({
    queryKey: ["/api/domains", currentCustomer?.id],
    enabled: !!currentCustomer,
  });

  // Get providers to display provider names
  const { data: providers = [] } = useQuery<Provider[]>({
    queryKey: ["/api/providers"],
  });

  const getProviderName = (providerId: string | null | undefined) => {
    // Add enhanced debugging to help track down the issue
    console.log("Provider lookup - ID provided:", providerId, typeof providerId);
    console.log("Available providers:", providers.map(p => ({ id: p.id, name: p.name })));
    
    // Handle completely empty providerId cases
    if (providerId === null || providerId === undefined || providerId === "") {
      console.log("Provider is empty/null");
      return "None";
    }
    
    // Check if the provider exists in our providers list
    // The providerId from the database will be a string UUID
    const provider = providers.find(p => p.id === providerId);
    
    if (provider) {
      console.log("Found provider:", provider.name);
      return provider.name;
    } else {
      console.log("Provider not found for ID:", providerId);
      // If we have a providerId but can't find the provider (might be deleted)
      return "Unknown Provider";
    }
  };

  const getProviderIcon = (providerId: string | null | undefined) => {
    // Handle completely empty providerId cases
    if (!providerId || providerId === "") {
      return <CircleHelp className="mr-2 text-muted-foreground" size={16} />;
    }
    
    // The providerId from the database will be a string UUID
    const provider = providers.find(p => p.id === providerId);
    
    if (!provider) {
      return <CircleHelp className="mr-2 text-warning" size={16} />;
    }
    
    switch (provider.type) {
      case "cloudflare":
        return <Cloud className="mr-2 text-primary" size={16} />;
      case "route53":
        return <Home className="mr-2 text-primary" size={16} />;
      default:
        return <CircleHelp className="mr-2 text-primary" size={16} />;
    }
  };

  const getStatusBadge = (domain: Domain) => {
    if (!domain.isActive) {
      return (
        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-muted/30 text-muted-foreground">
          Inactive
        </span>
      );
    }
    
    // If updated within the last hour, show "Active"
    if (domain.lastUpdated && new Date(domain.lastUpdated).getTime() > Date.now() - 3600000) {
      return (
        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-success/10 text-success">
          Active
        </span>
      );
    }
    
    // If updated more than 24 hours ago, show "Update Pending"
    if (domain.lastUpdated && new Date(domain.lastUpdated).getTime() < Date.now() - 86400000) {
      return (
        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-warning/10 text-warning">
          Update Pending
        </span>
      );
    }
    
    return (
      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-success/10 text-success">
        Active
      </span>
    );
  };

  // Calculate pagination
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedDomains = domains.slice(startIndex, endIndex);
  const totalPages = Math.ceil(domains.length / pageSize);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (domains.length === 0) {
    return (
      <div className="text-center py-8 border rounded-lg">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Home className="h-6 w-6 text-primary" />
        </div>
        <h3 className="mt-4 text-lg font-medium">No domains found</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Get started by adding your first domain.
        </p>
        <div className="mt-6">
          <Button onClick={onAddDomain}>Add Domain</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg shadow-sm border border-border">
      <div className="p-5 border-b border-border flex justify-between items-center">
        <h2 className="text-lg font-semibold">Managed Domains</h2>
        <Button onClick={onAddDomain}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mr-1"
          >
            <path d="M5 12h14"></path>
            <path d="M12 5v14"></path>
          </svg>
          Add Domain
        </Button>
      </div>
      
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Domain</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Records</TableHead>
              <TableHead>Last Update</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedDomains.map(domain => (
              <TableRow key={domain.id}>
                <TableCell className="font-medium">{domain.name}</TableCell>
                <TableCell>
                  <div className="flex items-center">
                    {getProviderIcon(domain.providerId)}
                    {getProviderName(domain.providerId)}
                  </div>
                </TableCell>
                <TableCell>
                  <div 
                    className="text-primary hover:underline cursor-pointer"
                    onClick={() => onManageDomain && onManageDomain(domain)}
                  >
                    View Records
                  </div>
                </TableCell>
                <TableCell>
                  {domain.lastUpdated 
                    ? formatDistanceToNow(new Date(domain.lastUpdated), { addSuffix: true }) 
                    : "Never"}
                </TableCell>
                <TableCell>{getStatusBadge(domain)}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => onManageDomain && onManageDomain(domain)}
                      >
                        Manage
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onDeleteDomain && onDeleteDomain(domain)}
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
      
      <div className="p-4 border-t border-border">
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          itemLabel="domains"
          totalItems={domains.length}
          itemsPerPage={pageSize}
        />
      </div>
    </div>
  );
}
