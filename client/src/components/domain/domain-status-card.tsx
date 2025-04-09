import { ReactNode } from "react";
import { Card } from "@/components/ui/card";

interface DomainStatusCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  iconClassName?: string;
}

export function DomainStatusCard({ title, value, icon, iconClassName = "bg-primary/10 text-primary" }: DomainStatusCardProps) {
  return (
    <Card className="shadow-sm p-5 border border-border">
      <div className="flex items-center">
        <div className={`p-2 rounded-full mr-4 ${iconClassName}`}>
          {icon}
        </div>
        <div>
          <p className="text-muted-foreground text-sm font-medium">{title}</p>
          <h3 className="text-2xl font-semibold mt-1">{value}</h3>
        </div>
      </div>
    </Card>
  );
}
