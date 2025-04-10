import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useOrganization } from "@/context/organization-context";
import { Webhook } from "@shared/schema";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import { Loader2, Plus, Trash, Edit, ExternalLink, RefreshCw, Clock, Check, X, Activity, Eye, Bell, BellRing } from "lucide-react";

export default function WebhooksPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isTestResultOpen, setIsTestResultOpen] = useState(false);
  const [isHistorySheetOpen, setIsHistorySheetOpen] = useState(false);
  const [currentWebhook, setCurrentWebhook] = useState<Webhook | null>(null);
  const [testResult, setTestResult] = useState<any>(null);

  // Form state for create/edit
  const [formData, setFormData] = useState({
    name: "",
    url: "",
    events: ["dns.*"],
    secret: "",
    isActive: true,
  });

  // Reset form when dialog closes
  const resetForm = () => {
    setFormData({
      name: "",
      url: "",
      events: ["dns.*"],
      secret: "",
      isActive: true,
    });
  };

  // Fetch webhooks for the selected organization
  const {
    data: webhooks = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["/api/webhooks", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];
      const res = await apiRequest(
        "GET",
        `/api/webhooks?organizationId=${currentOrganization.id}`
      );
      return await res.json();
    },
    enabled: !!currentOrganization,
  });

  // Create webhook mutation
  const createWebhookMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/webhooks", {
        ...data,
        organizationId: currentOrganization?.id,
      });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Webhook created",
        description: "The webhook has been created successfully.",
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/webhooks", currentOrganization?.id],
      });
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating webhook",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update webhook mutation
  const updateWebhookMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PUT", `/api/webhooks/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Webhook updated",
        description: "The webhook has been updated successfully.",
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/webhooks", currentOrganization?.id],
      });
      setIsEditOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating webhook",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete webhook mutation
  const deleteWebhookMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/webhooks/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Webhook deleted",
        description: "The webhook has been deleted successfully.",
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/webhooks", currentOrganization?.id],
      });
      setIsDeleteOpen(false);
      setCurrentWebhook(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting webhook",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Test webhook mutation
  const testWebhookMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/webhooks/${id}/test`);
      return await res.json();
    },
    onSuccess: (data) => {
      setTestResult({
        success: true,
        message: data.message || "Webhook test successful",
        timestamp: new Date().toISOString(),
      });
      setIsTestResultOpen(true);
      toast({
        title: "Webhook tested",
        description: "The webhook has been tested successfully.",
      });
    },
    onError: (error: Error) => {
      setTestResult({
        success: false,
        message: error.message || "Webhook test failed",
        timestamp: new Date().toISOString(),
      });
      setIsTestResultOpen(true);
      toast({
        title: "Error testing webhook",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createWebhookMutation.mutate(formData);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentWebhook) {
      updateWebhookMutation.mutate({
        id: currentWebhook.id,
        data: formData,
      });
    }
  };

  const handleDelete = () => {
    if (currentWebhook) {
      deleteWebhookMutation.mutate(currentWebhook.id);
    }
  };

  const handleTestWebhook = (id: string) => {
    testWebhookMutation.mutate(id);
  };

  const handleEditClick = (webhook: Webhook) => {
    setCurrentWebhook(webhook);
    setFormData({
      name: webhook.name,
      url: webhook.url,
      events: webhook.events,
      secret: webhook.secret || "",
      isActive: webhook.isActive,
    });
    setIsEditOpen(true);
  };

  const handleDeleteClick = (webhook: Webhook) => {
    setCurrentWebhook(webhook);
    setIsDeleteOpen(true);
  };

  // Event options for the select component
  const eventOptions = [
    { label: "All DNS events", value: "dns.*" },
    { label: "DNS create events", value: "dns.create" },
    { label: "DNS update events", value: "dns.update" },
    { label: "DNS delete events", value: "dns.delete" },
  ];

  // Helper to format the date
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="text-destructive text-lg">Error loading webhooks</div>
        <p className="text-muted-foreground mt-2">{(error as Error).message}</p>
      </div>
    );
  }

  return (
    <div className="container py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Webhooks</h1>
          <p className="text-muted-foreground mt-1">
            Manage notifications for DNS changes
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Webhook
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Webhooks</CardTitle>
          <CardDescription>
            Receive notifications when DNS records change
          </CardDescription>
        </CardHeader>
        <CardContent>
          {webhooks.length === 0 ? (
            <div className="text-center py-8">
              <BellRing className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
              <h3 className="mt-4 text-lg font-medium">No webhooks configured</h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
                Webhooks allow your systems to be notified when DNS records change.
                Add a webhook to get started.
              </p>
              <Button
                onClick={() => setIsCreateOpen(true)}
                className="mt-4"
                variant="outline"
              >
                <Plus className="mr-2 h-4 w-4" /> Add Webhook
              </Button>
            </div>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Events</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Triggered</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {webhooks.map((webhook: Webhook) => (
                    <TableRow key={webhook.id}>
                      <TableCell className="font-medium">{webhook.name}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{webhook.url}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {webhook.events.map((event) => (
                            <Badge key={event} variant="outline">
                              {event}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {webhook.isActive ? (
                          <Badge className="bg-green-500 text-white">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {webhook.lastTriggered ? (
                          <div className="flex items-center">
                            <Clock className="mr-1 h-3 w-3" />
                            {formatDate(webhook.lastTriggered)}
                          </div>
                        ) : (
                          "Never"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleTestWebhook(webhook.id)}
                          >
                            <RefreshCw className="h-4 w-4" />
                            <span className="sr-only">Test</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditClick(webhook)}
                          >
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive"
                            onClick={() => handleDeleteClick(webhook)}
                          >
                            <Trash className="h-4 w-4" />
                            <span className="sr-only">Delete</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Webhook Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Create Webhook</DialogTitle>
            <DialogDescription>
              Add a new webhook to receive notifications when DNS records change.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Production DNS Alerts"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="url">URL</Label>
                <Input
                  id="url"
                  value={formData.url}
                  onChange={(e) =>
                    setFormData({ ...formData, url: e.target.value })
                  }
                  placeholder="https://example.com/webhook"
                  required
                />
                <p className="text-sm text-muted-foreground">
                  The URL that will receive webhook events
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="events">Events</Label>
                <div className="space-y-2">
                  {eventOptions.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`event-${option.value}`}
                        checked={formData.events.includes(option.value)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFormData({
                              ...formData,
                              events: [...formData.events, option.value],
                            });
                          } else {
                            setFormData({
                              ...formData,
                              events: formData.events.filter(
                                (e) => e !== option.value
                              ),
                            });
                          }
                        }}
                      />
                      <label
                        htmlFor={`event-${option.value}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {option.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="secret">Secret Key (Optional)</Label>
                <Input
                  id="secret"
                  value={formData.secret}
                  onChange={(e) =>
                    setFormData({ ...formData, secret: e.target.value })
                  }
                  placeholder="webhook_secret_key"
                />
                <p className="text-sm text-muted-foreground">
                  Used to sign webhook payloads so you can verify they came from us
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={formData.isActive}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isActive: checked })
                  }
                />
                <Label htmlFor="active">Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createWebhookMutation.isPending}>
                {createWebhookMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create Webhook
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Webhook Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Edit Webhook</DialogTitle>
            <DialogDescription>
              Update the webhook configuration.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Production DNS Alerts"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-url">URL</Label>
                <Input
                  id="edit-url"
                  value={formData.url}
                  onChange={(e) =>
                    setFormData({ ...formData, url: e.target.value })
                  }
                  placeholder="https://example.com/webhook"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-events">Events</Label>
                <div className="space-y-2">
                  {eventOptions.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`edit-event-${option.value}`}
                        checked={formData.events.includes(option.value)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFormData({
                              ...formData,
                              events: [...formData.events, option.value],
                            });
                          } else {
                            setFormData({
                              ...formData,
                              events: formData.events.filter(
                                (e) => e !== option.value
                              ),
                            });
                          }
                        }}
                      />
                      <label
                        htmlFor={`edit-event-${option.value}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {option.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-secret">Secret Key (Optional)</Label>
                <Input
                  id="edit-secret"
                  value={formData.secret}
                  onChange={(e) =>
                    setFormData({ ...formData, secret: e.target.value })
                  }
                  placeholder="webhook_secret_key"
                />
                <p className="text-sm text-muted-foreground">
                  Used to sign webhook payloads so you can verify they came from us
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-active"
                  checked={formData.isActive}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isActive: checked })
                  }
                />
                <Label htmlFor="edit-active">Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateWebhookMutation.isPending}>
                {updateWebhookMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Webhook Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              webhook{" "}
              <span className="font-medium">{currentWebhook?.name}</span> and
              stop all notifications.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCurrentWebhook(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteWebhookMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteWebhookMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Test Result Dialog */}
      <Dialog open={isTestResultOpen} onOpenChange={setIsTestResultOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Test Result</DialogTitle>
            <DialogDescription>
              Result of the webhook test request.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center mb-4 gap-2">
              {testResult?.success ? (
                <Badge className="bg-green-500 text-white px-2 py-1">
                  <Check className="h-4 w-4 mr-1" />
                  Success
                </Badge>
              ) : (
                <Badge variant="destructive" className="px-2 py-1">
                  <X className="h-4 w-4 mr-1" />
                  Failed
                </Badge>
              )}
              <span className="text-sm text-muted-foreground">
                {formatDate(testResult?.timestamp)}
              </span>
            </div>
            <div className="bg-muted p-4 rounded-md">
              <p className="text-sm whitespace-pre-wrap">
                {testResult?.message}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsTestResultOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}