'use client';

import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogOut, User, Users, Clock, Loader2 } from 'lucide-react';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { signOut } from 'firebase/auth';
import { Sidebar } from './sidebar';
import { useTechnician } from '@/hooks/use-technician';
import { PrimaryNav } from './primary-nav';
import { useState, useEffect } from 'react';
import type { Technician, WorkSite, Client } from '@/lib/types';
import { getTechnicians, getWorkSites, getClients } from '@/lib/data';


export function Header() {
  const { user } = useUser();
  const { technician, role, isLoading } = useTechnician();
  const auth = useAuth();
  const db = useFirestore();
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [workSites, setWorkSites] = useState<WorkSite[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  const handleAddWorkSite = (newSite: WorkSite) => {
    setWorkSites(prev => [newSite, ...prev]);
  };

  useEffect(() => {
    const fetchCoreData = async () => {
      if (!db) return;
       try {
        const [fetchedTechnicians, fetchedWorkSites, fetchedClients] = await Promise.all([
          getTechnicians(db),
          getWorkSites(db),
          getClients(db),
        ]);
        setTechnicians(fetchedTechnicians);
        setWorkSites(fetchedWorkSites);
        setClients(fetchedClients);
      } catch (error) {
        console.error("Failed to fetch header data:", error);
      }
    };
    
    if(db) {
        fetchCoreData();
    }
  }, [db]);


  const handleLogout = async () => {
    if (auth) {
      await signOut(auth);
      // Use window.location to force a full page reload and avoid Next.js router cache issues on logout.
      window.location.href = '/login';
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return '';
    return name.split(' ').map(n => n[0]).join('');
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card shadow-sm">
      <div className="container flex h-16 items-center">
        <Sidebar />
         <div className="ml-6">
          <PrimaryNav 
            technicians={technicians}
            workSites={workSites}
            clients={clients}
            onWorkSiteAdded={handleAddWorkSite}
          />
        </div>
        {user && (
          <div className="ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={technician?.avatarUrl} alt={technician?.name || ''} />
                    <AvatarFallback>
                      {isLoading ? <Loader2 className="animate-spin" /> : getInitials(technician?.name) || <User />}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{technician?.name || user.email}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {role?.name || 'User'}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                 <DropdownMenuItem asChild>
                  <Link href="/timesheet">
                    <Clock className="mr-2 h-4 w-4" />
                    <span>My Timesheet</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/users">
                    <Users className="mr-2 h-4 w-4" />
                    <span>Users</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </header>
  );
}
