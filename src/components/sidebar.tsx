'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { PanelLeft, Wrench, Package2, Home, Users, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const navLinks = [
  { href: '/', label: 'Work Orders', icon: Home },
  { href: '/users', label: 'Users', icon: Users },
  { href: '/work-sites', label: 'Work Sites', icon: MapPin },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

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
              <span className="font-headline">WorkFlow</span>
            </Button>
        </SheetTrigger>
      </div>
      <SheetContent side="left" className="sm:max-w-xs">
        <nav className="grid gap-6 text-lg font-medium">
          <Link
            href="/"
            className="group flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:text-base"
             onClick={() => setIsOpen(false)}
          >
            <Package2 className="h-5 w-5 transition-all group-hover:scale-110" />
            <span className="sr-only">WorkFlow</span>
          </Link>
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={label}
              href={href}
              className={cn(
                'flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground',
                pathname === href && 'text-foreground'
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
