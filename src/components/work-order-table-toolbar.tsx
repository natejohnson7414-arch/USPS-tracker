import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search } from 'lucide-react';
import { CreateWorkOrderDialog } from './create-work-order-dialog';
import type { Technician, WorkOrder } from '@/lib/types';

interface WorkOrderTableToolbarProps {
  onSearchChange: (value: string) => void;
  onStatusChange: (status: string) => void;
  currentFilter: string;
  technicians: Technician[];
  onWorkOrderAdded: (newOrder: WorkOrder) => void;
}

const statuses = ['All', 'Open', 'In Progress', 'On Hold', 'Completed'];

export function WorkOrderTableToolbar({
  onSearchChange,
  onStatusChange,
  currentFilter,
  technicians,
  onWorkOrderAdded
}: WorkOrderTableToolbarProps) {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="relative w-full sm:max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by ID, title..."
          className="pl-10"
          onChange={e => onSearchChange(e.target.value)}
        />
      </div>
      <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
        <Tabs value={currentFilter} onValueChange={onStatusChange} className="w-full sm:w-auto">
          <TabsList className="grid w-full grid-cols-5 sm:w-auto">
            {statuses.map(status => (
              <TabsTrigger key={status} value={status}>
                {status}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <CreateWorkOrderDialog technicians={technicians} onWorkOrderAdded={onWorkOrderAdded} />
      </div>
    </div>
  );
}
