import { Organization } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building, Users, Calendar } from "lucide-react";
import { format } from "date-fns";
import { useOrganization } from "@/context/organization-context";

interface OrganizationListCardProps {
  organizations: Organization[];
}

export function OrganizationListCard({ organizations }: OrganizationListCardProps) {
  const { currentOrganization, setCurrentOrganization } = useOrganization();

  if (!organizations || organizations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Organizations</CardTitle>
          <CardDescription>
            You don't have any organizations yet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-40">
            <p className="text-muted-foreground">
              Create an organization in the settings page.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Building className="h-5 w-5 mr-2" />
          Organizations
        </CardTitle>
        <CardDescription>
          Select an organization to manage its resources
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {organizations.map((org) => (
            <div 
              key={org.id}
              className={`p-4 rounded-lg border transition-all cursor-pointer 
                hover:bg-accent/50 
                ${currentOrganization?.id === org.id ? 'border-primary bg-primary/5' : 'border-border'}
              `}
              onClick={() => setCurrentOrganization(org)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="font-medium">{org.name}</div>
                  {!org.isActive && (
                    <Badge variant="outline" className="ml-2 text-muted-foreground">
                      Inactive
                    </Badge>
                  )}
                </div>
                <div>
                  {currentOrganization?.id === org.id && (
                    <Badge className="bg-primary">Current</Badge>
                  )}
                </div>
              </div>
              <div className="flex mt-2 text-xs text-muted-foreground">
                <div className="flex items-center mr-4">
                  <Users className="h-3 w-3 mr-1" />
                  <span>3 Members</span>
                </div>
                <div className="flex items-center">
                  <Calendar className="h-3 w-3 mr-1" />
                  <span>Created {format(new Date(org.createdAt), 'MMM d, yyyy')}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}