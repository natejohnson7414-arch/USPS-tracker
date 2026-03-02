
'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/main-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Package, PlusCircle, Search, CalendarClock, TrendingUp, AlertTriangle, Play, Loader2, FileBarChart } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useFirestore } from '@/firebase';
import { getAssets, generatePmWorkOrders } from '@/lib/data';
import type { Asset } from '@/lib/types';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MaterialsReportDialog } from '@/components/materials-report-dialog';

export default function AssetsPage() {
  const db = useFirestore();
  const { toast } = useToast();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunningPm, setIsRunningPm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isReportOpen, setIsReportOpen] = useState(false);

  useEffect(() => {
    if (db) {
      getAssets(db).then(setAssets).finally(() => setIsLoading(false));
    }
  }, [db]);

  const handleRunPmCheck = async () => {
    if (!db) return;
    setIsRunningPm(true);
    try {
      const result = await generatePmWorkOrders(db);
      toast({ title: 'PM Check Complete', description: `Generated ${result.count} new work orders.` });
    } catch (error) {
      toast({ title: 'PM Check Failed', variant: 'destructive' });
    } finally {
      setIsRunningPm(false);
    }
  };

  const filteredAssets = assets.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.assetTag.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.siteName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <MainLayout>
      <div className="container mx-auto py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Assets & PM</h1>
            <p className="text-muted-foreground">Manage equipment registry and preventative maintenance schedules.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => setIsReportOpen(true)} variant="outline">
              <FileBarChart className="mr-2 h-4 w-4" />
              Materials Report
            </Button>
            <Button onClick={handleRunPmCheck} disabled={isRunningPm} variant="secondary">
              {isRunningPm ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              Generate Due PMs
            </Button>
            <Button asChild>
              <Link href="/assets/new">
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Asset
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Assets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{assets.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">High Criticality</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{assets.filter(a => a.criticality === 'high').length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Out of Service</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{assets.filter(a => a.status === 'out_of_service').length}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="registry">
          <TabsList className="mb-4">
            <TabsTrigger value="registry">Equipment Registry</TabsTrigger>
            <TabsTrigger value="reports">Reports & Forecasts</TabsTrigger>
          </TabsList>

          <TabsContent value="registry">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Asset Registry</CardTitle>
                  <div className="relative w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search assets..."
                      className="pl-8"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asset Tag</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Site</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Criticality</TableHead>
                      <TableHead>Next Service</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8">Loading assets...</TableCell></TableRow>
                    ) : filteredAssets.length > 0 ? (
                      filteredAssets.map(asset => (
                        <TableRow key={asset.id}>
                          <TableCell className="font-mono font-bold">{asset.assetTag}</TableCell>
                          <TableCell>
                            <div className="font-medium">{asset.name}</div>
                            <div className="text-xs text-muted-foreground">{asset.manufacturer} {asset.model}</div>
                          </TableCell>
                          <TableCell>{asset.siteName || 'Unknown'}</TableCell>
                          <TableCell>
                            <Badge variant={asset.status === 'active' ? 'default' : 'outline'}>{asset.status}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={asset.criticality === 'high' ? 'destructive' : 'secondary'}>{asset.criticality}</Badge>
                          </TableCell>
                          <TableCell>{asset.nextServiceDate ? new Date(asset.nextServiceDate).toLocaleDateString() : 'N/A'}</TableCell>
                          <TableCell className="text-right">
                            <Button asChild variant="ghost" size="sm">
                              <Link href={`/assets/${asset.id}`}>View Details</Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No assets found.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Labor Projections</CardTitle>
                  <CardDescription>Estimated technician hours required for upcoming PMs.</CardDescription>
                </CardHeader>
                <CardContent className="h-64 flex items-center justify-center text-muted-foreground">
                  Projections Chart Placeholder
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5" /> Replacement Risk</CardTitle>
                  <CardDescription>Assets nearing the end of their expected lifecycle.</CardDescription>
                </CardHeader>
                <CardContent className="h-64 flex items-center justify-center text-muted-foreground">
                  Replacement Forecast Placeholder
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
      <MaterialsReportDialog isOpen={isReportOpen} onOpenChange={setIsReportOpen} />
    </MainLayout>
  );
}
