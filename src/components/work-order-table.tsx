import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { WorkOrder, Technician } from '@/lib/types';
import { StatusBadge } from './status-badge';
import { PriorityIcon } from './priority-icon';
import { format } from 'date-fns';
import { DueDateTooltip } from './due-date-tooltip';

interface WorkOrderTableProps {
  workOrders: WorkOrder[];
  technicians: Technician[];
}

export function WorkOrderTable({ workOrders, technicians }: WorkOrderTableProps) {
  const getTechnician = (id?: string) => technicians.find(t => t.id === id);

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Order ID</TableHead>
              <TableHead>Title</TableHead>
              <TableHead className="w-[120px]">Status</TableHead>
              <TableHead className="w-[120px]">Priority</TableHead>
              <TableHead className="w-[180px]">Assigned To</TableHead>
              <TableHead className="w-[180px]">Due Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workOrders.length > 0 ? (
              workOrders.map(order => {
                const technician = getTechnician(order.assignedTechnicianId);
                return (
                  <TableRow key={order.id} className="cursor-pointer">
                    <TableCell>
                      <Link href={`/work-orders/${order.id}`} className="font-medium text-accent hover:underline">
                        {order.id}
                      </Link>
                    </TableCell>
                    <TableCell>
                       <Link href={`/work-orders/${order.id}`} className="block">
                        <div className="font-medium">{order.title}</div>
                        <div className="text-sm text-muted-foreground truncate max-w-xs">{order.description}</div>
                      </Link>
                    </TableCell>
                    <TableCell>
                       <Link href={`/work-orders/${order.id}`} className="block">
                        <StatusBadge status={order.status} />
                       </Link>
                    </TableCell>
                    <TableCell>
                       <Link href={`/work-orders/${order.id}`} className="block">
                        <PriorityIcon priority={order.priority} />
                       </Link>
                    </TableCell>
                    <TableCell>
                       <Link href={`/work-orders/${order.id}`} className="flex items-center gap-2">
                        {technician ? (
                          <>
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={technician.avatarUrl} alt={technician.name} />
                              <AvatarFallback>{technician.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span>{technician.name}</span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">Unassigned</span>
                        )}
                       </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/work-orders/${order.id}`} className="block">
                        <DueDateTooltip dueDate={order.dueDate} />
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  No work orders found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
