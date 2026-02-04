
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Wrench, Loader2 } from 'lucide-react';
import { useAuth, useUser, useFirestore, updateDocumentNonBlocking } from '@/firebase';
import { updatePassword } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { doc } from 'firebase/firestore';
import { useTechnician } from '@/hooks/use-technician';

export default function ChangePasswordPage() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { user, isUserLoading } = useUser();
  const { passwordChangeRequired, isLoading: isTechnicianLoading } = useTechnician();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (!isUserLoading && !isTechnicianLoading && user && !passwordChangeRequired) {
      router.replace('/');
    }
  }, [user, isUserLoading, isTechnicianLoading, passwordChangeRequired, router]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({ title: 'Not authenticated', variant: 'destructive' });
      return;
    }
    if (newPassword.length < 6) {
        toast({ title: 'Password is too short', description: 'Password must be at least 6 characters.', variant: 'destructive'});
        return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'Passwords do not match', variant: 'destructive' });
      return;
    }

    setIsSaving(true);

    try {
      await updatePassword(user, newPassword);
      
      const userDocRef = doc(db, 'technicians', user.uid);
      await updateDocumentNonBlocking(userDocRef, { passwordChangeRequired: false });

      toast({ title: 'Password Updated', description: 'Your password has been changed successfully.' });
      router.push('/');
    } catch (error: any) {
      console.error('Error changing password:', error);
      let errorMessage = 'Could not change password. You may need to log out and log back in.';
      if(error.code === 'auth/requires-recent-login') {
        errorMessage = 'This operation is sensitive and requires recent authentication. Log in again before retrying this request.';
      }
      toast({ title: 'Error', description: error.message || errorMessage, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isUserLoading || isTechnicianLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
          <p>Loading...</p>
      </div>
    );
  }
  
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
            <Wrench className="h-8 w-8 text-primary" />
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Change Your Password</CardTitle>
            <CardDescription>Please choose a new password for your account.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordChange}>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Set New Password
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
