import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import DashboardPage from "@/pages/dashboard";
import DomainsPage from "@/pages/domains";
import MetricsPage from "@/pages/metrics";
import HistoryPage from "@/pages/history";
import ApiTokensPage from "@/pages/api-tokens";
import UsersRolesPage from "@/pages/users-roles";
import RolesPage from "@/pages/roles";
import GroupsPage from "@/pages/groups";
import ProvidersPage from "@/pages/providers";
import SettingsPage from "@/pages/settings";
import CustomersPage from "@/pages/organizations";
import WebhooksPage from "@/pages/webhooks";
import WebhookLogsPage from "@/pages/webhook-logs";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import { ThemeProvider } from "@/hooks/use-theme";
import { CustomerProvider } from "@/context/customer-context";

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <ProtectedRoute path="/" component={DashboardPage} />
      <ProtectedRoute path="/customers" component={CustomersPage} />
      <ProtectedRoute path="/domains" component={DomainsPage} />
      <ProtectedRoute path="/metrics" component={MetricsPage} />
      <ProtectedRoute path="/history" component={HistoryPage} />
      <ProtectedRoute path="/api-tokens" component={ApiTokensPage} />
      <ProtectedRoute path="/users-roles" component={UsersRolesPage} />
      <ProtectedRoute path="/roles" component={RolesPage} />
      <ProtectedRoute path="/groups" component={GroupsPage} />
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
          <CustomerProvider>
            <Router />
            <Toaster />
          </CustomerProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
