import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { SystemRole, systemRoles, CustomRole } from "@shared/schema";

// UI Components
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Loader2, PlusCircle, Edit, Trash2, ShieldAlert, ShieldCheck } from "lucide-react";

// Available permissions
const availablePermissions = [
  { id: "domains.view", label: "View Domains" },
  { id: "domains.create", label: "Create Domains" },
  { id: "domains.edit", label: "Edit Domains" },
  { id: "domains.delete", label: "Delete Domains" },
  { id: "records.view", label: "View DNS Records" },
  { id: "records.create", label: "Create DNS Records" },
  { id: "records.edit", label: "Edit DNS Records" },
  { id: "records.delete", label: "Delete DNS Records" },
  { id: "providers.view", label: "View Providers" },
  { id: "providers.create", label: "Create Providers" },
  { id: "providers.edit", label: "Edit Providers" },
  { id: "providers.delete", label: "Delete Providers" },
  { id: "webhooks.view", label: "View Webhooks" },
  { id: "webhooks.create", label: "Create Webhooks" },
  { id: "webhooks.edit", label: "Edit Webhooks" },
  { id: "webhooks.delete", label: "Delete Webhooks" },
  { id: "api-tokens.view", label: "View API Tokens" },
  { id: "api-tokens.create", label: "Create API Tokens" },
  { id: "api-tokens.edit", label: "Edit API Tokens" },
  { id: "api-tokens.delete", label: "Delete API Tokens" },
  { id: "organizations.view", label: "View Organizations" },
  { id: "organizations.create", label: "Create Organizations" },
  { id: "organizations.edit", label: "Edit Organizations" },
  { id: "organizations.delete", label: "Delete Organizations" },
  { id: "users.view", label: "View Users" },
  { id: "users.create", label: "Create Users" },
  { id: "users.edit", label: "Edit Users" },
  { id: "users.delete", label: "Delete Users" },
  { id: "roles.view", label: "View Roles" },
  { id: "roles.create", label: "Create Roles" },
  { id: "roles.edit", label: "Edit Roles" },
  { id: "roles.delete", label: "Delete Roles" },
  { id: "metrics.view", label: "View Metrics" },
  { id: "history.view", label: "View History" },
];

// Default permissions for system roles
const systemRolePermissions: Record<SystemRole, string[]> = {
  admin: availablePermissions.map(p => p.id),
  manager: [
    "domains.view", "domains.create", "domains.edit", "domains.delete",
    "records.view", "records.create", "records.edit", "records.delete",
    "webhooks.view", "webhooks.create", "webhooks.edit", "webhooks.delete",
    "api-tokens.view", "api-tokens.create", "api-tokens.edit", "api-tokens.delete",
    "metrics.view", "history.view",
  ],
  user: [
    "domains.view", 
    "records.view", "records.create", "records.edit",
    "webhooks.view",
    "api-tokens.view",
    "metrics.view", "history.view",
  ],
  readonly: [
    "domains.view",
    "records.view",
    "webhooks.view",
    "api-tokens.view",
    "metrics.view", "history.view",
  ],
};

// Form validation schema
const roleFormSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters").max(50, "Name cannot exceed 50 characters"),
  description: z.string().max(255, "Description cannot exceed 255 characters").optional(),
  permissions: z.array(z.string()).min(1, "Select at least one permission"),
});

type RoleFormValues = z.infer<typeof roleFormSchema>;

// System role card component
const SystemRoleCard = ({ roleName }: { roleName: SystemRole }) => {
  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-primary" />
          {roleName.charAt(0).toUpperCase() + roleName.slice(1)}
          <Badge variant="outline" className="ml-2">System</Badge>
        </CardTitle>
        <CardDescription>
          {roleName === "admin" && "Full access to all system features and settings"}
          {roleName === "manager" && "Manage domains, records, and access to organizational resources"}
          {roleName === "user" && "Standard user with ability to view and modify specific resources"}
          {roleName === "readonly" && "View-only access to resources without modification permissions"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {systemRolePermissions[roleName].map((permission) => (
            <Badge key={permission} variant="secondary" className="mb-1">
              {availablePermissions.find(p => p.id === permission)?.label || permission}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default function RolesPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentRole, setCurrentRole] = useState<CustomRole | null>(null);

  const isAdmin = user?.role === "admin";

  // Fetch custom roles
  const { data: customRoles, isLoading } = useQuery({
    queryKey: ["/api/roles/custom"],
    enabled: isAdmin,
  });

  // Create role mutation
  const createRoleMutation = useMutation({
    mutationFn: async (data: RoleFormValues) => {
      const res = await apiRequest("POST", "/api/roles/custom", {
        ...data,
        createdBy: user?.id,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles/custom"] });
      toast({
        title: "Role created",
        description: "The role has been created successfully.",
      });
      setIsCreateDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating role",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async (data: { id: string; values: Partial<RoleFormValues> }) => {
      const res = await apiRequest("PUT", `/api/roles/custom/${data.id}`, data.values);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles/custom"] });
      toast({
        title: "Role updated",
        description: "The role has been updated successfully.",
      });
      setIsEditDialogOpen(false);
      setCurrentRole(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating role",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete role mutation
  const deleteRoleMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/roles/custom/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles/custom"] });
      toast({
        title: "Role deleted",
        description: "The role has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting role",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Setup forms
  const createForm = useForm<RoleFormValues>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: {
      name: "",
      description: "",
      permissions: [],
    },
  });

  const editForm = useForm<RoleFormValues>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: {
      name: "",
      description: "",
      permissions: [],
    },
  });

  const handleEditRole = (role: CustomRole) => {
    setCurrentRole(role);
    editForm.reset({
      name: role.name,
      description: role.description || "",
      permissions: role.permissions,
    });
    setIsEditDialogOpen(true);
  };

  const handleDeleteRole = (role: CustomRole) => {
    if (confirm(`Are you sure you want to delete the role "${role.name}"?`)) {
      deleteRoleMutation.mutate(role.id);
    }
  };

  const onCreateSubmit = (data: RoleFormValues) => {
    createRoleMutation.mutate(data);
  };

  const onEditSubmit = (data: RoleFormValues) => {
    if (currentRole) {
      updateRoleMutation.mutate({
        id: currentRole.id,
        values: data,
      });
    }
  };

  if (!isAdmin) {
    return (
      <div className="container mx-auto py-6">
        <h1 className="text-3xl font-bold mb-6">Role Management</h1>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-4 mb-6">
          <p className="text-yellow-800 dark:text-yellow-300">
            You don't have permission to access this page. Admin privileges required.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Role Management</h1>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <PlusCircle className="h-4 w-4 mr-2" />
          Create Role
        </Button>
      </div>

      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-4">System Roles</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {systemRoles.map((role) => (
              <SystemRoleCard key={role} roleName={role} />
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Custom Roles</h2>
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !customRoles || customRoles.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                No custom roles available. Create one using the "Create Role" button.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {customRoles.map((role: CustomRole) => (
                <Card key={role.id} className="mb-4">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <ShieldCheck className="h-5 w-5 text-primary" />
                          {role.name}
                          <Badge variant="secondary" className="ml-2">Custom</Badge>
                        </CardTitle>
                        {role.description && (
                          <CardDescription>{role.description}</CardDescription>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEditRole(role)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteRole(role)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {role.permissions.map((permission) => (
                        <Badge key={permission} variant="secondary" className="mb-1">
                          {availablePermissions.find(p => p.id === permission)?.label || permission}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Role Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Create New Role</DialogTitle>
            <DialogDescription>
              Define a new custom role with specific permissions.
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-6">
              <FormField
                control={createForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter role name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter role description"
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="permissions"
                render={() => (
                  <FormItem>
                    <div className="mb-4">
                      <FormLabel>Permissions</FormLabel>
                      <FormDescription>
                        Select the permissions for this role
                      </FormDescription>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto p-2">
                      {availablePermissions.map((permission) => (
                        <FormItem
                          key={permission.id}
                          className="flex flex-row items-start space-x-3 space-y-0"
                        >
                          <FormControl>
                            <Checkbox
                              checked={createForm.watch("permissions").includes(permission.id)}
                              onCheckedChange={(checked) => {
                                const currentPermissions = createForm.getValues("permissions");
                                if (checked) {
                                  createForm.setValue("permissions", [
                                    ...currentPermissions,
                                    permission.id,
                                  ]);
                                } else {
                                  createForm.setValue(
                                    "permissions",
                                    currentPermissions.filter((p) => p !== permission.id)
                                  );
                                }
                              }}
                            />
                          </FormControl>
                          <FormLabel className="font-normal cursor-pointer">
                            {permission.label}
                          </FormLabel>
                        </FormItem>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button 
                  type="submit" 
                  disabled={createRoleMutation.isPending}
                >
                  {createRoleMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Create Role
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
            <DialogDescription>
              Modify the role's details and permissions.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-6">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter role name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter role description"
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="permissions"
                render={() => (
                  <FormItem>
                    <div className="mb-4">
                      <FormLabel>Permissions</FormLabel>
                      <FormDescription>
                        Select the permissions for this role
                      </FormDescription>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto p-2">
                      {availablePermissions.map((permission) => (
                        <FormItem
                          key={permission.id}
                          className="flex flex-row items-start space-x-3 space-y-0"
                        >
                          <FormControl>
                            <Checkbox
                              checked={editForm.watch("permissions").includes(permission.id)}
                              onCheckedChange={(checked) => {
                                const currentPermissions = editForm.getValues("permissions");
                                if (checked) {
                                  editForm.setValue("permissions", [
                                    ...currentPermissions,
                                    permission.id,
                                  ]);
                                } else {
                                  editForm.setValue(
                                    "permissions",
                                    currentPermissions.filter((p) => p !== permission.id)
                                  );
                                }
                              }}
                            />
                          </FormControl>
                          <FormLabel className="font-normal cursor-pointer">
                            {permission.label}
                          </FormLabel>
                        </FormItem>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button 
                  type="submit" 
                  disabled={updateRoleMutation.isPending}
                >
                  {updateRoleMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}