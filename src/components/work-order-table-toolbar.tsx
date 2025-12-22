import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search } from 'lucide-react';
import { CreateWorkOrderDialog } from './create-work-order-dialog';
import type { Technician, WorkOrder, WorkSite } from '@/lib/types';
import { ScrollArea } from './ui/scroll-area';

interface WorkOrderTableToolbarProps {
  onSearchChange: (value: string) => void;
  onStatusChange: (status: string) => void;
  currentFilter: string;
  technicians: Technician[];
  workSites: WorkSite[];
  onWorkOrderAdded: (newOrder: WorkOrder) => void;
}

const statuses = ['All', 'Open', 'In Progress', 'On Hold', 'Completed'];

export function WorkOrderTableToolbar({
  onSearchChange,
  onStatusChange,
  currentFilter,
  technicians,
  workSites,
  onWorkOrderAdded
}: WorkOrderTableToolbarProps) {
  return (
    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
      <div className="relative w-full md:max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by ID, title..."
          className="pl-10"
          onChange={e => onSearchChange(e.target.value)}
        />
      </div>
      <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
        <Tabs value={currentFilter} onValueChange={onStatusChange} className="w-full sm:w-auto">
          <ScrollArea className="w-full sm:w-auto whitespace-nowrap">
            <TabsList className="w-full sm:w-auto">
              {statuses.map(status => (
                <TabsTrigger key={status} value={status}>
                  {status}
                </TabsTrigger>
              ))}
            </TabsList>
          </ScrollArea>
        </Tabs>
        <CreateWorkOrderDialog technicians={technicians} workSites={workSites} onWorkOrderAdded={onWorkOrderAdded} />
      </div>
    </div>
  );
}
