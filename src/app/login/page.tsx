import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Wrench } from 'lucide-react';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
         <div className="flex justify-center mb-6">
            <Link href="/" className="flex items-center gap-3 text-2xl font-bold">
              <Wrench className="h-8 w-8 text-primary" />
              <span className="font-headline">WorkFlow</span>
            </Link>
         </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Technician Login</CardTitle>
            <CardDescription>Enter your credentials to access your work orders.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="m@example.com" required />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                </div>
                <Input id="password" type="password" required />
              </div>
              <Button type="submit" className="w-full" asChild>
                <Link href="/">Login</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
