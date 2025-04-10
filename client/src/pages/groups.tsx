import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { MainLayout } from "@/components/layouts/main-layout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Group, InsertGroup, User, Organization, MemberType, memberTypes } from "@shared/schema";
import { format, formatDistanceToNow } from "date-fns";

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
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/shared/pagination";

// Icons
import {
  Loader2,
  Plus,
  Search,
  MoreHorizontal,
  Users,
  Building,
  Folders,
  UserPlus,
  UserCheck,
  Trash2,
  Lock,
  Edit,
  Save,
  PlusCircle,
  UsersRound,
  Building2,
  FolderTree
} from "lucide-react";

// Group form schema
const groupFormSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  description: z.string().optional(),
  parentGroupId: z.string().optional(),
});

// Group member form schema
const groupMemberFormSchema = z.object({
  groupId: z.string(),
  memberType: z.enum(["user", "organization", "group"] as [string, ...string[]]),
  memberId: z.string(),
});

type GroupFormValues = z.infer<typeof groupFormSchema>;
type GroupMemberFormValues = z.infer<typeof groupMemberFormSchema>;

export default function GroupsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isAddGroupOpen, setIsAddGroupOpen] = useState(false);
  const [isEditGroupOpen, setIsEditGroupOpen] = useState(false);
  const [isDeleteGroupOpen, setIsDeleteGroupOpen] = useState(false);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedMemberType, setSelectedMemberType] = useState<MemberType | null>(null);
  const pageSize = 10;

  const isAdmin = user?.role === "admin" || user?.role === "manager";

  // Fetch groups
  const { data: groups = [], isLoading: isLoadingGroups } = useQuery<Group[]>({
    queryKey: ["/api/groups"],
    enabled: isAdmin,
  });

  // Fetch users for member selection
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: isAdmin && isAddMemberOpen,
  });

  // Fetch organizations for member selection
  const { data: organizations = [] } = useQuery<Organization[]>({
    queryKey: ["/api/organizations"],
    enabled: isAdmin && isAddMemberOpen,
  });

  // Fetch group members when a group is selected
  const { data: groupMembers = [], isLoading: isLoadingMembers } = useQuery<any[]>({
    queryKey: ["/api/groups", selectedGroup?.id, "members"],
    enabled: !!selectedGroup,
  });

  // Fetch parent groups (all groups except the selected one)
  const availableParentGroups = selectedGroup 
    ? groups.filter(g => g.id !== selectedGroup.id) 
    : groups;

  // Setup forms
  const addGroupForm = useForm<GroupFormValues>({
    resolver: zodResolver(groupFormSchema),
    defaultValues: {
      name: "",
      description: "",
      parentGroupId: undefined,
    },
  });

  const editGroupForm = useForm<GroupFormValues>({
    resolver: zodResolver(groupFormSchema),
    defaultValues: {
      name: "",
      description: "",
      parentGroupId: undefined,
    },
  });

  const addMemberForm = useForm<GroupMemberFormValues>({
    resolver: zodResolver(groupMemberFormSchema),
    defaultValues: {
      groupId: "",
      memberType: "user",
      memberId: "",
    },
  });

  // Mutations
  const createGroupMutation = useMutation({
    mutationFn: async (data: GroupFormValues) => {
      const res = await apiRequest("POST", "/api/groups", {
        ...data,
        isActive: true,
        createdBy: user?.id,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      setIsAddGroupOpen(false);
      addGroupForm.reset();
      toast({
        title: "Group created",
        description: "The group has been created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating group",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateGroupMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: GroupFormValues }) => {
      const res = await apiRequest("PUT", `/api/groups/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      setIsEditGroupOpen(false);
      setSelectedGroup(null);
      toast({
        title: "Group updated",
        description: "The group has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating group",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/groups/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      setIsDeleteGroupOpen(false);
      setSelectedGroup(null);
      toast({
        title: "Group deleted",
        description: "The group has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting group",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const addGroupMemberMutation = useMutation({
    mutationFn: async (data: GroupMemberFormValues) => {
      const res = await apiRequest("POST", "/api/group-members", {
        ...data,
        addedBy: user?.id,
      });
      return await res.json();
    },
    onSuccess: () => {
      if (selectedGroup) {
        queryClient.invalidateQueries({ queryKey: ["/api/groups", selectedGroup.id, "members"] });
      }
      setIsAddMemberOpen(false);
      addMemberForm.reset();
      toast({
        title: "Member added",
        description: "The member has been added to the group successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error adding member",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeGroupMemberMutation = useMutation({
    mutationFn: async ({ groupId, memberId }: { groupId: string, memberId: string }) => {
      await apiRequest("DELETE", `/api/group-members/${memberId}`);
    },
    onSuccess: () => {
      if (selectedGroup) {
        queryClient.invalidateQueries({ queryKey: ["/api/groups", selectedGroup.id, "members"] });
      }
      setSelectedMemberId(null);
      toast({
        title: "Member removed",
        description: "The member has been removed from the group successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error removing member",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Form handlers
  const onCreateGroupSubmit = (data: GroupFormValues) => {
    // Handle "none" value for parentGroupId
    const submissionData = {
      ...data,
      parentGroupId: data.parentGroupId === "none" ? undefined : data.parentGroupId
    };
    createGroupMutation.mutate(submissionData);
  };

  const onEditGroupSubmit = (data: GroupFormValues) => {
    if (selectedGroup) {
      // Handle "none" value for parentGroupId
      const submissionData = {
        ...data,
        parentGroupId: data.parentGroupId === "none" ? undefined : data.parentGroupId
      };
      updateGroupMutation.mutate({ id: selectedGroup.id, data: submissionData });
    }
  };

  const onAddMemberSubmit = (data: GroupMemberFormValues) => {
    addGroupMemberMutation.mutate(data);
  };

  // Action handlers
  const handleEditGroup = (group: Group) => {
    setSelectedGroup(group);
    editGroupForm.reset({
      name: group.name,
      description: group.description || "",
      parentGroupId: group.parentGroupId || "none",
    });
    setIsEditGroupOpen(true);
  };

  const handleDeleteGroup = (group: Group) => {
    setSelectedGroup(group);
    setIsDeleteGroupOpen(true);
  };

  const handleAddMember = (group: Group) => {
    setSelectedGroup(group);
    addMemberForm.reset({
      groupId: group.id,
      memberType: "user",
      memberId: "",
    });
    setIsAddMemberOpen(true);
  };

  const handleRemoveMember = (memberId: string, memberType: MemberType) => {
    if (selectedGroup) {
      setSelectedMemberId(memberId);
      setSelectedMemberType(memberType);
      // Confirm before removing
      if (confirm("Are you sure you want to remove this member from the group?")) {
        removeGroupMemberMutation.mutate({ groupId: selectedGroup.id, memberId });
      }
    }
  };

  const handleViewGroupDetails = (group: Group) => {
    setSelectedGroup(group);
  };

  // Display member details
  const getMemberDetails = (memberId: string, memberType: MemberType) => {
    switch (memberType) {
      case "user":
        const userMember = users.find(u => u.id === memberId);
        return userMember ? { name: userMember.username, email: userMember.email } : { name: "Unknown User", email: "" };
      case "organization":
        const orgMember = organizations.find(o => o.id === memberId);
        return orgMember ? { name: orgMember.name, email: "" } : { name: "Unknown Organization", email: "" };
      case "group":
        const groupMember = groups.find(g => g.id === memberId);
        return groupMember ? { name: groupMember.name, email: "" } : { name: "Unknown Group", email: "" };
      default:
        return { name: "Unknown Member", email: "" };
    }
  };

  // Get icon for member type
  const getMemberTypeIcon = (memberType: MemberType) => {
    switch (memberType) {
      case "user":
        return <UserCheck className="mr-2 h-4 w-4" />;
      case "organization":
        return <Building2 className="mr-2 h-4 w-4" />;
      case "group":
        return <FolderTree className="mr-2 h-4 w-4" />;
      default:
        return null;
    }
  };

  // Pagination
  const paginatedGroups = groups.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(groups.length / pageSize);

  // Access control check
  if (!isAdmin) {
    return (
      <MainLayout title="Groups Management" description="Manage groups and their members.">
        <Card>
          <CardContent className="pt-6 flex flex-col items-center justify-center h-64">
            <Lock className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Access Restricted</h3>
            <p className="text-center text-muted-foreground">
              You don't have permission to access this page. Only administrators and managers can manage groups.
            </p>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Groups Management" description="Manage groups and their members.">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Groups Management</h2>
          <p className="text-muted-foreground">
            Create and manage groups with hierarchical structure and add members from users, organizations, and other groups.
          </p>
        </div>
        <Button onClick={() => {
          addGroupForm.reset();
          setIsAddGroupOpen(true);
        }}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Create Group
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="md:col-span-2 lg:col-span-2">
          <CardHeader>
            <CardTitle>Groups</CardTitle>
            <CardDescription>Manage your groups and their hierarchical structure</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingGroups ? (
              <div className="space-y-3">
                {Array(3).fill(0).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : groups.length === 0 ? (
              <div className="text-center py-6">
                <UsersRound className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-medium">No Groups</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Get started by creating your first group.
                </p>
                <Button
                  onClick={() => setIsAddGroupOpen(true)}
                  className="mt-4"
                  variant="outline"
                >
                  <Plus className="mr-2 h-4 w-4" /> Create Group
                </Button>
              </div>
            ) : (
              <>
                <div className="overflow-hidden rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Parent Group</TableHead>
                        <TableHead>Members</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedGroups.map((group) => (
                        <TableRow key={group.id} className={selectedGroup?.id === group.id ? "bg-muted/50" : ""}>
                          <TableCell className="font-medium">{group.name}</TableCell>
                          <TableCell>
                            {group.parentGroupId ? 
                              groups.find(g => g.id === group.parentGroupId)?.name || "Unknown" : 
                              "None"}
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleViewGroupDetails(group)}
                            >
                              <Users className="mr-1 h-4 w-4" />
                              View Members
                            </Button>
                          </TableCell>
                          <TableCell>
                            {formatDistanceToNow(new Date(group.createdAt), { addSuffix: true })}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEditGroup(group)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleAddMember(group)}>
                                  <UserPlus className="mr-2 h-4 w-4" />
                                  Add Member
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDeleteGroup(group)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                
                {groups.length > pageSize && (
                  <div className="mt-4">
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={setCurrentPage}
                      itemLabel="groups"
                      totalItems={groups.length}
                      itemsPerPage={pageSize}
                    />
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {selectedGroup ? `Group Details: ${selectedGroup.name}` : "Group Details"}
            </CardTitle>
            <CardDescription>
              {selectedGroup 
                ? `View members and details for ${selectedGroup.name}`
                : "Select a group to view its details and members"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedGroup ? (
              <div className="text-center py-6">
                <UsersRound className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-medium">No Group Selected</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Select a group to view its details and members.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-medium">Group Information</h3>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div className="text-sm text-muted-foreground">Name:</div>
                      <div className="text-sm font-medium">{selectedGroup.name}</div>
                      
                      {selectedGroup.description && (
                        <>
                          <div className="text-sm text-muted-foreground">Description:</div>
                          <div className="text-sm">{selectedGroup.description}</div>
                        </>
                      )}
                      
                      <div className="text-sm text-muted-foreground">Parent Group:</div>
                      <div className="text-sm">
                        {selectedGroup.parentGroupId ? 
                          groups.find(g => g.id === selectedGroup.parentGroupId)?.name || "Unknown" : 
                          "None"}
                      </div>
                      
                      <div className="text-sm text-muted-foreground">Created:</div>
                      <div className="text-sm">
                        {format(new Date(selectedGroup.createdAt), "PPP")}
                      </div>
                    </div>
                    
                    <Separator className="my-4" />
                    
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-lg font-medium">Members</h3>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleAddMember(selectedGroup)}
                      >
                        <UserPlus className="mr-2 h-4 w-4" />
                        Add Member
                      </Button>
                    </div>
                    
                    {isLoadingMembers ? (
                      <div className="space-y-2">
                        {Array(3).fill(0).map((_, i) => (
                          <Skeleton key={i} className="h-10 w-full" />
                        ))}
                      </div>
                    ) : !groupMembers || groupMembers.length === 0 ? (
                      <div className="text-center py-4 border rounded-md">
                        <p className="text-sm text-muted-foreground">
                          This group has no members yet.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {groupMembers.map((member) => {
                          const memberDetails = getMemberDetails(member.memberId, member.memberType as MemberType);
                          return (
                            <div key={member.id} className="flex items-center justify-between p-2 border rounded-md bg-card">
                              <div className="flex items-center">
                                {getMemberTypeIcon(member.memberType as MemberType)}
                                <div>
                                  <div className="font-medium text-sm">{memberDetails.name}</div>
                                  {memberDetails.email && (
                                    <div className="text-xs text-muted-foreground">{memberDetails.email}</div>
                                  )}
                                  <Badge variant="outline" className="text-xs mt-1">
                                    {member.memberType.charAt(0).toUpperCase() + member.memberType.slice(1)}
                                  </Badge>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveMember(member.id, member.memberType as MemberType)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Group Dialog */}
      <Dialog open={isAddGroupOpen} onOpenChange={setIsAddGroupOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create Group</DialogTitle>
            <DialogDescription>
              Create a new group to organize users, organizations, or other groups.
            </DialogDescription>
          </DialogHeader>
          <Form {...addGroupForm}>
            <form onSubmit={addGroupForm.handleSubmit(onCreateGroupSubmit)} className="space-y-4">
              <FormField
                control={addGroupForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter group name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addGroupForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter group description (optional)"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addGroupForm.control}
                name="parentGroupId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parent Group</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a parent group (optional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {groups.map((group) => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Optionally place this group as a child of another group.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={createGroupMutation.isPending}>
                  {createGroupMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Create Group
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Group Dialog */}
      <Dialog open={isEditGroupOpen} onOpenChange={setIsEditGroupOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Group</DialogTitle>
            <DialogDescription>
              Update the details for this group.
            </DialogDescription>
          </DialogHeader>
          <Form {...editGroupForm}>
            <form onSubmit={editGroupForm.handleSubmit(onEditGroupSubmit)} className="space-y-4">
              <FormField
                control={editGroupForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter group name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editGroupForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter group description (optional)"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editGroupForm.control}
                name="parentGroupId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parent Group</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      value={field.value || ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a parent group (optional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {availableParentGroups.map((group) => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Optionally place this group as a child of another group.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={updateGroupMutation.isPending}>
                  {updateGroupMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Group Confirmation */}
      <AlertDialog open={isDeleteGroupOpen} onOpenChange={setIsDeleteGroupOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the group
              <span className="font-medium"> {selectedGroup?.name}</span> and remove all its members.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedGroup) {
                  deleteGroupMutation.mutate(selectedGroup.id);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteGroupMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Member Dialog */}
      <Dialog open={isAddMemberOpen} onOpenChange={setIsAddMemberOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Group Member</DialogTitle>
            <DialogDescription>
              Add a user, organization, or another group as a member to {selectedGroup?.name}.
            </DialogDescription>
          </DialogHeader>
          <Form {...addMemberForm}>
            <form onSubmit={addMemberForm.handleSubmit(onAddMemberSubmit)} className="space-y-4">
              {/* Hidden field for group ID */}
              <input 
                type="hidden" 
                {...addMemberForm.register("groupId")} 
                value={selectedGroup?.id || ""} 
              />
              
              <FormField
                control={addMemberForm.control}
                name="memberType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Member Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select member type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="user">
                          <div className="flex items-center">
                            <UserCheck className="mr-2 h-4 w-4" />
                            User
                          </div>
                        </SelectItem>
                        <SelectItem value="organization">
                          <div className="flex items-center">
                            <Building2 className="mr-2 h-4 w-4" />
                            Organization
                          </div>
                        </SelectItem>
                        <SelectItem value="group">
                          <div className="flex items-center">
                            <FolderTree className="mr-2 h-4 w-4" />
                            Group
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={addMemberForm.control}
                name="memberId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Select Member</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={`Select a ${addMemberForm.watch("memberType")}`} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {addMemberForm.watch("memberType") === "user" && users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.username} ({user.email})
                          </SelectItem>
                        ))}
                        
                        {addMemberForm.watch("memberType") === "organization" && organizations.map((org) => (
                          <SelectItem key={org.id} value={org.id}>
                            {org.name}
                          </SelectItem>
                        ))}
                        
                        {addMemberForm.watch("memberType") === "group" && 
                          availableParentGroups
                            .filter(g => g.id !== selectedGroup?.id)
                            .map((group) => (
                              <SelectItem key={group.id} value={group.id}>
                                {group.name}
                              </SelectItem>
                            ))
                        }
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button type="submit" disabled={addGroupMemberMutation.isPending}>
                  {addGroupMemberMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Add Member
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}