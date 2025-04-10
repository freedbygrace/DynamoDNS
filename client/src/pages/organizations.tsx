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
import { Users, Plus, Edit, Trash2, Building, Calendar, Clock, Info, AlertCircle } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';

export default function OrganizationsPage() {
  const { user } = useAuth();
  const { 
    organizations, 
    currentOrganization, 
    setCurrentOrganization, 
    createOrganizationMutation,
    updateOrganizationMutation,
    deleteOrganizationMutation,
    domainsByOrganization
  } = useOrganization();
  const { toast } = useToast();
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgActive, setNewOrgActive] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [editOrgName, setEditOrgName] = useState('');
  const [editOrgActive, setEditOrgActive] = useState(true);
  
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
                  setSelectedOrg(org);
                  setIsViewDialogOpen(true);
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
                      setSelectedOrg(org);
                      setEditOrgName(org.name);
                      setEditOrgActive(org.isActive);
                      setIsEditDialogOpen(true);
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
                      setSelectedOrg(org);
                      setIsDeleteDialogOpen(true);
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

      {/* View Organization Dialog */}
      <AlertDialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Organization Details</AlertDialogTitle>
            <AlertDialogDescription>
              View details for this organization.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            {selectedOrg && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium mb-1">Name</h4>
                    <p className="text-sm">{selectedOrg.name}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-1">Status</h4>
                    <p className="text-sm">
                      {selectedOrg.isActive ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 hover:bg-green-50 hover:text-green-700">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-50 text-red-700 hover:bg-red-50 hover:text-red-700">
                          Inactive
                        </Badge>
                      )}
                    </p>
                  </div>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium mb-1">Created</h4>
                  <p className="text-sm">{new Date(selectedOrg.createdAt).toLocaleDateString()}</p>
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-1">Domains</h4>
                  {/* Check if domain data is available for this org */}
                  {selectedOrg.id in (domainsByOrganization || {}) && domainsByOrganization[selectedOrg.id]?.length > 0 ? (
                    <ul className="text-sm space-y-1 list-disc list-inside">
                      {domainsByOrganization[selectedOrg.id]?.map(domain => (
                        <li key={domain.id}>{domain.name}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No domains associated with this organization.</p>
                  )}
                </div>
              </>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Organization Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Organization</DialogTitle>
            <DialogDescription>
              Make changes to the organization details.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (!editOrgName.trim()) {
              toast({
                title: 'Error',
                description: 'Organization name cannot be empty',
                variant: 'destructive',
              });
              return;
            }
            
            if (selectedOrg) {
              // Use the updateOrganizationMutation from context
              updateOrganizationMutation.mutate({
                id: selectedOrg.id,
                data: {
                  name: editOrgName,
                  isActive: editOrgActive,
                }
              });
              
              setIsEditDialogOpen(false);
            }
          }}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="editOrgName">Organization Name</Label>
                <Input
                  id="editOrgName"
                  value={editOrgName}
                  onChange={(e) => setEditOrgName(e.target.value)}
                  placeholder="Enter organization name"
                  required
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="editIsActive"
                  checked={editOrgActive}
                  onCheckedChange={(checked) => setEditOrgActive(checked as boolean)}
                />
                <Label htmlFor="editIsActive">Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="submit"
                disabled={updateOrganizationMutation.isPending}
              >
                {updateOrganizationMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Organization Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the organization 
              {selectedOrg && <strong> "{selectedOrg.name}"</strong>} and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              disabled={deleteOrganizationMutation.isPending}
              onClick={() => {
                if (selectedOrg) {
                  deleteOrganizationMutation.mutate(selectedOrg.id);
                  setIsDeleteDialogOpen(false);
                }
              }}
            >
              {deleteOrganizationMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}