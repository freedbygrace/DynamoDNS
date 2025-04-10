import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/shared/theme-toggle";
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
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function Sidebar() {
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
      title: "Domains",
      href: "/domains",
      icon: <Home className="w-5 h-5 mr-3" />,
    },
    {
      title: "DNS Records",
      href: "/dns-records",
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
      title: "Users & Roles",
      href: "/users-roles",
      icon: <Users className="w-5 h-5 mr-3" />,
      roles: ["admin"],
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

  return (
    <aside className="hidden lg:flex lg:flex-col w-64 border-r border-border bg-card">
      <div className="p-4 flex items-center justify-between">
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
          <span className="font-semibold text-xl">DynamiDNS</span>
        </div>
      </div>

      {/* Organization Selector */}
      <div className="px-4 py-2">
        <OrganizationSelector />
      </div>

      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <div key={item.href}>
            <Link href={item.href}>
              <div
                className={cn(
                  "flex items-center px-3 py-2 text-sm font-medium rounded-md cursor-pointer",
                  location === item.href
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent hover:text-accent-foreground"
                )}
              >
                {item.icon}
                {item.title}
              </div>
            </Link>
          </div>
        ))}
        
        {filteredAdminItems.length > 0 && (
          <div className="pt-4">
            <div className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Administration
            </div>
            {filteredAdminItems.map((item) => (
              <div key={item.href}>
                <Link href={item.href}>
                  <div
                    className={cn(
                      "mt-1 flex items-center px-3 py-2 text-sm font-medium rounded-md cursor-pointer",
                      location === item.href
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    {item.icon}
                    {item.title}
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}
      </nav>

      <div className="p-4 border-t border-border flex flex-col gap-2">
        <ThemeToggle />
        <Button 
          variant="outline" 
          className="w-full justify-start" 
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Log out
        </Button>
      </div>
    </aside>
  );
}
