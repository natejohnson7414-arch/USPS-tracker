
'use client';

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
import { Badge } from '@/components/ui/badge';
import type { AppUser } from '@/lib/types';
import { ShieldCheck, User, MoreHorizontal, EyeOff } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

interface UsersTableProps {
  users: AppUser[];
  onEditUser: (user: AppUser) => void;
  onDeleteUser: (user: AppUser) => void;
  onToggleDisableUser: (user: AppUser) => void;
}

export function UsersTable({ users, onEditUser, onDeleteUser, onToggleDisableUser }: UsersTableProps) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Employee ID</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="w-[180px]">Role</TableHead>
              <TableHead className="w-[80px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length > 0 ? (
              users.map(user => (
                <TableRow key={user.id} className={cn(user.disabled && 'bg-muted/50 opacity-60')}>
                  <TableCell>
                    <div className="flex items-center gap-4">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name} />
                        <AvatarFallback>
                          {user.name
                            .split(' ')
                            .map(n => n[0])
                            .join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="font-medium">{user.name}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-muted-foreground">{user.employeeId}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-muted-foreground">{user.email}</div>
                  </TableCell>
                  <TableCell>
                     <div className="flex items-center gap-2">
                        <Badge
                        variant={user.role === 'Administrator' ? 'default' : 'secondary'}
                        className="capitalize gap-1.5 pl-2"
                        >
                        {user.role === 'Administrator' ? (
                            <ShieldCheck className="h-3.5 w-3.5" />
                        ) : (
                            <User className="h-3.5 w-3.5" />
                        )}
                        {user.role}
                        </Badge>
                        {user.disabled && (
                            <Badge variant="destructive" className="capitalize gap-1.5 pl-2">
                                <EyeOff className="h-3.5 w-3.5" />
                                Disabled
                            </Badge>
                        )}
                    </div>
                  </TableCell>
                   <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">User Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEditUser(user)}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onToggleDisableUser(user)}>
                          {user.disabled ? 'Enable' : 'Disable'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={() => onDeleteUser(user)}
                            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                        >
                            Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  No users found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
