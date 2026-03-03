
'use client';

import { useState, useEffect, useMemo } from 'react';
import { MainLayout } from '@/components/main-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Package, PlusCircle, Search, CalendarClock, TrendingUp, AlertTriangle, Play, Loader2, FileBarChart, ChevronRight, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useFirestore } from '@/firebase';
import { getAssets, getAssetPmSchedules } from '@/lib/data';
import type { Asset, AssetPmSchedule } from '@/lib/types';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MaterialsReportDialog } from '@/components/materials-report-dialog';
import { format, addMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function AssetsPage() {
  const db = useFirestore();
  const { toast } = useToast();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [schedules, setSchedules] = useState<AssetPmSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isReportOpen, setIsReportOpen] = useState(false);

  useEffect(() => {
    if (db) {
      setIsLoading(true);
      Promise.all([
        getAssets(db),
        getAssetPmSchedules(db)
      ]).then(([a, s]) => {
        setAssets(a);
        setSchedules(s);
      }).finally(() => setIsLoading(false));
    }
  }, [db]);

  const filteredAssets = assets.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.assetTag.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.siteName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Generate 12 months for the calendar
  const planningMonths = useMemo(() => {
    const months = [];
    const today = new Date();
    for (let i = 0; i < 12; i++) {
      months.push(addMonths(today, i));
    }
    return months;
  }, []);

  const getSchedulesForMonth = (monthDate: Date) => {
    const start = startOfMonth(monthDate);
    const end = endOfMonth(monthDate);
    return schedules.filter(s => {
      const dueDate = parseISO(s.nextDueDate);
      return isWithinInterval(dueDate, { start, end }) && s.status === 'active';
    });
  };

  return (
    <MainLayout>
      <div className="container mx-auto py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Assets & PM</h1>
            <p className="text-muted-foreground">Manage equipment registry and preventative maintenance planning.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => setIsReportOpen(true)} variant="outline">
              <FileBarChart className="mr-2 h-4 w-4" />
              Materials Report
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
              <CardTitle className="text-sm font-medium text-muted-foreground">Due This Month</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {getSchedulesForMonth(new Date()).length}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="registry">
          <TabsList className="mb-4">
            <TabsTrigger value="registry">Equipment Registry</TabsTrigger>
            <TabsTrigger value="calendar">PM Planning Calendar</TabsTrigger>
            <TabsTrigger value="reports">Forecasts</TabsTrigger>
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
                      <TableHead>Planned PM</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8">Loading assets...</TableCell></TableRow>
                    ) : filteredAssets.length > 0 ? (
                      filteredAssets.map(asset => {
                        const nextPm = schedules.find(s => s.assetId === asset.id && s.status === 'active');
                        return (
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
                            <TableCell>
                              {nextPm ? (
                                <span className="text-sm font-medium">{format(parseISO(nextPm.nextDueDate), 'MMMM yyyy')}</span>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">Not planned</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button asChild variant="ghost" size="sm">
                                <Link href={`/assets/${asset.id}`}>View Details</Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No assets found.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="calendar">
            <Card>
              <CardHeader>
                <CardTitle>Maintenance Planning Calendar</CardTitle>
                <CardDescription>Visual timeline of upcoming preventative maintenance by site.</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px] pr-4">
                  <div className="space-y-8">
                    {planningMonths.map((month, idx) => {
                      const monthSchedules = getSchedulesForMonth(month);
                      const sitesDue = Array.from(new Set(monthSchedules.map(s => s.siteId))).map(siteId => {
                        return {
                          id: siteId,
                          name: monthSchedules.find(s => s.siteId === siteId)?.siteName,
                          count: monthSchedules.filter(s => s.siteId === siteId).length
                        };
                      });

                      return (
                        <div key={idx} className="relative pl-8 border-l pb-4 last:pb-0">
                          <div className={cn(
                            "absolute left-[-9px] top-0 h-4 w-4 rounded-full border-2 bg-background transition-colors",
                            sitesDue.length > 0 ? "border-primary" : "border-muted"
                          )} />
                          <div className="mb-4">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                              {format(month, 'MMMM yyyy')}
                              {sitesDue.length > 0 && <Badge variant="secondary">{sitesDue.length} Sites Due</Badge>}
                            </h3>
                          </div>
                          
                          {sitesDue.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                              {sitesDue.map(site => (
                                <Link key={site.id} href={`/work-sites/${site.id}`}>
                                  <Card className="hover:bg-muted/50 transition-colors cursor-pointer border-l-4 border-l-primary">
                                    <CardContent className="p-4 flex items-center justify-between">
                                      <div className="space-y-1">
                                        <p className="font-bold text-sm truncate max-w-[180px]">{site.name}</p>
                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                          <Package className="h-3 w-3" /> {site.count} Units Scheduled
                                        </p>
                                      </div>
                                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                    </CardContent>
                                  </Card>
                                </Link>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground italic">No maintenance planned for this month.</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
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
                <CardContent className="h-64 flex flex-col items-center justify-center text-muted-foreground bg-muted/20 rounded-md m-6 border-2 border-dashed">
                  <TrendingUp className="h-8 w-8 mb-2 opacity-20" />
                  <p className="text-sm">Forecast charts available in Materials Report</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5" /> Replacement Risk</CardTitle>
                  <CardDescription>Assets nearing the end of their expected lifecycle.</CardDescription>
                </CardHeader>
                <CardContent className="h-64 flex flex-col items-center justify-center text-muted-foreground bg-muted/20 rounded-md m-6 border-2 border-dashed">
                  <AlertTriangle className="h-8 w-8 mb-2 opacity-20" />
                  <p className="text-sm">Lifecycle tracking available in Asset Details</p>
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
