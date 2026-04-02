'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { MainLayout } from '@/components/main-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Package, PlusCircle, Search, CalendarClock, TrendingUp, AlertTriangle, Loader2, FileBarChart, ChevronRight, Building, Box, Sparkles, Wrench, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useFirestore, useUser } from '@/firebase/provider';
import { getAssets, getAssetPmSchedules, generatePmWorkOrdersForMonth, getPmWorkOrders, seedDatabase, getActiveContracts } from '@/lib/data';
import type { Asset, AssetPmSchedule, PmWorkOrder, MaintenanceContract } from '@/lib/types';
import { generateLaborForecast, type LaborForecast } from '@/lib/reporting-service';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MaterialsReportDialog } from '@/components/materials-report-dialog';
import { format, addMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO, differenceInMonths } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell } from 'recharts';

export default function AssetsPageContent() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [assets, setAssets] = useState<Asset[]>([]);
  const [schedules, setSchedules] = useState<AssetPmSchedule[]>([]);
  const [activeContracts, setActiveContracts] = useState<MaintenanceContract[]>([]);
  const [laborForecast, setLaborForecast] = useState<LaborForecast[]>([]);
  const [pmWorkOrders, setPmWorkOrders] = useState<PmWorkOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const fetchData = useCallback(async () => {
    if (db && user) {
      setIsLoading(true);
      try {
        await seedDatabase(db);
        const [a, s, l, pwo, c] = await Promise.all([
          getAssets(db),
          getAssetPmSchedules(db),
          generateLaborForecast(db),
          getPmWorkOrders(db),
          getActiveContracts(db)
        ]);
        
        // Filter schedules by active contracts immediately
        const contractSiteIds = new Set(c.map(contract => contract.siteId));
        const validSchedules = s.filter(sch => sch.siteId && contractSiteIds.has(sch.siteId));
        
        setAssets(a);
        setSchedules(validSchedules);
        setActiveContracts(c);
        setLaborForecast(l);
        setPmWorkOrders(pwo);
      } catch (e) {
        console.error("[Assets] Data fetch failed:", e);
      } finally {
        setIsLoading(false);
      }
    }
  }, [db, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleGeneratePmOrders = async () => {
    if (!db) return;
    setIsGenerating(true);
    try {
      const now = new Date();
      const count = await generatePmWorkOrdersForMonth(db, now.getMonth() + 1, now.getFullYear());
      
      if (count > 0) {
        toast({ title: "PM Generation Complete", description: `Created ${count} master site work orders.` });
      } else {
        toast({ title: "No Action Needed", description: "All PMs for this month are already scheduled or none are due." });
      }
      
      fetchData();
    } catch (e: any) {
      console.error("PM Generation Error:", e);
      toast({ title: "Generation Failed", description: e.message || "An internal error occurred.", variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const filteredAssets = useMemo(() => {
    return assets.filter(a => 
      a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      a.assetTag.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.siteName?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [assets, searchTerm]);

  const planningMonths = useMemo(() => {
    const months = [];
    const today = new Date();
    for (let i = 0; i < 12; i++) {
      months.push(addMonths(today, i));
    }
    return months;
  }, []);

  const getSchedulesForMonth = useCallback((monthDate: Date) => {
    const targetStart = startOfMonth(monthDate);
    const targetEnd = endOfMonth(monthDate);

    return schedules.filter(s => {
      if (s.status !== 'active') return false;
      const startDueDate = parseISO(s.nextDueDate);
      if (isWithinInterval(startDueDate, { start: targetStart, end: targetEnd })) return true;
      if (startDueDate < targetStart) {
        const monthsDiff = differenceInMonths(targetStart, startDueDate);
        switch (s.frequencyType) {
          case 'monthly': return true;
          case 'quarterly': return monthsDiff % 3 === 0;
          case 'semiannual': return monthsDiff % 6 === 0;
          case 'annual': return monthsDiff % 12 === 0;
          default: return false;
        }
      }
      return false;
    });
  }, [schedules]);

  return (
    <MainLayout>
      <div className="container mx-auto py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Equipment Registry & PM</h1>
            <p className="text-muted-foreground">Manage service history and seasonal maintenance cycles.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleGeneratePmOrders} disabled={isGenerating} variant="outline" className="bg-primary/5 border-primary/20 text-primary">
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Generate This Month's PMs
            </Button>
            <Button onClick={() => setIsReportOpen(true)} variant="outline">
              <FileBarChart className="mr-2 h-4 w-4" />
              Materials Report
            </Button>
            <Button asChild>
              <Link href="/assets/new">
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Equipment
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Equipment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{assets.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Master PMs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{pmWorkOrders.filter(wo => wo.status !== 'Completed').length}</div>
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
        </div>

        <Tabs defaultValue="calendar">
          <TabsList className="mb-4">
            <TabsTrigger value="calendar">PM Planning Calendar</TabsTrigger>
            <TabsTrigger value="active-pms">Current Master PMs</TabsTrigger>
            <TabsTrigger value="registry">Equipment Registry</TabsTrigger>
            <TabsTrigger value="reports">Labor Projections</TabsTrigger>
          </TabsList>

          <TabsContent value="active-pms">
            <Card>
              <CardHeader>
                <CardTitle>Open Master Preventative Maintenance Jobs</CardTitle>
                <CardDescription>Site-level master records containing all unit checklists for the period.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job Status</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Scope</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pmWorkOrders.filter(wo => wo.status !== 'Completed').map(wo => (
                      <TableRow key={wo.id}>
                        <TableCell><Badge variant={wo.status === 'In Progress' ? 'default' : 'secondary'}>{wo.status}</Badge></TableCell>
                        <TableCell>
                          <div className="font-medium flex items-center gap-2">
                            <Building className="h-4 w-4 text-muted-foreground" />
                            {wo.workSiteName}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span className="text-sm font-bold">{wo.assetTasks.length} Pieces of Equipment</span>
                            <div className="flex flex-wrap gap-1">
                              {wo.assetTasks.slice(0, 3).map((g, i) => (
                                <Badge key={i} variant="outline" className="text-[10px] py-0">{g.assetTag}</Badge>
                              ))}
                              {wo.assetTasks.length > 3 && <span className="text-[10px] text-muted-foreground">+{wo.assetTasks.length - 3} more</span>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild size="sm">
                            <Link href={`/pm-work-orders/${wo.id}`}>Open Master Checklists</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {pmWorkOrders.filter(wo => wo.status !== 'Completed').length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No master PM work orders generated for the current period.</TableCell></TableRow>
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
                <CardDescription>Indefinite recurring timeline of preventative maintenance by site.</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px] pr-4">
                  <div className="space-y-8">
                    {planningMonths.map((month, idx) => {
                      const monthSchedules = getSchedulesForMonth(month);
                      const totalMonthHours = monthSchedules.reduce((acc, s) => acc + (s.estimatedLaborHours || 0), 0);
                      const techsNeeded = Math.ceil(totalMonthHours / 140);

                      const sitesDue = Array.from(new Set(monthSchedules.map(s => s.siteId))).map(siteId => {
                        const siteSchedules = monthSchedules.filter(s => s.siteId === siteId);
                        return {
                          id: siteId!,
                          name: siteSchedules[0]?.siteName,
                          count: siteSchedules.length,
                          totalHours: siteSchedules.reduce((acc, s) => acc + (s.estimatedLaborHours || 0), 0)
                        };
                      });

                      return (
                        <div key={idx} className="relative pl-8 border-l pb-4 last:pb-0">
                          <div className={cn(
                            "absolute left-[-9px] top-0 h-4 w-4 rounded-full border-2 bg-background transition-colors",
                            sitesDue.length > 0 ? "border-primary" : "border-muted"
                          )} />
                          <div className="mb-4">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                              <h3 className="text-lg font-bold">
                                {format(month, 'MMMM yyyy')}
                              </h3>
                              <div className="flex wrap items-center gap-2">
                                {sitesDue.length > 0 && (
                                  <>
                                    <Badge variant="secondary">{sitesDue.length} Master Site Jobs</Badge>
                                    <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary">
                                      <Wrench className="h-3 w-3 mr-1" /> {totalMonthHours} Hours
                                    </Badge>
                                    <Badge variant="outline" className="bg-accent/5 border-accent/20 text-accent">
                                      <Users className="h-3 w-3 mr-1" /> {techsNeeded} {techsNeeded === 1 ? 'Tech' : 'Techs'}
                                    </Badge>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {sitesDue.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                              {sitesDue.map(site => (
                                <Link key={site.id} href={`/work-sites/${site.id}`}>
                                  <Card className="hover:bg-muted/50 transition-colors cursor-pointer border-l-4 border-l-primary">
                                    <CardContent className="p-4 flex items-center justify-between">
                                      <div className="space-y-1">
                                        <p className="font-bold text-sm truncate max-w-[180px]">{site.name}</p>
                                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                                          <span className="flex items-center gap-1"><Package className="h-3 w-3" /> {site.count} Pieces</span>
                                          <span className="flex items-center gap-1 font-semibold text-foreground"><Wrench className="h-3 w-3" /> {site.totalHours} hrs</span>
                                        </div>
                                      </div>
                                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                    </CardContent>
                                  </Card>
                                </Link>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground italic">No maintenance projected for this month.</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="registry">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Equipment Registry</CardTitle>
                  <div className="relative w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search equipment..."
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
                      <TableHead>Equipment Type</TableHead>
                      <TableHead>Site</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Criticality</TableHead>
                      <TableHead>Repeat Cycle</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8">Loading equipment...</TableCell></TableRow>
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
                                <div className="flex flex-col">
                                  <Badge variant="outline" className="capitalize w-fit">{nextPm.frequencyType}</Badge>
                                  <span className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1"><Wrench className="h-2.5 w-2.5" /> {nextPm.estimatedLaborHours} hrs</span>
                                </div>
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
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No equipment found.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports">
            <div className="grid grid-cols-1 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Estimated Labor Demand</CardTitle>
                  <CardDescription>Projected man-hours required for scheduled Master PM cycles over the next 12 months.</CardDescription>
                </CardHeader>
                <CardContent className="h-[400px] pt-10">
                  {laborForecast.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={laborForecast}>
                        <XAxis 
                          dataKey="month" 
                          stroke="#888888" 
                          fontSize={12} 
                          tickLine={false} 
                          axisLine={false} 
                        />
                        <YAxis 
                          stroke="#888888" 
                          fontSize={12} 
                          tickLine={false} 
                          axisLine={false} 
                          tickFormatter={(value) => `${value}h`}
                        />
                        <Tooltip 
                          cursor={{fill: 'transparent'}}
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="rounded-lg border bg-background p-2 shadow-sm">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="flex flex-col">
                                      <span className="text-[0.70rem] uppercase text-muted-foreground">
                                        Month
                                      </span>
                                      <span className="font-bold text-muted-foreground">
                                        {payload[0].payload.month}
                                      </span>
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-[0.70rem] uppercase text-muted-foreground">
                                        Est. Hours
                                      </span>
                                      <span className="font-bold text-primary">
                                        {payload[0].value}h
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
                          {laborForecast.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill="hsl(var(--primary))" fillOpacity={0.8 - (index * 0.04)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                      <Loader2 className="h-8 w-8 animate-spin mb-4" />
                      <p>Calculating labor forecast...</p>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-bold flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Capacity Risk</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm">
                    <p className="text-muted-foreground">
                      The peak labor requirement is <span className="font-bold text-foreground">{Math.max(...laborForecast.map(f => f.hours))} hours</span>. 
                      Ensure your team has the available bandwidth for these months.
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-bold flex items-center gap-2"><Building className="h-4 w-4" /> Logistics</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm">
                    <p className="text-muted-foreground">
                      Maintenance is grouped by Master Site Job. Consolidated master work orders reduce call-in/out overhead.
                    </p>
                  </CardContent>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
      <MaterialsReportDialog isOpen={isReportOpen} onOpenChange={setIsReportOpen} />
    </MainLayout>
  );
}
