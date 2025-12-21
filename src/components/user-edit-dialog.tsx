'use client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AppUser, Role } from '@/lib/types';
import { useEffect, useState } from 'react';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';

interface UserEditDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  user: AppUser | null;
  roles: Role[];
  onUserSaved: (user: AppUser) => void;
}

const avatarOptions = PlaceHolderImages.filter(img => img.id.startsWith('tech-'));

export function UserEditDialog({ isOpen, setIsOpen, user, roles, onUserSaved }: UserEditDialogProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (user) {
        setName(user.name);
        setEmail(user.email);
        setRole(user.role);
        setAvatarUrl(user.avatarUrl);
      } else {
        setName('');
        setEmail('');
        setRole('');
        setAvatarUrl(avatarOptions[0]?.imageUrl || '');
      }
    }
  }, [user, isOpen]);

  const handleSave = () => {
    const savedUser: AppUser = {
      id: user?.id || '',
      name,
      email,
      role,
      avatarUrl: avatarUrl,
    };
    onUserSaved(savedUser);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{user ? 'Edit User' : 'Add New User'}</DialogTitle>
          <DialogDescription>
            {user ? 'Update the details for this user.' : 'Enter the details for the new user.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
                <AvatarImage src={avatarUrl} />
                <AvatarFallback>{name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="grid grid-cols-4 items-center gap-4 flex-1">
                <Label htmlFor="name" className="text-right">
                Name
                </Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" />
            </div>
          </div>
           <div>
                <Label>Avatar</Label>
                <div className="mt-2 grid grid-cols-5 gap-2">
                    {avatarOptions.map(image => (
                    <button
                        key={image.id}
                        type="button"
                        onClick={() => setAvatarUrl(image.imageUrl)}
                        className={cn(
                        'relative aspect-square rounded-full overflow-hidden transition-all ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                        avatarUrl === image.imageUrl ? 'ring-2 ring-primary' : 'ring-1 ring-transparent hover:ring-primary'
                        )}
                    >
                        <Image src={image.imageUrl} alt={image.description} fill sizes="64px" className="object-cover" />
                    </button>
                    ))}
                </div>
            </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="email" className="text-right">
              Email
            </Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="role" className="text-right">
              Role
            </Label>
            <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                    {roles.map(r => (
                        <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
