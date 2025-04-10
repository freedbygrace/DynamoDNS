import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { useOrganization } from "@/context/organization-context";
import { Redirect, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { useTheme } from "@/hooks/use-theme";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

const loginSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  fullName: z.string().optional(),
  organizationId: z.string().optional(),
});

// Define LDAP login schema
const ldapSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

// Type for Auth config from API
interface AuthConfig {
  localAuthEnabled: boolean;
  registrationEnabled: boolean;
  ldapEnabled: boolean;
  oidcEnabled: boolean;
  oidcButtonText: string;
}

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const { theme } = useTheme();
  const { organizations, isLoading: orgsLoading } = useOrganization();
  const [location, setLocation] = useLocation();
  
  // Fetch authentication configuration
  const { data: authConfig, isLoading: configLoading } = useQuery<AuthConfig>({
    queryKey: ['/api/auth/config'],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // State for managing LDAP login
  const [ldapLoginPending, setLdapLoginPending] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const ldapForm = useForm<z.infer<typeof ldapSchema>>({
    resolver: zodResolver(ldapSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const registerForm = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      fullName: "",
      organizationId: undefined,
    },
  });

  const onLoginSubmit = (values: z.infer<typeof loginSchema>) => {
    setAuthError(null);
    loginMutation.mutate(values, {
      onError: (error: any) => {
        setAuthError(error.message || "Login failed. Please check your credentials.");
      }
    });
  };

  const onLdapSubmit = async (values: z.infer<typeof ldapSchema>) => {
    try {
      setLdapLoginPending(true);
      setAuthError(null);
      
      const response = await fetch('/api/auth/ldap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'LDAP authentication failed');
      }
      
      // Force refresh user data
      window.location.href = '/';
    } catch (error: any) {
      setAuthError(error.message || "LDAP login failed. Please check your credentials.");
    } finally {
      setLdapLoginPending(false);
    }
  };

  const onRegisterSubmit = (values: z.infer<typeof registerSchema>) => {
    setAuthError(null);
    registerMutation.mutate(values, {
      onError: (error: any) => {
        setAuthError(error.message || "Registration failed. Please try again.");
      }
    });
  };
  
  // Function to handle OIDC login
  const handleOidcLogin = () => {
    window.location.href = '/api/auth/oidc';
  };

  // Redirect if already logged in
  if (user) {
    return <Redirect to="/" />;
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Auth Form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>

        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="flex items-center mb-2">
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
            <CardTitle className="text-2xl">Welcome</CardTitle>
            <CardDescription>
              {configLoading 
                ? "Loading..." 
                : authConfig?.registrationEnabled 
                  ? "Sign in to your account or create a new one" 
                  : "Sign in to your account"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className={`grid w-full ${(!configLoading && authConfig?.registrationEnabled) ? 'grid-cols-2' : 'grid-cols-1'} mb-4`}>
                <TabsTrigger value="login">Login</TabsTrigger>
                {(!configLoading && authConfig?.registrationEnabled) && (
                  <TabsTrigger value="register">Register</TabsTrigger>
                )}
              </TabsList>
              
              <TabsContent value="login">
                {authError && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertTitle>Authentication Error</AlertTitle>
                    <AlertDescription>{authError}</AlertDescription>
                  </Alert>
                )}

                {configLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <>
                    {/* Local Authentication */}
                    {authConfig?.localAuthEnabled && (
                      <Form {...loginForm}>
                        <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                          <FormField
                            control={loginForm.control}
                            name="username"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Username or Email</FormLabel>
                                <FormControl>
                                  <Input placeholder="Enter your username or email" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={loginForm.control}
                            name="password"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Password</FormLabel>
                                <FormControl>
                                  <Input type="password" placeholder="••••••••" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <Button 
                            type="submit" 
                            className="w-full" 
                            disabled={loginMutation.isPending}
                          >
                            {loginMutation.isPending ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Logging in...
                              </>
                            ) : (
                              "Login"
                            )}
                          </Button>
                        </form>
                      </Form>
                    )}

                    {/* LDAP Authentication */}
                    {authConfig?.ldapEnabled && (
                      <>
                        {authConfig?.localAuthEnabled && (
                          <div className="my-6 flex items-center">
                            <div className="flex-1 h-px bg-border"></div>
                            <p className="mx-4 text-sm text-muted-foreground">Or login with LDAP</p>
                            <div className="flex-1 h-px bg-border"></div>
                          </div>
                        )}
                        
                        <Form {...ldapForm}>
                          <form onSubmit={ldapForm.handleSubmit(onLdapSubmit)} className="space-y-4">
                            <FormField
                              control={ldapForm.control}
                              name="username"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>LDAP Username</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Enter your LDAP username" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={ldapForm.control}
                              name="password"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>LDAP Password</FormLabel>
                                  <FormControl>
                                    <Input type="password" placeholder="••••••••" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <Button 
                              type="submit" 
                              className="w-full" 
                              disabled={ldapLoginPending}
                              variant="outline"
                            >
                              {ldapLoginPending ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  LDAP Authentication...
                                </>
                              ) : (
                                "Login with LDAP"
                              )}
                            </Button>
                          </form>
                        </Form>
                      </>
                    )}

                    {/* OIDC Authentication */}
                    {authConfig?.oidcEnabled && (
                      <>
                        {(authConfig?.localAuthEnabled || authConfig?.ldapEnabled) && (
                          <div className="my-6 flex items-center">
                            <div className="flex-1 h-px bg-border"></div>
                            <p className="mx-4 text-sm text-muted-foreground">Or</p>
                            <div className="flex-1 h-px bg-border"></div>
                          </div>
                        )}
                        
                        <Button 
                          onClick={handleOidcLogin}
                          className="w-full"
                          variant="secondary"
                        >
                          {authConfig?.oidcButtonText || "Sign in with OpenID Connect"}
                        </Button>
                      </>
                    )}

                    {!authConfig?.localAuthEnabled && !authConfig?.ldapEnabled && !authConfig?.oidcEnabled && (
                      <Alert className="mb-4">
                        <AlertTitle>Authentication Error</AlertTitle>
                        <AlertDescription>No authentication methods are enabled. Please contact your administrator.</AlertDescription>
                      </Alert>
                    )}
                  </>
                )}
              </TabsContent>
              
              <TabsContent value="register">
                <Form {...registerForm}>
                  <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                    <FormField
                      control={registerForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input placeholder="Choose a username" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="Enter your email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter your full name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Create a password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="organizationId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Organization</FormLabel>
                          <FormControl>
                            <Select
                              disabled={orgsLoading}
                              onValueChange={(value) => field.onChange(value)}
                              value={field.value || ""}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select an organization (optional)" />
                              </SelectTrigger>
                              <SelectContent>
                                {organizations.map((org) => (
                                  <SelectItem key={org.id} value={org.id.toString()}>
                                    {org.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={registerMutation.isPending}
                    >
                      {registerMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating account...
                        </>
                      ) : (
                        "Create Account"
                      )}
                    </Button>
                  </form>
                </Form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Hero Section */}
      <div className="hidden lg:flex lg:flex-1 bg-primary text-primary-foreground">
        <div className="max-w-lg mx-auto p-10 flex flex-col justify-center">
          <h1 className="text-4xl font-bold mb-6">Dynamic DNS Management System</h1>
          <p className="text-xl mb-8">
            Keep your DNS records up to date across multiple providers with our powerful management platform.
          </p>
          <div className="space-y-6">
            <div className="flex items-start">
              <div className="mr-4 p-2 rounded-full bg-primary-foreground/10">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path>
                  <path d="m9 12 2 2 4-4"></path>
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold">Automatic Updates</h3>
                <p>Keep your DNS records in sync with your changing IP addresses.</p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="mr-4 p-2 rounded-full bg-primary-foreground/10">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect>
                  <path d="M3 9h18"></path>
                  <path d="M9 21V9"></path>
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold">Multi-Provider Support</h3>
                <p>Manage DNS records across Cloudflare, Route53, GoDaddy, and more.</p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="mr-4 p-2 rounded-full bg-primary-foreground/10">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 3v18h18"></path>
                  <path d="m19 9-5 5-4-4-3 3"></path>
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold">Comprehensive Metrics</h3>
                <p>View performance metrics and history for all your DNS records.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
