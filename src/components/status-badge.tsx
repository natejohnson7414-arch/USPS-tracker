
import { Badge } from '@/components/ui/badge';
import type { WorkOrder } from '@/lib/types';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: WorkOrder['status'];
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const variant: Record<WorkOrder['status'], "default" | "secondary" | "outline" | "destructive"> = {
    Open: 'default',
    'In Progress': 'secondary',
    'On Hold': 'outline',
    Review: 'secondary',
    Completed: 'default',
  };
  
  const color: Record<WorkOrder['status'], string> = {
    Open: 'bg-accent text-accent-foreground',
    'In Progress': 'bg-blue-500 text-white',
    'On Hold': 'bg-yellow-500 text-black',
    Review: 'bg-orange-500 text-white',
    Completed: 'bg-green-600 text-white',
  }

  return (
    <Badge variant={variant[status]} className={cn('capitalize', color[status], 'hover:' + color[status])}>
      {status}
    </Badge>
  );
}
