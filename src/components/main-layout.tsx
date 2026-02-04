
'use client';
import React from 'react';
import { Header } from './header';
import { useUser } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { useTechnician } from '@/hooks/use-technician';

export function MainLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const { passwordChangeRequired, isLoading: isTechnicianLoading } = useTechnician();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  React.useEffect(() => {
    if (!isUserLoading && !isTechnicianLoading && user && passwordChangeRequired && pathname !== '/change-password') {
      router.replace('/change-password');
    }
  }, [user, isUserLoading, isTechnicianLoading, passwordChangeRequired, pathname, router]);


  if (isUserLoading || isTechnicianLoading) {
    return (
        <div className="flex min-h-screen items-center justify-center">
            <p>Loading...</p>
        </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
          <p>Redirecting to login...</p>
      </div>
    );
  }

  if (passwordChangeRequired) {
    return (
        <div className="flex min-h-screen items-center justify-center">
            <p>Redirecting...</p>
        </div>
    );
  }


  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">{children}</main>
    </div>
  );
}
