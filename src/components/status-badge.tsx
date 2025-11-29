import { Badge } from '@/components/ui/badge';
import type { WorkOrder } from '@/lib/types';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: WorkOrder['status'];
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const variant = {
    Open: 'default',
    'In Progress': 'secondary',
    'On Hold': 'outline',
    Completed: 'default',
  } as const;
  
  const color = {
    Open: 'bg-accent text-accent-foreground',
    'In Progress': 'bg-blue-500 text-white',
    'On Hold': 'bg-yellow-500 text-black',
    Completed: 'bg-green-600 text-white',
  }

  return (
    <Badge variant={variant[status]} className={cn('capitalize', color[status], 'hover:'+color[status])}>
      {status}
    </Badge>
  );
}
