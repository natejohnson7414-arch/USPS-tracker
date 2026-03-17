'use client';

import { useState } from 'react';
import { MainLayout } from '@/components/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTechnician } from '@/hooks/use-technician';
import { useTheme } from '@/components/theme-provider';
import { updateDocumentNonBlocking, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { cn } from '@/lib/utils';
import { Check, Moon, Sun, Monitor, Loader2, User as UserIcon } from 'lucide-react';
import Image from 'next/image';

const avatarOptions = PlaceHolderImages.filter(img => img.id.startsWith('tech-'));

export default function SettingsPage() {
  const { technician, isLoading } = useTechnician();
  const { theme, setTheme } = useTheme();
  const db = useFirestore();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const handleAvatarChange = async (url: string) => {
    if (!db || !technician) return;
    
    setIsSaving(true);
    try {
      const techRef = doc(db, 'technicians', technician.id);
      await updateDocumentNonBlocking(techRef, { avatarUrl: url });
      toast({ title: 'Profile Picture Updated' });
    } catch (error) {
      toast({ 
        title: 'Update Failed', 
        description: 'Check your connection and try again.', 
        variant: 'destructive' 
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto py-8 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">App Settings</h1>
          <p className="text-muted-foreground">Personalize your application experience.</p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <UserIcon className="h-5 w-5 text-primary" />
                Profile Customization
              </CardTitle>
              <CardDescription>Select an avatar to display in work logs and job assignments.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-8 items-center sm:items-start">
                <div className="relative h-24 w-24 rounded-full overflow-hidden border-4 border-muted ring-2 ring-primary/10 shrink-0">
                  <Avatar className="h-full w-full">
                    <AvatarImage src={technician?.avatarUrl} />
                    <AvatarFallback><UserIcon className="h-12 w-12 text-muted-foreground" /></AvatarFallback>
                  </Avatar>
                  {isSaving && (
                    <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  )}
                </div>
                
                <div className="space-y-4 flex-1">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Select New Avatar</Label>
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                    {avatarOptions.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => handleAvatarChange(option.imageUrl)}
                        disabled={isSaving}
                        className={cn(
                          "relative h-12 w-12 rounded-full overflow-hidden border-2 transition-all hover:scale-110 active:scale-95",
                          technician?.avatarUrl === option.imageUrl 
                            ? "border-primary ring-2 ring-primary/20" 
                            : "border-transparent opacity-70 hover:opacity-100"
                        )}
                      >
                        <Image src={option.imageUrl} alt={option.description} fill className="object-cover" sizes="48px" />
                        {technician?.avatarUrl === option.imageUrl && (
                          <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
                            <div className="bg-primary text-white rounded-full p-0.5">
                              <Check className="h-3 w-3" />
                            </div>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sun className="h-5 w-5 text-primary" />
                Display Theme
              </CardTitle>
              <CardDescription>Choose between Light, Dark, or System mode for optimal field visibility.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Button
                  variant={theme === 'light' ? 'default' : 'outline'}
                  className={cn(
                    "flex flex-col h-24 gap-2 transition-all",
                    theme === 'light' && "ring-2 ring-primary/20"
                  )}
                  onClick={() => setTheme('light')}
                >
                  <Sun className="h-6 w-6" />
                  <span className="font-bold">Light</span>
                </Button>
                
                <Button
                  variant={theme === 'dark' ? 'default' : 'outline'}
                  className={cn(
                    "flex flex-col h-24 gap-2 transition-all",
                    theme === 'dark' && "ring-2 ring-primary/20"
                  )}
                  onClick={() => setTheme('dark')}
                >
                  <Moon className="h-6 w-6" />
                  <span className="font-bold">Dark</span>
                </Button>
                
                <Button
                  variant={theme === 'system' ? 'default' : 'outline'}
                  className={cn(
                    "flex flex-col h-24 gap-2 transition-all",
                    theme === 'system' && "ring-2 ring-primary/20"
                  )}
                  onClick={() => setTheme('system')}
                >
                  <Monitor className="h-6 w-6" />
                  <span className="font-bold">System</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
