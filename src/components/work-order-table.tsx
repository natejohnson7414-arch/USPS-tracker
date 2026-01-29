

'use client';
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
import { Map, Link as LinkIcon } from 'lucide-react';
import { useState } from 'react';
import { MapProviderSelection } from './map-provider-selection';
import { WorkOrderCard } from './work-order-card';

interface WorkOrderTableProps {
  workOrders: WorkOrder[];
  technicians: Technician[];
  workSites: WorkSite[];
}

export function WorkOrderTable({ workOrders, technicians, workSites }: WorkOrderTableProps) {
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  
  const getTechnician = (id?: string) => technicians.find(t => t.id === id);
  const getWorkSite = (id?: string) => workSites.find(ws => ws.id === id);
  
  const handleDirectionsClick = (workSite: WorkSite) => {
    if (!workSite.address) return;
    const fullAddress = [workSite.address, workSite.city, workSite.state].filter(Boolean).join(', ');
    setSelectedAddress(fullAddress);
  };
  
  const getLinkUrl = (url?: string) => {
    if (!url) return '#';
    if (url.startsWith('http')) {
        return url;
    }
    // If it has digits, assume it's a phone number.
    if (/\d/.test(url)) {
        // Convert ';' to 'w' for waiting, then strip invalid characters.
        const sanitizedPhone = url.replace(/;/g, 'w').replace(/[^0-9+,w#*]/g, '');
        return `tel:${sanitizedPhone}`;
    }
    return url;
  }

  if (workOrders.length === 0) {
    return (
      <>
        <div className="text-center py-12 text-muted-foreground">
          No work orders found.
        </div>
         <MapProviderSelection 
            address={selectedAddress} 
            isOpen={!!selectedAddress} 
            onOpenChange={() => setSelectedAddress(null)} 
        />
      </>
    );
  }

  return (
    <>
      {/* Mobile View */}
      <div className="space-y-4 md:hidden">
        {workOrders.map(order => {
          const technician = getTechnician(order.assignedTechnicianId);
          const workSite = getWorkSite(order.workSiteId);
          return (
            <WorkOrderCard key={order.id} order={order} technician={technician} workSite={workSite} onDirectionsClick={() => workSite && handleDirectionsClick(workSite)} />
          );
        })}
      </div>
      
      {/* Desktop View */}
      <div className="hidden md:block">
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
                  <TableHead className="w-[120px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workOrders.map(order => {
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
                          <div className="flex flex-col items-end gap-1">
                            <div className="flex justify-end gap-2">
                                {order.checkInOutURL && (
                                  <Button asChild variant="outline" size="icon">
                                      <a href={getLinkUrl(order.checkInOutURL)} target="_blank" rel="noopener noreferrer">
                                          <LinkIcon className="h-4 w-4" />
                                          <span className="sr-only">Check-in</span>
                                      </a>
                                  </Button>
                                )}
                                {workSite?.address && (
                                    <Button variant="outline" size="icon" onClick={() => handleDirectionsClick(workSite)}>
                                        <Map className="h-4 w-4" />
                                        <span className="sr-only">Get Directions</span>
                                    </Button>
                                )}
                            </div>
                             {order.checkInWorkOrderNumber && (
                                <p className="text-xs text-muted-foreground pr-1">Manual WO: {order.checkInWorkOrderNumber}</p>
                            )}
                          </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

       <MapProviderSelection 
            address={selectedAddress} 
            isOpen={!!selectedAddress} 
            onOpenChange={() => setSelectedAddress(null)} 
        />
    </>
  );
}
