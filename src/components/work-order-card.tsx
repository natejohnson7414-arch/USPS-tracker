
'use client';
import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { WorkOrder, Technician, WorkSite } from '@/lib/types';
import { StatusBadge } from './status-badge';
import { format } from 'date-fns';
import { Button } from './ui/button';
import { Map, Link as LinkIcon, AlertCircle } from 'lucide-react';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';

interface WorkOrderCardProps {
    order: WorkOrder;
    technician?: Technician;
    workSite?: WorkSite;
    onDirectionsClick: (address: string) => void;
}

export function WorkOrderCard({ order, technician, workSite, onDirectionsClick }: WorkOrderCardProps) {
    const isValidDate = order.createdDate && !isNaN(new Date(order.createdDate).getTime());
    
    const getLinkUrl = (url: string) => {
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

    return (
        <Card className={order.needsAttention ? "border-destructive ring-1 ring-destructive/20" : ""}>
            <CardHeader>
                <div className="flex justify-between items-start gap-4">
                    <Link href={`/work-orders/${order.id}`} className="overflow-hidden">
                        <div className="flex items-center gap-2 mb-1">
                            {order.needsAttention && (
                                <Badge variant="destructive" className="h-5 px-1.5 gap-1">
                                    <AlertCircle className="h-3 w-3" />
                                    Attention
                                </Badge>
                            )}
                            <CardTitle className="hover:underline truncate">{order.jobName}</CardTitle>
                        </div>
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
            {(workSite?.address || order.checkInOutURL) && (
                 <CardFooter className="flex-col items-stretch gap-2">
                    <div className="flex gap-2">
                        {order.checkInOutURL && (
                            <Button asChild variant="secondary" className="w-full">
                                <a href={getLinkUrl(order.checkInOutURL)} target="_blank" rel="noopener noreferrer">
                                    <LinkIcon className="mr-2 h-4 w-4" />
                                    Check-in
                                </a>
                            </Button>
                        )}
                        {workSite?.address && (
                            <Button variant="outline" className="w-full" onClick={() => onDirectionsClick(workSite.address)}>
                                <Map className="mr-2 h-4 w-4" />
                                Directions
                            </Button>
                        )}
                    </div>
                    {order.checkInWorkOrderNumber && (
                        <p className="text-xs text-muted-foreground text-center pt-1">
                            Manual WO: {order.checkInWorkOrderNumber}
                        </p>
                    )}
                </CardFooter>
            )}
        </Card>
    )
}
