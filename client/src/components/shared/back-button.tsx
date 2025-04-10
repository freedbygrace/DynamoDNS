import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { useLocation } from "wouter";

interface BackButtonProps {
  to?: string;
  fallbackPath?: string;
  className?: string;
}

export function BackButton({ to, fallbackPath = "/", className = "" }: BackButtonProps) {
  const [_, setLocation] = useLocation();
  
  const handleBack = () => {
    if (to) {
      setLocation(to);
    } else if (window.history.length > 2) {
      window.history.back();
    } else {
      setLocation(fallbackPath);
    }
  };
  
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleBack}
      className={`flex items-center gap-1 px-2 ${className}`}
    >
      <ChevronLeft className="h-4 w-4" />
      <span>Back</span>
    </Button>
  );
}