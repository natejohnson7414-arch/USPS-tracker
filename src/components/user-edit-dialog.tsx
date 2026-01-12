
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
import { useEffect, useState, useRef } from 'react';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { useFirestore, setDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Upload, X } from 'lucide-react';

interface UserEditDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  user: AppUser | null;
  roles: Role[];
  onUserSaved: () => void;
}

const avatarOptions = PlaceHolderImages.filter(img => img.id.startsWith('tech-'));

export function UserEditDialog({ isOpen, setIsOpen, user, roles, onUserSaved }: UserEditDialogProps) {
  const db = useFirestore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (user) {
        const userRole = roles.find(r => r.name === user.role);
        setName(user.name);
        setEmail(user.email);
        setRoleId(userRole?.id || '');
        setAvatarUrl(user.avatarUrl || null);
      } else {
        // Reset for new user
        setName('');
        setEmail('');
        setRoleId('');
        setAvatarUrl(avatarOptions[0]?.imageUrl || null);
      }
    }
  }, [user, isOpen, roles]);

  const handleSave = () => {
    if (!db) return;
    const [firstName, ...lastNameParts] = name.split(' ');
    const lastName = lastNameParts.join(' ');

    const userData = {
      firstName,
      lastName,
      email,
      roleId,
      avatarUrl: avatarUrl,
    };
    
    let userRef;
    let isNewUser = false;
    
    if (user) {
      userRef = doc(db, 'technicians', user.id);
    } else {
      isNewUser = true;
      const newId = `tech-${Date.now()}`;
      userRef = doc(db, 'technicians', newId);
      // For new users, we add the ID to the data itself
      (userData as any).id = newId;
    }

    setDocumentNonBlocking(userRef, userData, { merge: !isNewUser });

    onUserSaved();
    setIsOpen(false);
  };
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = e => {
        setAvatarUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
    event.target.value = ''; // Reset input
  };
  
  const handleRemoveAvatar = () => {
    setAvatarUrl(null);
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
                <AvatarImage src={avatarUrl ?? undefined} />
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
                <div className="mt-2 flex items-center gap-2">
                    {avatarOptions.map(image => (
                    <button
                        key={image.id}
                        type="button"
                        onClick={() => setAvatarUrl(image.imageUrl)}
                        className={cn(
                        'relative h-12 w-12 rounded-full overflow-hidden transition-all ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                        avatarUrl === image.imageUrl ? 'ring-2 ring-primary' : 'ring-1 ring-transparent hover:ring-primary'
                        )}
                    >
                        <Image src={image.imageUrl} alt={image.description} fill sizes="48px" className="object-cover" />
                    </button>
                    ))}
                     <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                     <Button variant="outline" size="icon" className="h-12 w-12 rounded-full" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="h-5 w-5"/>
                        <span className="sr-only">Upload Photo</span>
                    </Button>
                    <Button variant="outline" size="icon" className="h-12 w-12 rounded-full" onClick={handleRemoveAvatar}>
                        <X className="h-5 w-5"/>
                        <span className="sr-only">Remove Avatar</span>
                    </Button>
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
            <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                    {roles.map(r => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
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
