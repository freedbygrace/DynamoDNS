import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MainLayout } from "@/components/layouts/main-layout";
import { ApiToken, InsertApiToken, systemRoles, CustomRole } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { useOrganization } from "@/context/organization-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Key, MoreVertical, Calendar, Copy, Info } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

// Token form schema
const tokenFormSchema = z.object({
  name: z.string().min(1, "Token name is required"),
  role: z.string().min(1, "Role is required"),
  expiresIn: z.string().optional(),
});

export default function ApiTokensPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  
  const [isAddTokenDialogOpen, setIsAddTokenDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState<ApiToken | null>(null);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [showTokenDialog, setShowTokenDialog] = useState(false);
  
  // Fetch API tokens
  const { data: tokens = [], isLoading } = useQuery<ApiToken[]>({
    queryKey: ["/api/api-tokens", currentOrganization?.id],
    enabled: !!currentOrganization?.id,
  });
  
  // Fetch custom roles
  const { data: customRoles = [] } = useQuery<CustomRole[]>({
    queryKey: ["/api/roles/custom"],
  });

  // Form for adding a token
  const form = useForm<z.infer<typeof tokenFormSchema>>({
    resolver: zodResolver(tokenFormSchema),
    defaultValues: {
      name: "",
      role: "readonly",
      expiresIn: "never",
    },
  });

  // Add token mutation
  const addTokenMutation = useMutation({
    mutationFn: async (data: z.infer<typeof tokenFormSchema>) => {
      const tokenData: Partial<InsertApiToken> = {
        name: data.name,
        organizationId: currentOrganization?.id || "",
        role: data.role,
        isActive: true,
      };
      
      // Calculate expiration date based on selection
      if (data.expiresIn && data.expiresIn !== 'never') {
        const now = new Date();
        
        switch (data.expiresIn) {
          case '1hour':
            tokenData.expiresAt = new Date(now.getTime() + 60 * 60 * 1000);
            break;
          case '1day':
            tokenData.expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            break;
          case '7days':
            tokenData.expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            break;
          case '30days':
            tokenData.expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            break;
          case '90days':
            tokenData.expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
            break;
          case '1year':
            tokenData.expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
            break;
        }
      }
      
      const res = await apiRequest("POST", "/api/api-tokens", tokenData);
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-tokens", currentOrganization?.id] });
      setIsAddTokenDialogOpen(false);
      setNewToken(data.token);
      setShowTokenDialog(true);
      form.reset();
      toast({
        title: "Token created",
        description: "The API token has been successfully created.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to create token",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete token mutation
  const deleteTokenMutation = useMutation({
    mutationFn: async (tokenId: string) => {
      await apiRequest("DELETE", `/api/api-tokens/${tokenId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-tokens", currentOrganization?.id] });
      setIsDeleteDialogOpen(false);
      setSelectedToken(null);
      toast({
        title: "Token deleted",
        description: "The API token has been successfully deleted.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete token",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Form submission handler
  const onSubmit = (data: z.infer<typeof tokenFormSchema>) => {
    addTokenMutation.mutate(data);
  };

  // Handle token deletion
  const handleDeleteToken = (token: ApiToken) => {
    setSelectedToken(token);
    setIsDeleteDialogOpen(true);
  };

  // Copy token to clipboard
  const copyTokenToClipboard = () => {
    if (newToken) {
      navigator.clipboard.writeText(newToken);
      toast({
        title: "Token copied",
        description: "The API token has been copied to your clipboard.",
      });
    }
  };

  return (
    <MainLayout
      title="API Tokens"
      description="Manage API tokens for programmatic access to DynamoDNS."
    >
      <div className="mb-6 flex justify-between items-center">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">Your API Tokens</h2>
          <p className="text-sm text-muted-foreground">
            Create and manage API tokens for secure access to the DynamoDNS API.
          </p>
        </div>
        <Button onClick={() => setIsAddTokenDialogOpen(true)}>
          <Key className="mr-2 h-4 w-4" />
          Generate Token
        </Button>
      </div>

      {/* Tokens Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : tokens.length === 0 ? (
            <div className="text-center py-8">
              <Key className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">No API tokens found</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Create your first API token to enable programmatic access.
              </p>
              <div className="mt-6">
                <Button onClick={() => setIsAddTokenDialogOpen(true)}>
                  Generate Token
                </Button>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Token</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tokens.map((token) => (
                  <TableRow key={token.id}>
                    <TableCell className="font-medium">{token.name}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {token.token.substring(0, 8)}...
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">
                        {token.role || "readonly"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {token.expiresAt ? (
                        <div className="flex items-center">
                          <Calendar className="mr-1 h-3 w-3 text-muted-foreground" />
                          <span 
                            className="text-sm"
                            title={format(new Date(token.expiresAt), 'PPpp')}
                          >
                            {formatDistanceToNow(new Date(token.expiresAt), { addSuffix: true })}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Never</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {token.isActive ? (
                        <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-muted/10 text-muted-foreground">
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleDeleteToken(token)}
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
          )}
        </CardContent>
      </Card>

      {/* Add Token Dialog */}
      <Dialog open={isAddTokenDialogOpen} onOpenChange={setIsAddTokenDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API Token</DialogTitle>
            <DialogDescription>
              Generate a new API token for programmatic access to the DynamoDNS API.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Token Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Production Server, Development, CI/CD" {...field} />
                    </FormControl>
                    <FormDescription>
                      A descriptive name to identify this token
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {/* System roles */}
                        <SelectItem key="system-roles" value="__system_roles_header" disabled className="text-muted-foreground">
                          System Roles
                        </SelectItem>
                        {systemRoles.map((role) => (
                          <SelectItem key={role} value={role}>
                            {role === "admin" && "Administrator"}
                            {role === "manager" && "Manager"}
                            {role === "user" && "User"}
                            {role === "readonly" && "Read-only"}
                          </SelectItem>
                        ))}
                        
                        {/* Custom roles */}
                        {customRoles.length > 0 && (
                          <>
                            <SelectItem key="custom-roles" value="__custom_roles_header" disabled className="text-muted-foreground mt-2">
                              Custom Roles
                            </SelectItem>
                            {customRoles.map((role) => (
                              <SelectItem key={role.id} value={role.name}>
                                {role.name}
                              </SelectItem>
                            ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Determines the level of access for this token
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              

              
              <FormField
                control={form.control}
                name="expiresIn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiration</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select expiration time" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="never">Never expires</SelectItem>
                        <SelectItem value="1hour">1 hour</SelectItem>
                        <SelectItem value="1day">1 day</SelectItem>
                        <SelectItem value="7days">7 days</SelectItem>
                        <SelectItem value="30days">30 days</SelectItem>
                        <SelectItem value="90days">90 days</SelectItem>
                        <SelectItem value="1year">1 year</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Select how long this token should remain valid
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button 
                  type="submit" 
                  disabled={addTokenMutation.isPending}
                >
                  {addTokenMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    "Generate Token"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* New Token Display Dialog */}
      <Dialog open={showTokenDialog} onOpenChange={setShowTokenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Your New API Token</DialogTitle>
            <DialogDescription>
              Please copy your API token now. For security reasons, it won't be displayed again.
            </DialogDescription>
          </DialogHeader>
          
          <div className="bg-muted p-4 rounded-md relative">
            <div className="font-mono text-sm break-all">{newToken}</div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute top-2 right-2" 
              onClick={copyTokenToClipboard}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex items-start mt-2 p-4 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 rounded-md">
            <Info className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <strong>Security note:</strong> Store this token securely. It provides access to your account based on the role you selected.
            </div>
          </div>
          
          <DialogFooter>
            <Button onClick={() => setShowTokenDialog(false)}>
              I've Copied My Token
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API Token</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently revoke the API token <strong>{selectedToken?.name}</strong>. 
              Any applications using this token will no longer be able to access the API.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => selectedToken && deleteTokenMutation.mutate(selectedToken.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteTokenMutation.isPending}
            >
              {deleteTokenMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Revoking...
                </>
              ) : (
                "Revoke Token"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
