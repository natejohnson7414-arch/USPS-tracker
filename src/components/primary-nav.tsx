'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { CreateWorkOrderDialog } from './create-work-order-dialog';
import type { Technician, WorkSite, Client } from '@/lib/types';
import { Home, LayoutDashboard, Receipt } from 'lucide-react';
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
                <Button asChild className={cn(
                    "text-white font-semibold",
                    pathname === '/' 
                        ? 'bg-blue-600 hover:bg-blue-700' 
                        : 'bg-blue-500 hover:bg-blue-600'
                )}>
                    <Link href="/">
                        <Home className="mr-2" />
                        Work Orders
                    </Link>
                </Button>
                <Button asChild className={cn(
                    "text-white font-semibold",
                    pathname === '/dispatch' 
                        ? 'bg-green-600 hover:bg-green-700'
                        : 'bg-green-500 hover:bg-green-600'
                )}>
                    <Link href="/dispatch">
                        <LayoutDashboard className="mr-2" />
                        Dispatch Board
                    </Link>
                </Button>
                {!isTechnician && (
                    <Button asChild className={cn(
                        "text-white font-semibold",
                        pathname.startsWith('/quotes') 
                            ? 'bg-purple-600 hover:bg-purple-700'
                            : 'bg-purple-500 hover:bg-purple-600'
                    )}>
                        <Link href="/quotes">
                            <Receipt className="mr-2" />
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
