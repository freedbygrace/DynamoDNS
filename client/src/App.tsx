import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import DashboardPage from "@/pages/dashboard";
import DomainsPage from "@/pages/domains";
import DnsRecordsPage from "@/pages/dns-records";
import MetricsPage from "@/pages/metrics";
import HistoryPage from "@/pages/history";
import ApiTokensPage from "@/pages/api-tokens";
import UsersRolesPage from "@/pages/users-roles";
import ProvidersPage from "@/pages/providers";
import SettingsPage from "@/pages/settings";
import OrganizationsPage from "@/pages/organizations";
import WebhooksPage from "@/pages/webhooks";
import WebhookLogsPage from "@/pages/webhook-logs";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import { ThemeProvider } from "@/hooks/use-theme";
import { OrganizationProvider } from "@/context/organization-context";

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <ProtectedRoute path="/" component={DashboardPage} />
      <ProtectedRoute path="/organizations" component={OrganizationsPage} />
      <ProtectedRoute path="/domains" component={DomainsPage} />
      <ProtectedRoute path="/dns-records" component={DnsRecordsPage} />
      <ProtectedRoute path="/metrics" component={MetricsPage} />
      <ProtectedRoute path="/history" component={HistoryPage} />
      <ProtectedRoute path="/api-tokens" component={ApiTokensPage} />
      <ProtectedRoute path="/users-roles" component={UsersRolesPage} />
      <ProtectedRoute path="/providers" component={ProvidersPage} />
      <ProtectedRoute path="/webhooks" component={WebhooksPage} />
      <ProtectedRoute path="/webhook-logs" component={WebhookLogsPage} />
      <ProtectedRoute path="/settings" component={SettingsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <OrganizationProvider>
            <Router />
            <Toaster />
          </OrganizationProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
