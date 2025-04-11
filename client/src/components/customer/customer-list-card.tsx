import { useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useCustomer } from "@/context/customer-context";
import { Customer } from "@shared/schema";
import { Calendar, Server, Users } from "lucide-react";

interface CustomerListCardProps {
  customers: Customer[];
}

export function CustomerListCard({ customers }: CustomerListCardProps) {
  const { currentCustomer, setCurrentCustomer } = useCustomer();

  if (!customers || customers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Customers</CardTitle>
          <CardDescription>
            You don't have any customers yet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-40">
            <p className="text-muted-foreground">
              Create a customer in the settings page.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customers</CardTitle>
        <CardDescription>
          Select a customer to manage their domains and DNS records
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {customers.map((customer) => (
            <div
              key={customer.id}
              className={`p-3 rounded-md cursor-pointer transition-colors border ${
                currentCustomer?.id === customer.id ? "bg-accent border-primary/50" : "hover:bg-muted/50 border-transparent"
              }`}
              onClick={() => setCurrentCustomer(customer)}
            >
              <div className="flex justify-between items-center mb-2">
                <div className="font-medium flex items-center">
                  <Server className="h-4 w-4 mr-2 text-primary" />
                  {customer.name}
                  {!customer.isActive && (
                    <span className="ml-2 text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300 rounded-full px-2 py-0.5">
                      Inactive
                    </span>
                  )}
                </div>
              </div>
              <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3">
                <div className="flex items-center">
                  <Users className="h-3 w-3 mr-1" />
                  <span>3 Members</span>
                </div>
                <div className="flex items-center">
                  <Calendar className="h-3 w-3 mr-1" />
                  <span>Created {format(new Date(customer.createdAt), 'MMM d, yyyy')}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}