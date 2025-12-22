
'use client';
import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { WorkOrder, Technician, WorkSite } from '@/lib/types';
import { StatusBadge } from './status-badge';
import { format } from 'date-fns';
import { Button } from './ui/button';
import { Map } from 'lucide-react';
import { Separator } from './ui/separator';

interface WorkOrderCardProps {
    order: WorkOrder;
    technician?: Technician;
    workSite?: WorkSite;
    onDirectionsClick: (address: string) => void;
}

export function WorkOrderCard({ order, technician, workSite, onDirectionsClick }: WorkOrderCardProps) {
    const isValidDate = order.createdDate && !isNaN(new Date(order.createdDate).getTime());
    
    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start gap-4">
                    <Link href={`/work-orders/${order.id}`} className="overflow-hidden">
                        <CardTitle className="hover:underline truncate">{order.jobName}</CardTitle>
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
