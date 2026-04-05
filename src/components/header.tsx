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
import { LogOut, User, Users, Clock, Loader2, RefreshCw, WifiOff, CheckCircle2, Settings } from 'lucide-react';
import { useAuth, useUser, useFirestore, useFirebase } from '@/firebase/provider';
import { signOut } from 'firebase/auth';
import { Sidebar } from './sidebar';
import { useTechnician } from '@/hooks/use-technician';
import { PrimaryNav } from './primary-nav';
import { useState, useEffect } from 'react';
import type { Technician, WorkSite, Client } from '@/lib/types';
import { getTechnicians, getWorkSites, getClients } from '@/lib/data';
import { cn } from '@/lib/utils';
import { Badge } from './ui/badge';


export function Header() {
  const { user, isOnline, isSyncing } = useFirebase();
  const { technician, role, isLoading } = useTechnician();
  const auth = useAuth();
  const db = useFirestore();
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [workSites, setWorkSites] = useState<WorkSite[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleAddWorkSite = (newSite: WorkSite) => {
    setWorkSites(prev => [newSite, ...prev]);
  };

  useEffect(() => {
    const fetchCoreData = async () => {
      if (!db || !user) return;
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
    
    if(db && user) {
        fetchCoreData();
    }
  }, [db, user]);


  const handleLogout = async () => {
    if (auth) {
      await signOut(auth);
      window.location.href = '/login';
    }
  };

  const handleManualSync = async () => {
    setIsRefreshing(true);
    // Standard window reload will trigger the SyncManager to re-cache
    // and Firestore to attempt re-syncing listeners
    setTimeout(() => {
        window.location.reload();
    }, 500);
  };

  const getInitials = (name?: string) => {
    if (!name) return '';
    return name.split(' ').map(n => n[0]).join('');
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card shadow-sm">
      <div className="container flex h-16 items-center">
        <Sidebar />
         <div className={cn(role?.name !== 'Technician' && "ml-6")}>
          <PrimaryNav 
            technicians={technicians}
            workSites={workSites}
            clients={clients}
            onWorkSiteAdded={handleAddWorkSite}
          />
        </div>
        {user && (
          <div className="ml-auto flex items-center gap-4">
            {!isOnline && (
                <Badge variant="destructive" className="hidden sm:flex gap-1 animate-pulse">
                    <WifiOff className="h-3 w-3" />
                    Offline Mode
                </Badge>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={technician?.avatarUrl} alt={technician?.name || ''} />
                    <AvatarFallback>
                      {isLoading ? <Loader2 className="animate-spin" /> : getInitials(technician?.name) || <User />}
                    </AvatarFallback>
                  </Avatar>
                  {isSyncing && (
                      <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span>
                      </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{technician?.name || user.email}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {role?.name || 'User'}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                <div className="px-2 py-3 space-y-2">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider px-2">Local Sync Status</p>
                    <div className="flex items-center justify-between px-2 bg-muted/50 p-2 rounded-md">
                        <div className="flex items-center gap-2">
                            {isOnline ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : (
                                <WifiOff className="h-4 w-4 text-destructive" />
                            )}
                            <span className="text-xs font-medium">{isOnline ? 'Cloud Connected' : 'Offline Mode'}</span>
                        </div>
                        {isOnline && (
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleManualSync} disabled={isRefreshing}>
                                <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
                            </Button>
                        )}
                    </div>
                    <div className="flex items-center gap-2 px-2">
                        {isSyncing ? (
                            <>
                                <Loader2 className="h-3 w-3 animate-spin text-sky-500" />
                                <span className="text-[10px] text-muted-foreground">Reconciling changes...</span>
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="h-3 w-3 text-muted-foreground" />
                                <span className="text-[10px] text-muted-foreground">Local data up to date</span>
                            </>
                        )}
                    </div>
                </div>

                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
                 <DropdownMenuItem asChild>
                  <Link href="/timesheet">
                    <Clock className="mr-2 h-4 w-4" />
                    <span>My Timesheet</span>
                  </Link>
                </DropdownMenuItem>
                {role?.name !== 'Technician' && (
                  <DropdownMenuItem asChild>
                    <Link href="/users">
                      <Users className="mr-2 h-4 w-4" />
                      <span>Users</span>
                    </Link>
                  </DropdownMenuItem>
                )}
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