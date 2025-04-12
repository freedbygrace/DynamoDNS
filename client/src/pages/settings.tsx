import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MainLayout } from "@/components/layouts/main-layout";
import { Customer, InsertCustomer } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { useCustomer } from "@/context/customer-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/hooks/use-theme";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Loader2, Moon, Sun, Lock, Laptop } from "lucide-react";

// Customer form schema
const customerFormSchema = z.object({
  name: z.string().min(1, "Customer name is required"),
  description: z.string().optional(),
  email: z.string().email("Please enter a valid email").optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  city: z.string().optional().or(z.literal('')),
  state: z.string().optional().or(z.literal('')),
  zipCode: z.string().optional().or(z.literal('')),
  country: z.string().optional().or(z.literal('')),
  website: z.string().url("Please enter a valid URL").optional().or(z.literal('')),
  industry: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  accountManager: z.string().optional().or(z.literal('')),
  billingEmail: z.string().email("Please enter a valid email").optional().or(z.literal('')),
  billingAddress: z.string().optional().or(z.literal('')),
  isActive: z.boolean().default(true),
});

// Create customer form schema
const createCustomerFormSchema = z.object({
  name: z.string().min(1, "Customer name is required"),
  description: z.string().optional(),
  email: z.string().email("Please enter a valid email").optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  city: z.string().optional().or(z.literal('')),
  state: z.string().optional().or(z.literal('')),
  zipCode: z.string().optional().or(z.literal('')),
  country: z.string().optional().or(z.literal('')),
  website: z.string().url("Please enter a valid URL").optional().or(z.literal('')),
  industry: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  accountManager: z.string().optional().or(z.literal('')),
  billingEmail: z.string().email("Please enter a valid email").optional().or(z.literal('')),
  billingAddress: z.string().optional().or(z.literal('')),
  isActive: z.boolean().default(true),
});

// Account form schema
const accountFormSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Please enter a valid email"),
  fullName: z.string().optional(),
});

// Password form schema
const passwordFormSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
  confirmPassword: z.string().min(8, "Please confirm your new password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export default function SettingsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { currentCustomer, setCurrentCustomer, createCustomerMutation } = useCustomer();
  
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  // Create customer form
  const createCustomerForm = useForm<z.infer<typeof createCustomerFormSchema>>({
    resolver: zodResolver(createCustomerFormSchema),
    defaultValues: {
      name: "",
      description: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      country: "",
      website: "",
      industry: "",
      notes: "",
      accountManager: "",
      billingEmail: "",
      billingAddress: "",
      isActive: true,
    },
  });
  
  // Fetch customer data
  const { data: customer } = useQuery<Customer>({
    queryKey: ["/api/customers", currentCustomer?.id],
    enabled: !!currentCustomer?.id,
  });

  // Customer form
  const customerForm = useForm<z.infer<typeof customerFormSchema>>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      name: currentCustomer?.name || "",
      isActive: currentCustomer?.isActive,
    },
  });

  // Account form
  const accountForm = useForm<z.infer<typeof accountFormSchema>>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      username: user?.username || "",
      email: user?.email || "",
      fullName: user?.fullName || "",
    },
  });

  // Password form
  const passwordForm = useForm<z.infer<typeof passwordFormSchema>>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Update customer details when they change
  useState(() => {
    if (currentCustomer) {
      customerForm.reset({
        name: currentCustomer.name,
        isActive: currentCustomer.isActive,
      });
    }
  });

  // Update customer mutation
  const updateCustomerMutation = useMutation({
    mutationFn: async (data: z.infer<typeof customerFormSchema>) => {
      if (!currentCustomer) throw new Error("No customer selected");
      
      const res = await apiRequest("PUT", `/api/customers/${currentCustomer.id}`, data);
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers", currentCustomer?.id] });
      
      // Update the current customer in context
      if (currentCustomer) {
        setCurrentCustomer({
          ...currentCustomer,
          ...data,
        });
      }
      
      toast({
        title: "Customer updated",
        description: "The customer details have been updated successfully.",
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

  // Update account mutation
  const updateAccountMutation = useMutation({
    mutationFn: async (data: z.infer<typeof accountFormSchema>) => {
      if (!user) throw new Error("Not authenticated");
      
      const res = await apiRequest("PUT", `/api/users/${user.id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      
      toast({
        title: "Account updated",
        description: "Your account details have been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update account",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (data: z.infer<typeof passwordFormSchema>) => {
      if (!user) throw new Error("Not authenticated");
      
      const res = await apiRequest("POST", "/api/change-password", {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      return await res.json();
    },
    onSuccess: () => {
      passwordForm.reset();
      
      toast({
        title: "Password changed",
        description: "Your password has been changed successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to change password",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete customer mutation
  const deleteCustomerMutation = useMutation({
    mutationFn: async () => {
      if (!currentCustomer) throw new Error("No customer selected");
      
      await apiRequest("DELETE", `/api/customers/${currentCustomer.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      setIsDeleteDialogOpen(false);
      
      toast({
        title: "Customer deleted",
        description: "The customer has been deleted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete customer",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Form submission handlers
  const onCustomerSubmit = (data: z.infer<typeof customerFormSchema>) => {
    updateCustomerMutation.mutate(data);
  };

  const onAccountSubmit = (data: z.infer<typeof accountFormSchema>) => {
    updateAccountMutation.mutate(data);
  };

  const onPasswordSubmit = (data: z.infer<typeof passwordFormSchema>) => {
    changePasswordMutation.mutate(data);
  };

  // Check if current user has admin/manager permission
  const hasManagePermission = user?.role === "admin" || user?.role === "manager";

  return (
    <MainLayout
      title="Settings"
      description="Manage your account and organization settings."
    >
      <Tabs defaultValue="account" className="space-y-6">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="customer">Customer</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
        </TabsList>
        
        {/* Account Settings */}
        <TabsContent value="account" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>
                Update your personal account details.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...accountForm}>
                <form onSubmit={accountForm.handleSubmit(onAccountSubmit)} className="space-y-4">
                  <FormField
                    control={accountForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={accountForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={accountForm.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} />
                        </FormControl>
                        <FormDescription>
                          Your full name for display purposes
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <Button 
                    type="submit" 
                    disabled={updateAccountMutation.isPending}
                  >
                    {updateAccountMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>
                Update your account password.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...passwordForm}>
                <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                  <FormField
                    control={passwordForm.control}
                    name="currentPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current Password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={passwordForm.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormDescription>
                          Must be at least 8 characters long
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={passwordForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm New Password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <Button 
                    type="submit" 
                    disabled={changePasswordMutation.isPending}
                  >
                    {changePasswordMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Changing Password...
                      </>
                    ) : (
                      "Change Password"
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Customer Settings */}
        <TabsContent value="customer" className="space-y-6">
          {!hasManagePermission ? (
            <Card>
              <CardContent className="pt-6 flex flex-col items-center justify-center h-64">
                <Lock className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Access Restricted</h3>
                <p className="text-center text-muted-foreground">
                  You don't have permission to modify customer settings. Only administrators and managers can manage customers.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {user?.role === "admin" && (
                <Card>
                  <CardHeader>
                    <CardTitle>Create New Customer</CardTitle>
                    <CardDescription>
                      Add a new customer to your account
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...createCustomerForm}>
                      <form 
                        onSubmit={createCustomerForm.handleSubmit((data) => {
                          createCustomerMutation.mutate(data);
                          createCustomerForm.reset();
                        })} 
                        className="space-y-4"
                      >
                        <FormField
                          control={createCustomerForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Customer Name*</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Enter customer name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={createCustomerForm.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Description</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Brief description of the customer" />
                              </FormControl>
                              <FormDescription>
                                A brief description of the customer's business
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={createCustomerForm.control}
                            name="email"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Email</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="contact@example.com" type="email" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={createCustomerForm.control}
                            name="phone"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Phone</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="+1 (555) 123-4567" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <FormField
                          control={createCustomerForm.control}
                          name="website"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Website</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="https://example.com" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={createCustomerForm.control}
                          name="industry"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Industry</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Technology, Healthcare, etc." />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <div className="space-y-1">
                          <h4 className="text-sm font-medium">Address Information</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={createCustomerForm.control}
                              name="address"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Address</FormLabel>
                                  <FormControl>
                                    <Input {...field} placeholder="123 Main Street" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={createCustomerForm.control}
                              name="city"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>City</FormLabel>
                                  <FormControl>
                                    <Input {...field} placeholder="San Francisco" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={createCustomerForm.control}
                              name="state"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>State/Province</FormLabel>
                                  <FormControl>
                                    <Input {...field} placeholder="CA" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={createCustomerForm.control}
                              name="zipCode"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>ZIP/Postal Code</FormLabel>
                                  <FormControl>
                                    <Input {...field} placeholder="94105" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={createCustomerForm.control}
                              name="country"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Country</FormLabel>
                                  <FormControl>
                                    <Input {...field} placeholder="United States" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          <h4 className="text-sm font-medium">Billing Information</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={createCustomerForm.control}
                              name="billingEmail"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Billing Email</FormLabel>
                                  <FormControl>
                                    <Input {...field} placeholder="billing@example.com" type="email" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={createCustomerForm.control}
                              name="billingAddress"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Billing Address</FormLabel>
                                  <FormControl>
                                    <Input {...field} placeholder="Same as main address or enter different address" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                        
                        <FormField
                          control={createCustomerForm.control}
                          name="accountManager"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Account Manager</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Name of assigned account manager" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={createCustomerForm.control}
                          name="notes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Notes</FormLabel>
                              <FormControl>
                                <Textarea {...field} placeholder="Additional notes about this customer" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={createCustomerForm.control}
                          name="isActive"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">Active Status</FormLabel>
                                <FormDescription>
                                  Enable this customer upon creation
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        
                        <Button 
                          type="submit" 
                          disabled={createCustomerMutation.isPending}
                        >
                          {createCustomerMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Creating...
                            </>
                          ) : (
                            "Create Customer"
                          )}
                        </Button>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              )}
            
              <Card>
                <CardHeader>
                  <CardTitle>Customer Details</CardTitle>
                  <CardDescription>
                    Manage your customer information.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...customerForm}>
                    <form onSubmit={customerForm.handleSubmit(onCustomerSubmit)} className="space-y-4">
                      <FormField
                        control={customerForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Customer Name</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={customerForm.control}
                        name="isActive"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Active Status</FormLabel>
                              <FormDescription>
                                Enable or disable this customer
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      
                      <Button 
                        type="submit" 
                        disabled={updateCustomerMutation.isPending}
                      >
                        {updateCustomerMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          "Save Changes"
                        )}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
              
              {user?.role === "admin" && (
                <Card className="border-destructive">
                  <CardHeader>
                    <CardTitle>Danger Zone</CardTitle>
                    <CardDescription>
                      Irreversible actions for your customer
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="rounded-lg border border-destructive p-4">
                        <div className="flex flex-row items-center justify-between">
                          <div>
                            <h4 className="font-medium">Delete Customer</h4>
                            <p className="text-sm text-muted-foreground">
                              Permanently delete this customer and all associated data
                            </p>
                          </div>
                          <Button 
                            variant="destructive" 
                            onClick={() => setIsDeleteDialogOpen(true)}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
        
        {/* Appearance Settings */}
        <TabsContent value="appearance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>
                Customize the application appearance and theme.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-lg font-medium">Theme</h3>
                <p className="text-sm text-muted-foreground">
                  Select your preferred theme appearance
                </p>
                <div className="grid grid-cols-3 gap-4 pt-2">
                  <div
                    className={`flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer ${
                      theme === "light" ? "border-primary" : ""
                    }`}
                    onClick={() => setTheme("light")}
                  >
                    <Sun className="h-6 w-6 mb-3" />
                    <div className="space-y-1 text-center">
                      <h3 className="font-medium">Light</h3>
                      <p className="text-xs text-muted-foreground">Light background with dark text</p>
                    </div>
                  </div>
                  <div
                    className={`flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer ${
                      theme === "dark" ? "border-primary" : ""
                    }`}
                    onClick={() => setTheme("dark")}
                  >
                    <Moon className="h-6 w-6 mb-3" />
                    <div className="space-y-1 text-center">
                      <h3 className="font-medium">Dark</h3>
                      <p className="text-xs text-muted-foreground">Dark background with light text</p>
                    </div>
                  </div>
                  <div
                    className={`flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer ${
                      theme === "system" ? "border-primary" : ""
                    }`}
                    onClick={() => setTheme("system")}
                  >
                    <Laptop className="h-6 w-6 mb-3" />
                    <div className="space-y-1 text-center">
                      <h3 className="font-medium">System</h3>
                      <p className="text-xs text-muted-foreground">Follow your system preference</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Customer Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the customer <strong>{currentCustomer?.name}</strong>?
              This action cannot be undone. All domains, DNS records, and related data will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteCustomerMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteCustomerMutation.isPending}
            >
              {deleteCustomerMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Customer"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
