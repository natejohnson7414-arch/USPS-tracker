'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
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
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [workSites, setWorkSites] = useState<WorkSite[]>([]);
  
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>([]);
  const [groupBy, setGroupBy] = useState<'site' | 'category'>('site');
  const [siteSearchTerm, setSiteSearchTerm] = useState('');
  
  const [reportData, setReportData] = useState<MaterialReportGroup[] | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

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

  const handleDownloadPdf = async () => {
    if (!reportRef.current || !reportData) return;
    
    setIsExporting(true);
    const toastId = toast({ title: "Generating PDF...", description: "Converting report to document format." });

    try {
      const element = reportRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'px',
        format: [canvas.width / 2, canvas.height / 2]
      });

      pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width / 2, canvas.height / 2);
      pdf.save(`PM-Materials-Report-${selectedYear}-${selectedMonth}.pdf`);
      
      toastId.update({ id: toastId.id, title: "Download Started", description: "Your PDF has been generated." });
    } catch (error) {
      console.error("PDF generation error:", error);
      toastId.update({ id: toastId.id, title: "Export Failed", description: "Could not create PDF document.", variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      onOpenChange(open);
      if (!open) {
        setReportData(null);
        setSiteSearchTerm('');
      }
    }}>
      <DialogContent className={cn("max-w-4xl transition-all duration-300", reportData ? "h-[90vh]" : "h-auto")}>
        <style jsx global>{`
          @media print {
            body * {
              visibility: hidden;
            }
            .printable-report, .printable-report * {
              visibility: visible;
            }
            .printable-report {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              padding: 0 !important;
              margin: 0 !important;
              box-shadow: none !important;
              border: none !important;
            }
            .no-print {
              display: none !important;
            }
          }
        `}</style>
        
        <DialogHeader className="no-print">
          <DialogTitle>PM Materials Inventory Report</DialogTitle>
          <DialogDescription>
            Lists all material requirements for assets at selected sites. Highlights equipment under an active maintenance contract.
          </DialogDescription>
        </DialogHeader>

        {reportData ? (
          <div className="flex-1 flex flex-col min-h-0 space-y-4">
            <div className="flex justify-between items-center bg-muted/50 p-2 rounded-md no-print">
              <span className="text-sm font-medium">
                Materials List - Grouped by {groupBy}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-2" />Print
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={isExporting}>
                  {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                  Download PDF
                </Button>
              </div>
            </div>
            
            <ScrollArea className="flex-1 border rounded-md bg-white shadow-inner printable-report overflow-visible">
              <div ref={reportRef} className="p-8 space-y-10 max-w-3xl mx-auto bg-white">
                <div className="text-center space-y-1">
                  <h1 className="text-2xl font-bold uppercase tracking-tight">PM MATERIALS REQUIREMENTS</h1>
                  <p className="text-muted-foreground">Comprehensive Inventory for Selected Locations</p>
                  <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest pt-2">
                    Report Date: {format(new Date(), 'PPpp')}
                  </p>
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
                          <TableRow key={i} className="break-inside-avoid">
                            <TableCell className="font-medium align-top">
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
                            <TableCell className="align-top"><Badge variant="outline" className="text-[10px]">{item.category}</Badge></TableCell>
                            <TableCell className="text-right font-bold align-top">{item.quantity}</TableCell>
                            <TableCell className="text-muted-foreground align-top">{item.uom}</TableCell>
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

        <DialogFooter className="no-print">
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
