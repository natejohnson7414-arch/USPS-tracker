import { ChevronUp, ChevronsUp, Equal, ChevronDown, ChevronsDown } from 'lucide-react';
import type { WorkOrder } from '@/lib/types';
import { cn } from '@/lib/utils';

interface PriorityIconProps {
  priority: WorkOrder['priority'];
}

export function PriorityIcon({ priority }: PriorityIconProps) {
  const priorityInfo = {
    High: { icon: ChevronsUp, color: 'text-primary' },
    Medium: { icon: Equal, color: 'text-yellow-500' },
    Low: { icon: ChevronsDown, color: 'text-gray-500' },
  };

  const { icon: Icon, color } = priorityInfo[priority];

  return (
    <div className="flex items-center gap-2">
      <Icon className={cn('h-4 w-4', color)} />
      <span className="capitalize">{priority}</span>
    </div>
  );
}
