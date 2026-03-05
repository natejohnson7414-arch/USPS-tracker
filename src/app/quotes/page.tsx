
'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { MainLayout } from '@/components/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Ban, Loader2, Receipt } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { useTechnician } from '@/hooks/use-technician';
import { getQuotes } from '@/lib/data';
import type { Quote } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function QuoteStatusBadge({ status }: { status: Quote['status'] }) {
  const variant = {
    Draft: 'secondary',
    Sent: 'default',
    Accepted: 'default',
    Rejected: 'destructive',
    Archived: 'outline',
  } as const;
  
  const color = {
    Draft: 'bg-gray-200 text-gray-800',
    Sent: 'bg-blue-500 text-white',
    Accepted: 'bg-green-600 text-white',
    Rejected: 'bg-red-600 text-white',
    Archived: 'bg-gray-500 text-white'
  }

  return (
    <Badge variant={variant[status]} className={cn('capitalize', color[status], `hover:${color[status]}`)}>
      {status}
    </Badge>
  );
}

const quoteStatuses: (Quote['status'] | 'All')[] = ['All', 'Draft', 'Sent', 'Accepted', 'Rejected', 'Archived'];

export default function QuotesPage() {
    const db = useFirestore();
    const { role, isLoading: isRoleLoading } = useTechnician();
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<Quote['status'] | 'All'>('All');

    useEffect(() => {
        if (!db || isRoleLoading) return;
        
        getQuotes(db)
            .then(setQuotes)
            .finally(() => setIsLoading(false));
    }, [db, isRoleLoading]);

    const filteredQuotes = useMemo(() => {
        if (statusFilter === 'All') {
            return quotes;
        }
        return quotes.filter(quote => quote.status === statusFilter);
    }, [quotes, statusFilter]);


    if (isRoleLoading || isLoading) {
        return (
            <MainLayout>
                <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <p className="ml-4">Loading Quotes...</p>
                </div>
            </MainLayout>
        )
    }

  return (
    <MainLayout>
      <div className="container mx-auto py-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Quotes</h1>
            <p className="text-muted-foreground">
              Manage and track all customer quotes.
            </p>
          </div>
           <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as Quote['status'] | 'All')}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filter by status..." />
            </SelectTrigger>
            <SelectContent>
              {quoteStatuses.map(status => (
                <SelectItem key={status} value={status}>{status}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <Card>
            <CardHeader>
                <CardTitle>All Quotes</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Quote #</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Job Name</TableHead>
                            <TableHead>Created By</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredQuotes.length > 0 ? filteredQuotes.map(quote => (
                            <TableRow key={quote.id}>
                                <TableCell>
                                    <Link href={`/quotes/${quote.id}`} className="font-medium text-primary hover:underline">
                                        {quote.quoteNumber}
                                    </Link>
                                </TableCell>
                                <TableCell>{format(new Date(quote.createdDate), 'MMM d, yyyy')}</TableCell>
                                <TableCell>{quote.jobName}</TableCell>
                                <TableCell>{quote.createdBy_technician?.name || 'N/A'}</TableCell>
                                <TableCell><QuoteStatusBadge status={quote.status} /></TableCell>
                                <TableCell className="text-right font-mono">
                                    {quote.total.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                                </TableCell>
                            </TableRow>
                        )) : (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                    <Receipt className="mx-auto h-12 w-12" />
                                    <p className="mt-4">No quotes found for this status.</p>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
