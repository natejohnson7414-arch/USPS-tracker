
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { PanelLeft, Wrench, Package2, Users, MapPin, Building, FileSignature, Box } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { useTechnician } from '@/hooks/use-technician';

const navLinks = [
  { href: '/users', label: 'Users', icon: Users },
  { href: '/work-sites', label: 'Work Sites', icon: MapPin },
  { href: '/clients', label: 'Clients', icon: Building },
  { href: '/contracts', label: 'Contracts', icon: FileSignature },
  { href: '/materials', label: 'Materials Catalog', icon: Box },
];

export function Sidebar() {
  const pathname = usePathname();
  const { role } = useTechnician();
  const [isOpen, setIsOpen] = useState(false);

  const isTechnician = role?.name === 'Technician';

  const filteredNavLinks = isTechnician
    ? navLinks.filter(link => !['/users', '/clients', '/work-sites', '/contracts', '/materials'].includes(link.href))
    : navLinks;

  // For technicians, we don't need the sidebar functionality.
  if (isTechnician) {
    return null;
  }

  // For other roles, render the sidebar with its trigger.
  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <div className="flex items-center gap-4">
        <SheetTrigger asChild>
           <Button variant="ghost" className="sm:hidden">
              <PanelLeft className="h-5 w-5" />
              <span className="sr-only">Toggle Menu</span>
            </Button>
        </SheetTrigger>
        <SheetTrigger asChild>
            <Button variant="ghost" className="hidden sm:flex items-center gap-2 font-bold text-lg p-0 h-auto">
               <Wrench className="h-6 w-6 text-primary" />
              <span className="font-headline">USPS WO Tracker</span>
            </Button>
        </SheetTrigger>
      </div>
      <SheetContent side="left" className="sm:max-w-xs p-0">
        <SheetHeader className="p-6 border-b">
          <SheetTitle asChild>
              <Link
                href="/"
                className="flex items-center gap-2 font-bold text-lg"
                onClick={() => setIsOpen(false)}
              >
                <Package2 className="h-6 w-6 text-primary" />
                <span className="font-headline">USPS WO Tracker</span>
              </Link>
            </SheetTitle>
        </SheetHeader>
        <nav className="grid gap-2 p-4 text-lg font-medium">
          {filteredNavLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={label}
              href={href}
              className={cn(
                'flex items-center gap-4 px-2.5 py-2 text-muted-foreground hover:text-foreground rounded-lg',
                pathname === href && 'bg-muted text-foreground'
              )}
              onClick={() => setIsOpen(false)}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
