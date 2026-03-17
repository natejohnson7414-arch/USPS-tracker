
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { CreateWorkOrderDialog } from './create-work-order-dialog';
import type { Technician, WorkSite, Client } from '@/lib/types';
import { Home, LayoutDashboard, Receipt, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTechnician } from '@/hooks/use-technician';

interface PrimaryNavProps {
  technicians: Technician[];
  workSites: WorkSite[];
  clients: Client[];
  onWorkSiteAdded: (newSite: WorkSite) => void;
}

export function PrimaryNav({ technicians, workSites, clients, onWorkSiteAdded }: PrimaryNavProps) {
    const pathname = usePathname();
    const { role } = useTechnician();
    const isTechnician = role?.name === 'Technician';

    return (
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
                <Button asChild variant="ghost" className={cn(
                    "font-semibold",
                    pathname === '/' && "bg-muted"
                )}>
                    <Link href="/">
                        <Home className="mr-2 h-4 w-4" />
                        Work Orders
                    </Link>
                </Button>
                <Button asChild variant="ghost" className={cn(
                    "font-semibold",
                    pathname === '/dispatch' && "bg-muted"
                )}>
                    <Link href="/dispatch">
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        Dispatch
                    </Link>
                </Button>
                {!isTechnician && (
                    <Button asChild variant="ghost" className={cn(
                        "font-semibold",
                        pathname.startsWith('/assets') && "bg-muted"
                    )}>
                        <Link href="/assets">
                            <Package className="mr-2 h-4 w-4" />
                            Assets & PM
                        </Link>
                    </Button>
                )}
                {!isTechnician && (
                    <Button asChild variant="ghost" className={cn(
                        "font-semibold",
                        pathname.startsWith('/quotes') && "bg-muted"
                    )}>
                        <Link href="/quotes">
                            <Receipt className="mr-2 h-4 w-4" />
                            Quotes
                        </Link>
                    </Button>
                )}
            </div>
            {!isTechnician && (
                <CreateWorkOrderDialog 
                    technicians={technicians} 
                    workSites={workSites} 
                    clients={clients} 
                    onWorkSiteAdded={onWorkSiteAdded}
                />
            )}
        </div>
    )
}
