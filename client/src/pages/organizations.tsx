import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MainLayout } from '@/components/layouts/main-layout';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Organization } from '@shared/schema';
import { useOrganization } from '@/context/organization-context';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Users, Plus, Edit, Trash2, Building } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { cn } from '@/lib/utils';

export default function OrganizationsPage() {
  const { user } = useAuth();
  const { organizations, currentOrganization, setCurrentOrganization, createOrganizationMutation } = useOrganization();
  const { toast } = useToast();
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgActive, setNewOrgActive] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const isAdmin = user?.role === 'admin';
  
  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) {
      toast({
        title: 'Error',
        description: 'Organization name cannot be empty',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      await createOrganizationMutation.mutateAsync({
        name: newOrgName,
        isActive: newOrgActive,
      });
      
      setNewOrgName('');
      setNewOrgActive(true);
      setIsDialogOpen(false);
      
      toast({
        title: 'Success',
        description: 'Organization created successfully',
      });
    } catch (error) {
      console.error('Error creating organization:', error);
      toast({
        title: 'Error',
        description: 'Failed to create organization',
        variant: 'destructive',
      });
    }
  };
  
  return (
    <MainLayout 
      title="Organizations" 
      description="Manage your organizations and their settings."
    >
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Organizations</h2>
        {isAdmin && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Organization
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Organization</DialogTitle>
                <DialogDescription>
                  Add a new organization to your account.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateOrganization}>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="orgName">Organization Name</Label>
                    <Input
                      id="orgName"
                      value={newOrgName}
                      onChange={(e) => setNewOrgName(e.target.value)}
                      placeholder="Enter organization name"
                      required
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="isActive"
                      checked={newOrgActive}
                      onCheckedChange={(checked) => setNewOrgActive(checked as boolean)}
                    />
                    <Label htmlFor="isActive">Active</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={createOrganizationMutation.isPending}
                  >
                    {createOrganizationMutation.isPending ? 'Creating...' : 'Create Organization'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {organizations.map((org) => (
          <Card 
            key={org.id} 
            className={cn(
              'cursor-pointer transition-all hover:shadow-md',
              currentOrganization?.id === org.id && 'border-primary'
            )}
            onClick={() => setCurrentOrganization(org)}
          >
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="flex items-center">
                  <div className="p-2 rounded-full bg-primary/10 mr-3">
                    <Building className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg mb-1">{org.name}</CardTitle>
                    <CardDescription>
                      {org.isActive ? 'Active' : 'Inactive'}
                    </CardDescription>
                  </div>
                </div>
                {currentOrganization?.id === org.id && (
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary">
                    <Users className="h-3.5 w-3.5 text-primary-foreground" />
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="pb-3">
              <p className="text-sm text-muted-foreground">
                Created on {new Date(org.createdAt).toLocaleDateString()}
              </p>
            </CardContent>
            <CardFooter className="flex justify-between pt-2">
              <Button 
                variant="ghost" 
                size="sm"
                className="text-muted-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  // View organization details
                }}
              >
                View Details
              </Button>

              {isAdmin && (
                <div className="flex space-x-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Edit organization
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Delete organization
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>

      {organizations.length === 0 && (
        <Card className="border-dashed p-8">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <Building className="w-10 h-10 text-muted-foreground" />
            <div>
              <h3 className="text-lg font-medium">No Organizations</h3>
              <p className="text-sm text-muted-foreground">
                You don't have any organizations yet. Create one to get started.
              </p>
            </div>
            {isAdmin && (
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Organization
              </Button>
            )}
          </div>
        </Card>
      )}
    </MainLayout>
  );
}