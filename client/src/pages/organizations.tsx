import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MainLayout } from '@/components/layouts/main-layout';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Customer } from '@shared/schema';
import { useCustomer } from '@/context/customer-context';
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

export default function CustomersPage() {
  const { user } = useAuth();
  const { 
    customers, 
    currentCustomer, 
    setCurrentCustomer, 
    createCustomerMutation,
    updateCustomerMutation,
    deleteCustomerMutation,
    domainsByCustomer
  } = useCustomer();
  const { toast } = useToast();
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerActive, setNewCustomerActive] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editCustomerActive, setEditCustomerActive] = useState(true);
  
  const isAdmin = user?.role === 'admin';
  
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerName.trim()) {
      toast({
        title: 'Error',
        description: 'Customer name cannot be empty',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      await createCustomerMutation.mutateAsync({
        name: newCustomerName,
        isActive: newCustomerActive,
      });
      
      setNewCustomerName('');
      setNewCustomerActive(true);
      setIsDialogOpen(false);
      
      toast({
        title: 'Success',
        description: 'Customer created successfully',
      });
    } catch (error) {
      console.error('Error creating customer:', error);
      toast({
        title: 'Error',
        description: 'Failed to create customer',
        variant: 'destructive',
      });
    }
  };
  
  return (
    <MainLayout 
      title="Customers" 
      description="Manage your customers and their settings."
    >
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Customers</h2>
        {isAdmin && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Customer
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Customer</DialogTitle>
                <DialogDescription>
                  Add a new customer to your account.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateCustomer}>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="customerName">Customer Name</Label>
                    <Input
                      id="customerName"
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                      placeholder="Enter customer name"
                      required
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="isActive"
                      checked={newCustomerActive}
                      onCheckedChange={(checked) => setNewCustomerActive(checked as boolean)}
                    />
                    <Label htmlFor="isActive">Active</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={createCustomerMutation.isPending}
                  >
                    {createCustomerMutation.isPending ? 'Creating...' : 'Create Customer'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {customers.map((customer) => (
          <Card 
            key={customer.id} 
            className={cn(
              'cursor-pointer transition-all hover:shadow-md',
              currentCustomer?.id === customer.id && 'border-primary'
            )}
            onClick={() => setCurrentCustomer(customer)}
          >
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="flex items-center">
                  <div className="p-2 rounded-full bg-primary/10 mr-3">
                    <Building className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg mb-1">{customer.name}</CardTitle>
                    <CardDescription>
                      {customer.isActive ? 'Active' : 'Inactive'}
                    </CardDescription>
                  </div>
                </div>
                {currentCustomer?.id === customer.id && (
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary">
                    <Users className="h-3.5 w-3.5 text-primary-foreground" />
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="pb-3">
              <p className="text-sm text-muted-foreground">
                Created on {new Date(customer.createdAt).toLocaleDateString()}
              </p>
            </CardContent>
            <CardFooter className="flex justify-between pt-2">
              <Button 
                variant="ghost" 
                size="sm"
                className="text-muted-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedCustomer(customer);
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
                      setSelectedCustomer(customer);
                      setEditCustomerName(customer.name);
                      setEditCustomerActive(customer.isActive);
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
                      setSelectedCustomer(customer);
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

      {customers.length === 0 && (
        <Card className="border-dashed p-8">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <Building className="w-10 h-10 text-muted-foreground" />
            <div>
              <h3 className="text-lg font-medium">No Customers</h3>
              <p className="text-sm text-muted-foreground">
                You don't have any customers yet. Create one to get started.
              </p>
            </div>
            {isAdmin && (
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Customer
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* View Customer Dialog */}
      <AlertDialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Customer Details</AlertDialogTitle>
            <AlertDialogDescription>
              View details for this customer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            {selectedCustomer && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium mb-1">Name</h4>
                    <p className="text-sm">{selectedCustomer.name}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-1">Status</h4>
                    <p className="text-sm">
                      {selectedCustomer.isActive ? (
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
                  <p className="text-sm">{new Date(selectedCustomer.createdAt).toLocaleDateString()}</p>
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-1">Domains</h4>
                  {/* Check if domain data is available for this customer */}
                  {selectedCustomer.id in (domainsByCustomer || {}) && domainsByCustomer[selectedCustomer.id]?.length > 0 ? (
                    <ul className="text-sm space-y-1 list-disc list-inside">
                      {domainsByCustomer[selectedCustomer.id]?.map(domain => (
                        <li key={domain.id}>{domain.name}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No domains associated with this customer.</p>
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

      {/* Edit Customer Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
            <DialogDescription>
              Make changes to the customer details.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (!editCustomerName.trim()) {
              toast({
                title: 'Error',
                description: 'Customer name cannot be empty',
                variant: 'destructive',
              });
              return;
            }
            
            if (selectedCustomer) {
              // Use the updateCustomerMutation from context
              updateCustomerMutation.mutate({
                id: selectedCustomer.id,
                data: {
                  name: editCustomerName,
                  isActive: editCustomerActive,
                }
              });
              
              setIsEditDialogOpen(false);
            }
          }}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="editCustomerName">Customer Name</Label>
                <Input
                  id="editCustomerName"
                  value={editCustomerName}
                  onChange={(e) => setEditCustomerName(e.target.value)}
                  placeholder="Enter customer name"
                  required
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="editIsActive"
                  checked={editCustomerActive}
                  onCheckedChange={(checked) => setEditCustomerActive(checked as boolean)}
                />
                <Label htmlFor="editIsActive">Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="submit"
                disabled={updateCustomerMutation.isPending}
              >
                {updateCustomerMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Customer Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the customer 
              {selectedCustomer && <strong> "{selectedCustomer.name}"</strong>} and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              disabled={deleteCustomerMutation.isPending}
              onClick={() => {
                if (selectedCustomer) {
                  deleteCustomerMutation.mutate(selectedCustomer.id);
                  setIsDeleteDialogOpen(false);
                }
              }}
            >
              {deleteCustomerMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}