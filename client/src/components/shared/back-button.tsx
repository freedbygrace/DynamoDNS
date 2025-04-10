import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface BackButtonProps {
  href: string;
  label?: string;
}

export function BackButton({ href, label = 'Back' }: BackButtonProps) {
  return (
    <Link href={href}>
      <Button
        variant="ghost"
        size="sm"
        className="mb-4 gap-1 pl-0 hover:pl-1 transition-all"
      >
        <ArrowLeft className="h-4 w-4" />
        {label}
      </Button>
    </Link>
  );
}