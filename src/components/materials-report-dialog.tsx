'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { useFirestore } from '@/firebase/provider';
import { getWorkSites } from '@/lib/data';
import type { WorkSite, MaterialReportGroup } from '@/lib/types';
import { generateMaterialsReport } from '@/lib/reporting-service';
import { Loader2, Printer, X, Download, FileText, Search, CheckCircle2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface MaterialsReportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function MaterialsReportDialog({ isOpen, onOpenChange }: MaterialsReportDialogProps) {
  const db = useFirestore();
  const [isLoading, setIsLoading] = useState(false);
  const [workSites, setWorkSites] = useState<WorkSite[]>([]);
  
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>([]);
  const [groupBy, setGroupBy] = useState<'site' | 'category'>('site');
  const [siteSearchTerm, setSiteSearchTerm] = useState('');
  
  const [reportData, setReportData] = useState<MaterialReportGroup[] | null>(null);

  useEffect(() => {
    if (db && isOpen) {
      getWorkSites(db).then(sites => {
        setWorkSites([...sites].sort((a, b) => a.name.localeCompare(b.name)));
      });
    }
  }, [db, isOpen]);

  const filteredSites = useMemo(() => {
    return workSites.filter(site => 
      site.name.toLowerCase().includes(siteSearchTerm.toLowerCase()) ||
      site.address.toLowerCase().includes(siteSearchTerm.toLowerCase())
    );
  }, [workSites, siteSearchTerm]);

  const handleToggleSite = (siteId: string) => {
    setSelectedSiteIds(prev => 
      prev.includes(siteId) ? prev.filter(id => id !== siteId) : [...prev, siteId]
    );
  };

  const handleSelectAllSites = (checked: boolean) => {
    if (siteSearchTerm) {
      const filteredIds = filteredSites.map(s => s.id);
      if (checked) {
        setSelectedSiteIds(prev => Array.from(new Set([...prev, ...filteredIds])));
      } else {
        setSelectedSiteIds(prev => prev.filter(id => !filteredIds.includes(id)));
      }
    } else {
      setSelectedSiteIds(checked ? workSites.map(s => s.id) : []);
    }
  };

  const handleGenerate = async () => {
    if (!db) return;
    setIsLoading(true);
    try {
      const data = await generateMaterialsReport(
        db, 
        parseInt(selectedYear), 
        parseInt(selectedMonth), 
        selectedSiteIds, 
        groupBy
      );
      setReportData(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() + i).toString());

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      onOpenChange(open);
      if (!open) {
        setReportData(null);
        setSiteSearchTerm('');
      }
    }}>
      <DialogContent className={cn("max-w-4xl transition-all duration-300", reportData ? "h-[90vh]" : "h-auto")}>
        <DialogHeader>
          <DialogTitle>PM Materials Inventory Report</DialogTitle>
          <DialogDescription>
            Lists all material requirements for assets at selected sites. Highlights equipment under an active maintenance contract.
          </DialogDescription>
        </DialogHeader>

        {reportData ? (
          <div className="flex-1 flex flex-col min-h-0 space-y-4">
            <div className="flex justify-between items-center bg-muted/50 p-2 rounded-md">
              <span className="text-sm font-medium">
                Materials List - Grouped by {groupBy}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" />Print</Button>
              </div>
            </div>
            
            <ScrollArea className="flex-1 border rounded-md p-6 bg-white shadow-inner printable-report">
              <div className="space-y-10 max-w-3xl mx-auto">
                <div className="text-center space-y-1">
                  <h1 className="text-2xl font-bold uppercase tracking-tight">PM MATERIALS REQUIREMENTS</h1>
                  <p className="text-muted-foreground">Comprehensive Inventory for Selected Locations</p>
                </div>

                {reportData.map((group, idx) => (
                  <div key={idx} className="space-y-4">
                    <h2 className="text-lg font-bold border-b pb-1 flex items-center gap-2">
                      {groupBy === 'site' ? <FileText className="h-4 w-4" /> : null}
                      {group.groupName}
                    </h2>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-1/2">Material Description</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead>UOM</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.items.map((item, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">
                              <div className="text-sm">{item.name}</div>
                              <div className="text-[10px] text-muted-foreground mt-2 space-y-1.5">
                                <p className="font-bold uppercase tracking-wider text-[9px]">Affected Equipment:</p>
                                {item.affectedAssets.map((asset, aIdx) => (
                                  <div key={aIdx} className={cn(
                                    "flex flex-col gap-0.5 border-l-2 pl-2 py-0.5 transition-colors",
                                    asset.hasContract ? "border-green-500 bg-green-50/50" : "border-muted"
                                  )}>
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono bg-muted px-1 rounded inline-block w-fit">{asset.tag} - {asset.name}</span>
                                      {asset.hasContract && (
                                        <Badge variant="outline" className="h-4 text-[8px] bg-green-600 text-white border-0 uppercase font-black px-1.5 flex items-center gap-1">
                                          <CheckCircle2 className="h-2 w-2" /> Contracted
                                        </Badge>
                                      )}
                                    </div>
                                    {asset.notes && (
                                      <span className="bg-yellow-200 text-black px-1.5 py-0.5 rounded italic inline-block w-fit text-[9px]">
                                        Note: {asset.notes}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell><Badge variant="outline" className="text-[10px]">{item.category}</Badge></TableCell>
                            <TableCell className="text-right font-bold">{item.quantity}</TableCell>
                            <TableCell className="text-muted-foreground">{item.uom}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ))}

                {reportData.length === 0 && (
                  <div className="text-center py-20 text-muted-foreground">
                    No equipment or materials found for the selected sites.
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        ) : (
          <div className="grid gap-6 py-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center mb-2">
                <Label className="text-base font-bold">Target Locations</Label>
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="all-sites" 
                    checked={selectedSiteIds.length === workSites.length && workSites.length > 0} 
                    onCheckedChange={handleSelectAllSites} 
                  />
                  <label htmlFor="all-sites" className="text-xs text-muted-foreground cursor-pointer">
                    {siteSearchTerm ? 'Select Filtered' : 'Select All Sites'}
                  </label>
                </div>
              </div>
              
              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search sites by name or address..." 
                  className="pl-8 h-9 text-sm"
                  value={siteSearchTerm}
                  onChange={(e) => setSiteSearchTerm(e.target.value)}
                />
              </div>

              <ScrollArea className="h-48 border rounded-md p-2 bg-muted/10">
                <div className="space-y-2">
                  {filteredSites.map(site => (
                    <div key={site.id} className="flex items-center space-x-2 p-1 hover:bg-background rounded-sm transition-colors">
                      <Checkbox 
                        id={`site-${site.id}`} 
                        checked={selectedSiteIds.includes(site.id)} 
                        onCheckedChange={() => handleToggleSite(site.id)} 
                      />
                      <label htmlFor={`site-${site.id}`} className="text-sm font-medium leading-none cursor-pointer flex-1">
                        {site.name}
                        <span className="block text-[10px] text-muted-foreground">{site.address}</span>
                      </label>
                    </div>
                  ))}
                  {filteredSites.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-8">No sites match your search.</p>
                  )}
                </div>
              </ScrollArea>
            </div>

            <div className="space-y-3">
              <Label>Report Grouping</Label>
              <RadioGroup value={groupBy} onValueChange={(v: any) => setGroupBy(v)} className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="site" id="group-site" />
                  <Label htmlFor="group-site">By Site</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="category" id="group-cat" />
                  <Label htmlFor="group-cat">By Material Category</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        )}

        <DialogFooter>
          {!reportData && (
            <Button onClick={handleGenerate} disabled={isLoading} className="w-full">
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Generate Comprehensive Report
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
