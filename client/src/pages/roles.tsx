import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MainLayout } from "@/components/layouts/main-layout";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CustomRole, InsertCustomRole, SystemRole, systemRoles } from "@shared/schema";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, MoreVertical, ShieldAlert, ShieldCheck, ShieldX, Lock, Key, FileText, Edit, Trash, Plus, Shield } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// Available permissions for custom roles
const availablePermissions = [
  { id: "domain.read", label: "View Domains" },
  { id: "domain.create", label: "Create Domains" },
  { id: "domain.update", label: "Edit Domains" },
  { id: "domain.delete", label: "Delete Domains" },
  { id: "dnsrecord.read", label: "View DNS Records" },
  { id: "dnsrecord.create", label: "Create DNS Records" },
  { id: "dnsrecord.update", label: "Edit DNS Records" },
  { id: "dnsrecord.delete", label: "Delete DNS Records" },
  { id: "user.read", label: "View Users" },
  { id: "user.create", label: "Create Users" },
  { id: "user.update", label: "Edit Users" },
  { id: "user.delete", label: "Delete Users" },
  { id: "provider.read", label: "View DNS Providers" },
  { id: "provider.create", label: "Add DNS Providers" },
  { id: "provider.update", label: "Edit DNS Providers" },
  { id: "provider.delete", label: "Remove DNS Providers" },
  { id: "webhook.read", label: "View Webhooks" },
  { id: "webhook.create", label: "Create Webhooks" },
  { id: "webhook.update", label: "Edit Webhooks" },
  { id: "webhook.delete", label: "Delete Webhooks" },
  { id: "apitoken.read", label: "View API Tokens" },
  { id: "apitoken.create", label: "Create API Tokens" },
  { id: "apitoken.update", label: "Edit API Tokens" },
  { id: "apitoken.delete", label: "Delete API Tokens" },
  { id: "metrics.read", label: "View Metrics" },
  { id: "history.read", label: "View DNS History" },
  { id: "organization.read", label: "View Organizations" },
  { id: "organization.create", label: "Create Organizations" },
  { id: "organization.update", label: "Edit Organizations" },
  { id: "organization.delete", label: "Delete Organizations" },
  { id: "group.read", label: "View Groups" },
  { id: "group.create", label: "Create Groups" },
  { id: "group.update", label: "Edit Groups" },
  { id: "group.delete", label: "Delete Groups" },
  { id: "role.read", label: "View Roles" },
  { id: "role.create", label: "Create Roles" },
  { id: "role.update", label: "Edit Roles" },
  { id: "role.delete", label: "Delete Roles" },
];

// Group permissions by category
const permissionCategories = [
  {
    id: "domain",
    name: "Domains",
    permissions: availablePermissions.filter(p => p.id.startsWith("domain.")),
  },
  {
    id: "dns",
    name: "DNS Records",
    permissions: availablePermissions.filter(p => p.id.startsWith("dnsrecord.")),
  },
  {
    id: "user",
    name: "Users",
    permissions: availablePermissions.filter(p => p.id.startsWith("user.")),
  },
  {
    id: "provider",
    name: "DNS Providers",
    permissions: availablePermissions.filter(p => p.id.startsWith("provider.")),
  },
  {
    id: "webhook",
    name: "Webhooks",
    permissions: availablePermissions.filter(p => p.id.startsWith("webhook.")),
  },
  {
    id: "apitoken",
    name: "API Tokens",
    permissions: availablePermissions.filter(p => p.id.startsWith("apitoken.")),
  },
  {
    id: "organization",
    name: "Organizations",
    permissions: availablePermissions.filter(p => p.id.startsWith("organization.")),
  },
  {
    id: "group",
    name: "Groups",
    permissions: availablePermissions.filter(p => p.id.startsWith("group.")),
  },
  {
    id: "role",
    name: "Roles",
    permissions: availablePermissions.filter(p => p.id.startsWith("role.")),
  },
  {
    id: "other",
    name: "Other",
    permissions: availablePermissions.filter(p => 
      p.id.startsWith("metrics.") || p.id.startsWith("history.")),
  },
];

// Zod schema for role form
const roleFormSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  description: z.string().optional(),
  permissions: z.array(z.string()).min(1, "Select at least one permission"),
  isActive: z.boolean().default(true),
});

type RoleFormValues = z.infer<typeof roleFormSchema>;

// Role card component for system roles
const SystemRoleCard = ({ roleName }: { roleName: SystemRole }) => {
  const roleInfo = {
    admin: {
      title: "Administrator",
      description: "Full system access with all permissions",
      icon: <ShieldAlert className="w-8 h-8 text-destructive" />,
      color: "bg-destructive/10 text-destructive border-destructive/20",
    },
    manager: {
      title: "Manager",
      description: "Can manage domains and records, but not users or system settings",
      icon: <ShieldCheck className="w-8 h-8 text-warning" />,
      color: "bg-warning/10 text-warning border-warning/20",
    },
    user: {
      title: "User",
      description: "Can manage assigned domains and records",
      icon: <Shield className="w-8 h-8 text-primary" />,
      color: "bg-primary/10 text-primary border-primary/20",
    },
    readonly: {
      title: "Read-only",
      description: "View-only access to assigned domains and records",
      icon: <ShieldX className="w-8 h-8 text-muted-foreground" />,
      color: "bg-muted/10 text-muted-foreground border-muted/20",
    },
  }[roleName];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {roleInfo.icon}
            <div>
              <CardTitle>{roleInfo.title}</CardTitle>
              <CardDescription>System Role</CardDescription>
            </div>
          </div>
          <Badge variant="outline" className={roleInfo.color}>
            {roleName}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{roleInfo.description}</p>

        <div className="mt-3 pt-3 border-t">
          <h4 className="text-sm font-medium mb-2">Permissions</h4>
          {roleName === "admin" ? (
            <div className="flex items-center">
              <ShieldAlert className="w-4 h-4 mr-2 text-destructive" />
              <span className="text-sm">All permissions</span>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1">
              {roleName === "readonly" ? (
                <Badge variant="outline" className="text-xs bg-muted/10">
                  Read-only access
                </Badge>
              ) : roleName === "manager" ? (
                <>
                  <Badge variant="outline" className="text-xs bg-primary/10">
                    Domain management
                  </Badge>
                  <Badge variant="outline" className="text-xs bg-primary/10">
                    DNS record management
                  </Badge>
                  <Badge variant="outline" className="text-xs bg-primary/10">
                    Webhook management
                  </Badge>
                </>
              ) : (
                <>
                  <Badge variant="outline" className="text-xs bg-primary/10">
                    Domain access
                  </Badge>
                  <Badge variant="outline" className="text-xs bg-primary/10">
                    DNS record management
                  </Badge>
                </>
              )}
            </div>
          )}
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
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<CustomRole | null>(null);
  const [activeTab, setActiveTab] = useState("system-roles");

  // Fetch custom roles
  const { data: customRoles = [], isLoading, error } = useQuery<CustomRole[]>({
    queryKey: ["/api/roles/custom"],
    enabled: !!user && user.role === "admin",
  });

  // Create role form
  const createRoleForm = useForm<RoleFormValues>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: {
      name: "",
      description: "",
      permissions: [],
      isActive: true,
    },
  });

  // Edit role form
  const editRoleForm = useForm<RoleFormValues>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: {
      name: "",
      description: "",
      permissions: [],
      isActive: true,
    },
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
      setIsCreateDialogOpen(false);
      createRoleForm.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/roles/custom"] });
      toast({
        title: "Role created",
        description: "The custom role has been created successfully.",
      });
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
    mutationFn: async ({ id, data }: { id: string; data: Partial<RoleFormValues> }) => {
      const res = await apiRequest("PUT", `/api/roles/custom/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      setIsEditDialogOpen(false);
      editRoleForm.reset();
      setSelectedRole(null);
      queryClient.invalidateQueries({ queryKey: ["/api/roles/custom"] });
      toast({
        title: "Role updated",
        description: "The custom role has been updated successfully.",
      });
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
      setIsDeleteDialogOpen(false);
      setSelectedRole(null);
      queryClient.invalidateQueries({ queryKey: ["/api/roles/custom"] });
      toast({
        title: "Role deleted",
        description: "The custom role has been deleted successfully.",
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

  // Handle role edit
  const handleEditRole = (role: CustomRole) => {
    setSelectedRole(role);
    editRoleForm.reset({
      name: role.name,
      description: role.description || "",
      permissions: role.permissions,
      isActive: role.isActive,
    });
    setIsEditDialogOpen(true);
  };

  // Handle role deletion
  const handleDeleteRole = (role: CustomRole) => {
    setSelectedRole(role);
    setIsDeleteDialogOpen(true);
  };

  // Submit handlers
  const onCreateSubmit = (data: RoleFormValues) => {
    createRoleMutation.mutate(data);
  };

  const onEditSubmit = (data: RoleFormValues) => {
    if (selectedRole) {
      updateRoleMutation.mutate({ id: selectedRole.id, data });
    }
  };

  const confirmDeleteRole = () => {
    if (selectedRole) {
      deleteRoleMutation.mutate(selectedRole.id);
    }
  };

  // Check if current user is admin
  if (user?.role !== "admin") {
    return (
      <MainLayout
        title="Roles & Permissions"
        description="Manage roles and their permissions."
      >
        <Card>
          <CardContent className="pt-6 flex flex-col items-center justify-center h-64">
            <Lock className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Access Restricted</h3>
            <p className="text-center text-muted-foreground">
              You don't have permission to access this page. Only administrators can manage roles and permissions.
            </p>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="Roles & Permissions"
      description="Manage roles and their permissions."
    >
      <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">Role Management</h2>
          <p className="text-sm text-muted-foreground">
            Define user roles and their permissions
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Custom Role
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="system-roles">System Roles</TabsTrigger>
          <TabsTrigger value="custom-roles">Custom Roles</TabsTrigger>
        </TabsList>

        {/* System Roles Tab */}
        <TabsContent value="system-roles" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {systemRoles.map((role) => (
              <SystemRoleCard key={role} roleName={role as SystemRole} />
            ))}
          </div>
        </TabsContent>

        {/* Custom Roles Tab */}
        <TabsContent value="custom-roles" className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : customRoles.length === 0 ? (
            <Card>
              <CardContent className="pt-6 flex flex-col items-center justify-center h-64">
                <div className="rounded-full bg-primary/10 p-3 mb-4">
                  <Key className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-medium mb-2">No Custom Roles</h3>
                <p className="text-center text-muted-foreground mb-4 max-w-md">
                  Create custom roles to define specific permissions for users in your organization.
                </p>
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  Create Custom Role
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {customRoles.map((role) => (
                <Card key={role.id} className={!role.isActive ? "opacity-70" : ""}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="bg-primary/10 p-2 rounded-full">
                          <Key className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle>{role.name}</CardTitle>
                          <CardDescription>
                            {role.description || "Custom role"}
                          </CardDescription>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditRole(role)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDeleteRole(role)}
                          >
                            <Trash className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Status</span>
                        <Badge variant={role.isActive ? "default" : "secondary"}>
                          {role.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Created</span>
                        <span>
                          {formatDistanceToNow(new Date(role.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>

                    <div className="border-t pt-3">
                      <h4 className="text-sm font-medium mb-2">Permissions ({role.permissions.length})</h4>
                      <div className="flex flex-wrap gap-1">
                        {role.permissions.slice(0, 5).map((permission) => (
                          <Badge
                            key={permission}
                            variant="outline"
                            className="text-xs bg-primary/10"
                          >
                            {permission}
                          </Badge>
                        ))}
                        {role.permissions.length > 5 && (
                          <Badge variant="outline" className="text-xs">
                            +{role.permissions.length - 5} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Role Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Create Custom Role</DialogTitle>
            <DialogDescription>
              Define a new role with custom permissions.
            </DialogDescription>
          </DialogHeader>

          <Form {...createRoleForm}>
            <form onSubmit={createRoleForm.handleSubmit(onCreateSubmit)} className="space-y-6">
              <div className="space-y-4">
                <FormField
                  control={createRoleForm.control}
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
                  control={createRoleForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe the purpose of this role"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createRoleForm.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Active</FormLabel>
                        <FormDescription>
                          This role will be available for assignment to users.
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={createRoleForm.control}
                  name="permissions"
                  render={() => (
                    <FormItem>
                      <div className="mb-4">
                        <FormLabel>Permissions</FormLabel>
                        <FormDescription>
                          Select the permissions for this role
                        </FormDescription>
                      </div>
                      <div className="space-y-5">
                        {permissionCategories.map((category) => (
                          <div key={category.id} className="space-y-3">
                            <h4 className="text-sm font-medium">{category.name}</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {category.permissions.map((permission) => (
                                <FormField
                                  key={permission.id}
                                  control={createRoleForm.control}
                                  name="permissions"
                                  render={({ field }) => (
                                    <FormItem
                                      key={permission.id}
                                      className="flex flex-row items-start space-x-3 space-y-0"
                                    >
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value?.includes(permission.id)}
                                          onCheckedChange={(checked) => {
                                            const currentValue = field.value || [];
                                            return checked
                                              ? field.onChange([...currentValue, permission.id])
                                              : field.onChange(
                                                  currentValue.filter(
                                                    (value) => value !== permission.id
                                                  )
                                                );
                                          }}
                                        />
                                      </FormControl>
                                      <FormLabel className="font-normal cursor-pointer">
                                        {permission.label}
                                      </FormLabel>
                                    </FormItem>
                                  )}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
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
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
            <DialogDescription>
              Update role details and permissions.
            </DialogDescription>
          </DialogHeader>

          <Form {...editRoleForm}>
            <form onSubmit={editRoleForm.handleSubmit(onEditSubmit)} className="space-y-6">
              <div className="space-y-4">
                <FormField
                  control={editRoleForm.control}
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
                  control={editRoleForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe the purpose of this role"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editRoleForm.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Active</FormLabel>
                        <FormDescription>
                          This role will be available for assignment to users.
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={editRoleForm.control}
                  name="permissions"
                  render={() => (
                    <FormItem>
                      <div className="mb-4">
                        <FormLabel>Permissions</FormLabel>
                        <FormDescription>
                          Select the permissions for this role
                        </FormDescription>
                      </div>
                      <div className="space-y-5">
                        {permissionCategories.map((category) => (
                          <div key={category.id} className="space-y-3">
                            <h4 className="text-sm font-medium">{category.name}</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {category.permissions.map((permission) => (
                                <FormField
                                  key={permission.id}
                                  control={editRoleForm.control}
                                  name="permissions"
                                  render={({ field }) => (
                                    <FormItem
                                      key={permission.id}
                                      className="flex flex-row items-start space-x-3 space-y-0"
                                    >
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value?.includes(permission.id)}
                                          onCheckedChange={(checked) => {
                                            const currentValue = field.value || [];
                                            return checked
                                              ? field.onChange([...currentValue, permission.id])
                                              : field.onChange(
                                                  currentValue.filter(
                                                    (value) => value !== permission.id
                                                  )
                                                );
                                          }}
                                        />
                                      </FormControl>
                                      <FormLabel className="font-normal cursor-pointer">
                                        {permission.label}
                                      </FormLabel>
                                    </FormItem>
                                  )}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateRoleMutation.isPending}
                >
                  {updateRoleMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Update Role
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Role Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the "{selectedRole?.name}" role?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteRole}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteRoleMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash className="mr-2 h-4 w-4" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}