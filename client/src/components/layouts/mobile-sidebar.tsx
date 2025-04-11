import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { OrganizationSelector } from "@/components/shared/organization-selector";
import { useAuth } from "@/hooks/use-auth";
import {
  LayoutDashboard,
  Home,
  Globe,
  BarChart2,
  FileEdit,
  Key,
  Users,
  Settings,
  CreditCard,
  X,
  LogOut,
  Webhook,
  ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileSidebar({ isOpen, onClose }: MobileSidebarProps) {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
  
  // Define navigation items
  const navItems = [
    {
      title: "Dashboard",
      href: "/",
      icon: <LayoutDashboard className="w-5 h-5 mr-3" />,
    },
    {
      title: "Organizations",
      href: "/organizations",
      icon: <Users className="w-5 h-5 mr-3" />,
    },
    {
      title: "Domains & DNS",
      href: "/domains",
      icon: <Globe className="w-5 h-5 mr-3" />,
    },
    {
      title: "Metrics",
      href: "/metrics",
      icon: <BarChart2 className="w-5 h-5 mr-3" />,
    },
    {
      title: "History",
      href: "/history",
      icon: <FileEdit className="w-5 h-5 mr-3" />,
    },
    {
      title: "API Tokens",
      href: "/api-tokens",
      icon: <Key className="w-5 h-5 mr-3" />,
    },
  ];
  
  // Define admin navigation items
  const adminNavItems = [
    {
      title: "Users",
      href: "/users-roles",
      icon: <Users className="w-5 h-5 mr-3" />,
      roles: ["admin"],
    },
    {
      title: "Roles",
      href: "/roles",
      icon: <Key className="w-5 h-5 mr-3" />,
      roles: ["admin"],
    },
    {
      title: "Webhooks",
      href: "/webhooks",
      icon: <Webhook className="w-5 h-5 mr-3" />,
      roles: ["admin", "manager"],
    },
    {
      title: "Webhook Logs",
      href: "/webhook-logs",
      icon: <ClipboardList className="w-5 h-5 mr-3" />,
      roles: ["admin", "manager"],
    },
    {
      title: "Providers",
      href: "/providers",
      icon: <CreditCard className="w-5 h-5 mr-3" />,
      roles: ["admin", "manager"],
    },
    {
      title: "Settings",
      href: "/settings",
      icon: <Settings className="w-5 h-5 mr-3" />,
      roles: ["admin", "manager"],
    },
  ];
  
  // Filter admin items based on user role
  const filteredAdminItems = adminNavItems.filter(
    item => !item.roles || (user && item.roles.includes(user.role))
  );
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose}></div>
      <div className="fixed inset-y-0 left-0 w-full max-w-xs bg-card shadow-lg">
        <div className="flex h-full flex-col">
          <div className="p-4 flex items-center justify-between border-b border-border">
            <div className="flex items-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-6 h-6 text-primary mr-2"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
              </svg>
              <span className="font-semibold text-xl">DynamoDNS</span>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-md hover:bg-accent"
              aria-label="Close sidebar"
            >
              <X size={24} />
            </button>
          </div>
          
          {/* Organization Selector */}
          <div className="px-4 py-2">
            <OrganizationSelector />
          </div>

          <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center px-3 py-2 text-sm font-medium rounded-md cursor-pointer",
                    location === item.href
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent hover:text-accent-foreground"
                  )}
                  onClick={onClose}
                >
                  {item.icon}
                  {item.title}
                </div>
              </Link>
            ))}
            
            {filteredAdminItems.length > 0 && (
              <div className="pt-4">
                <div className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Administration
                </div>
                {filteredAdminItems.map((item) => (
                  <Link key={item.href} href={item.href}>
                    <div
                      className={cn(
                        "mt-1 flex items-center px-3 py-2 text-sm font-medium rounded-md cursor-pointer",
                        location === item.href
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-accent hover:text-accent-foreground"
                      )}
                      onClick={onClose}
                    >
                      {item.icon}
                      {item.title}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </nav>
          
          <div className="p-4 border-t border-border">
            <Button 
              variant="outline" 
              className="w-full justify-start" 
              onClick={() => {
                logoutMutation.mutate();
                onClose();
              }}
              disabled={logoutMutation.isPending}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
