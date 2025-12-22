
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
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { WorkOrder, Technician, WorkSite } from '@/lib/types';
import { StatusBadge } from './status-badge';
import { format } from 'date-fns';
import { Button } from './ui/button';
import { Map, User } from 'lucide-react';
import { Separator } from './ui/separator';
import { useState } from 'react';
import { MapProviderSelection } from './map-provider-selection';

interface WorkOrderTableProps {
  workOrders: WorkOrder[];
  technicians: Technician[];
  workSites: WorkSite[];
}

function WorkOrderCard({ order, technician, workSite, onDirectionsClick }: { order: WorkOrder, technician?: Technician, workSite?: WorkSite, onDirectionsClick: (address: string) => void }) {
    const isValidDate = order.createdDate && !isNaN(new Date(order.createdDate).getTime());
    
    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start gap-4">
                    <Link href={`/work-orders/${order.id}`}>
                        <CardTitle className="hover:underline">{order.jobName}</CardTitle>
                        <p className="text-sm text-muted-foreground">Job # {order.id}</p>
                    </Link>
                    <StatusBadge status={order.status} />
                </div>
                 {order.customerPO && (
                    <div className="text-xs text-muted-foreground pt-1">PO: {order.customerPO}</div>
                  )}
            </CardHeader>
            <CardContent className="space-y-3">
                 <p className="text-sm text-muted-foreground truncate">{order.description}</p>
                 <Separator />
                <div className="flex items-center justify-between text-sm">
                    <p className="text-muted-foreground">Assigned To</p>
                     {technician ? (
                        <div className="flex items-center gap-2 font-medium">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={technician.avatarUrl} alt={technician.name} />
                              <AvatarFallback>{technician.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span>{technician.name}</span>
                        </div>
                    ) : (
                      <span className="text-muted-foreground font-medium">Unassigned</span>
                    )}
                </div>
                 <div className="flex items-center justify-between text-sm">
                    <p className="text-muted-foreground">Date</p>
                    <p className="font-medium">
                        {isValidDate ? format(new Date(order.createdDate), 'MMM d, yyyy') : 'Invalid Date'}
                    </p>
                </div>
            </CardContent>
            {workSite?.address && (
                 <CardFooter>
                    <Button variant="outline" className="w-full" onClick={() => onDirectionsClick(workSite.address)}>
                        <Map className="mr-2 h-4 w-4" />
                        Get Directions
                    </Button>
                </CardFooter>
            )}
        </Card>
    )
}

export function WorkOrderTable({ workOrders, technicians, workSites }: WorkOrderTableProps) {
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  
  const getTechnician = (id?: string) => technicians.find(t => t.id === id);
  const getWorkSite = (id?: string) => workSites.find(ws => ws.id === id);
  
  const handleDirectionsClick = (address: string) => {
    setSelectedAddress(address);
  };

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
      <div className="grid gap-4 md:hidden">
        {workOrders.map(order => {
          const technician = getTechnician(order.assignedTechnicianId);
          const workSite = getWorkSite(order.workSiteId);
          return (
            <WorkOrderCard key={order.id} order={order} technician={technician} workSite={workSite} onDirectionsClick={handleDirectionsClick} />
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
                  <TableHead className="w-[80px] text-right">Actions</TableHead>
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
                          {workSite?.address && (
                              <Button variant="outline" size="icon" onClick={() => handleDirectionsClick(workSite.address)}>
                                  <Map className="h-4 w-4" />
                                  <span className="sr-only">Get Directions</span>
                              </Button>
                          )}
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
