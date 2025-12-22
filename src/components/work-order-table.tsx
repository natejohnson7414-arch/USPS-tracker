
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
import type { WorkOrder, Technician, WorkSite } from '@/lib/types';
import { StatusBadge } from './status-badge';
import { format } from 'date-fns';
import { Button } from './ui/button';
import { Map } from 'lucide-react';

interface WorkOrderTableProps {
  workOrders: WorkOrder[];
  technicians: Technician[];
  workSites: WorkSite[];
}

export function WorkOrderTable({ workOrders, technicians, workSites }: WorkOrderTableProps) {
  const getTechnician = (id?: string) => technicians.find(t => t.id === id);
  const getWorkSite = (id?: string) => workSites.find(ws => ws.id === id);
  
  const handleDirectionsClick = (address: string) => {
    if (address) {
      const query = encodeURIComponent(address);
      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
    }
  };

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[150px]">Job #</TableHead>
              <TableHead>Job Name</TableHead>
              <TableHead className="w-[120px]">Status</TableHead>
              <TableHead className="w-[180px]">Assigned To</TableHead>
              <TableHead className="w-[180px]">Date</TableHead>
              <TableHead className="w-[80px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workOrders.length > 0 ? (
              workOrders.map(order => {
                const technician = getTechnician(order.assignedTechnicianId);
                const workSite = getWorkSite(order.workSiteId);
                const isValidDate = order.createdDate && !isNaN(new Date(order.createdDate).getTime());
                return (
                  <TableRow key={order.id}>
                    <TableCell>
                      <Link href={`/work-orders/${order.id}`} className="font-medium text-accent hover:underline">
                        {order.id}
                      </Link>
                      {order.customerPO && (
                        <div className="text-xs text-muted-foreground mt-1">PO: {order.customerPO}</div>
                      )}
                    </TableCell>
                    <TableCell>
                       <Link href={`/work-orders/${order.id}`} className="block">
                        <div className="font-medium">{order.jobName}</div>
                        <div className="text-sm text-muted-foreground truncate max-w-xs">{order.description}</div>
                      </Link>
                    </TableCell>
                    <TableCell>
                       <Link href={`/work-orders/${order.id}`} className="block">
                        <StatusBadge status={order.status} />
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
                        <div className="font-medium">
                            {isValidDate ? format(new Date(order.createdDate), 'MMM d, yyyy') : 'Invalid Date'}
                        </div>
                      </Link>
                    </TableCell>
                     <TableCell className="text-right">
                        {workSite?.address && (
                            <Button variant="outline" size="icon" onClick={() => handleDirectionsClick(workSite.address)}>
                                <Map className="h-4 w-4" />
                                <span className="sr-only">Get Directions</span>
                            </Button>
                        )}
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
