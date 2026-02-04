
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search } from 'lucide-react';
import type { Technician, Role } from '@/lib/types';
import { ScrollArea } from './ui/scroll-area';

interface WorkOrderTableToolbarProps {
  onSearchChange: (value: string) => void;
  onStatusChange: (status: string) => void;
  currentStatusFilter: string;
  onAssignedToChange: (technicianId: string) => void;
  currentAssignedToFilter: string;
  technicians: Technician[];
  currentUserRole: Role | null;
}

const statuses = ['All', 'Open', 'In Progress', 'On Hold', 'Completed'];

export function WorkOrderTableToolbar({
  onSearchChange,
  onStatusChange,
  currentStatusFilter,
  onAssignedToChange,
  currentAssignedToFilter,
  technicians,
  currentUserRole
}: WorkOrderTableToolbarProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="relative w-full md:max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by ID, title..."
          className="pl-10"
          onChange={e => onSearchChange(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center w-full md:w-auto">
        <Select value={currentAssignedToFilter} onValueChange={onAssignedToChange}>
            <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by technician..." />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="All">All Technicians</SelectItem>
                {technicians.map(tech => (
                    <SelectItem key={tech.id} value={tech.id}>{tech.name}</SelectItem>
                ))}
            </SelectContent>
        </Select>
        <Tabs value={currentStatusFilter} onValueChange={onStatusChange} className="w-full sm:w-auto">
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
      </div>
    </div>
  );
}
