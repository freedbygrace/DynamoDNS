import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useOrganization } from "@/context/organization-context";
import { ChevronDown } from "lucide-react";

export function OrganizationSelector() {
  const { organizations, currentOrganization, setCurrentOrganization, isLoading } = useOrganization();

  if (isLoading) {
    return (
      <div className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md bg-secondary text-secondary-foreground opacity-70 animate-pulse">
        <div className="flex items-center">
          <span className="w-2 h-2 bg-muted rounded-full mr-2"></span>
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (!currentOrganization || organizations.length === 0) {
    return (
      <div className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md bg-secondary text-secondary-foreground">
        <div className="flex items-center">
          <span className="w-2 h-2 bg-warning rounded-full mr-2"></span>
          <span>No Organization</span>
        </div>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md hover:bg-accent">
          <div className="flex items-center">
            <span className="w-2 h-2 bg-success rounded-full mr-2"></span>
            <span>{currentOrganization.name}</span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => setCurrentOrganization(org)}
            className={org.id === currentOrganization.id ? "bg-muted" : ""}
          >
            <div className="flex items-center">
              <span className={`w-2 h-2 rounded-full mr-2 ${org.isActive ? "bg-success" : "bg-warning"}`}></span>
              <span>{org.name}</span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
