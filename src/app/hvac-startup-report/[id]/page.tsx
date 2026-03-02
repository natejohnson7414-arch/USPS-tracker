
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MainLayout } from '@/components/main-layout';
import { Card, CardContent } from '@/components/ui/card';
import { notFound, useParams, useRouter, useSearchParams } from 'next/navigation';
import { useFirestore, deleteDocumentNonBlocking } from '@/firebase';
import type { HvacStartupReport, WorkOrder, Technician } from '@/lib/types';
import { getHvacStartupReportById, getWorkOrderById, getTechnicianById, getTechnicians } from '@/lib/data';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Pencil, Trash2, Printer, Download, Loader2 } from 'lucide-react';
import { HvacStartupReportForm } from '@/components/hvac-startup-report-form';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { doc } from 'firebase/firestore';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <h3 className="font-bold bg-gray-100 p-2 border-b border-t text-sm uppercase tracking-wide">{children}</h3>
);

const ValueBox = ({ value, className }: { value?: string, className?: string }) => (
    <div className={`min-h-[32px] px-3 py-1.5 text-sm border rounded-md bg-white flex items-center ${className}`}>
        {value || ''}
    </div>
);

const LabeledInput = ({ label, value, colSpan = 'sm:col-span-1' }: { label: string, value?: string, colSpan?: string }) => (
    <div className={`grid grid-cols-[1fr_2fr] sm:grid-cols-1 gap-1 ${colSpan}`}>
        <label className="text-[10px] uppercase font-bold text-muted-foreground sm:text-[9px] mb-0.5">{label}</label>
        <ValueBox value={value} />
    </div>
);

const GroupedLabeledInput = ({ label, values, labels, colSpan = 'sm:col-span-1' }: { label: string, values: (string | undefined)[], labels: string[], colSpan?: string }) => (
     <div className={`${colSpan} space-y-1`}>
        <p className="text-[10px] uppercase font-bold text-muted-foreground sm:text-[9px]">{label}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {values.map((v, i) => (
                <div key={i}>
                    <p className="text-[9px] text-center text-muted-foreground font-medium mb-0.5">{labels[i]}</p>
                    <ValueBox value={v} className="justify-center h-7 px-1" />
                </div>
            ))}
        </div>
    </div>
);

export default function ViewHvacStartupReportPage() {
    const db = useFirestore();
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const id = params.id as string;

    const [report, setReport] = useState<HvacStartupReport | null>(null);
    const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
    const [technician, setTechnician] = useState<Technician | null>(null);
    const [allTechnicians, setAllTechnicians] = useState<Technician[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const printRef = useRef<HTMLDivElement>(null);

    const fetchReport = async () => {
        if (!db || !id) return;
        setIsLoading(true);
        try {
            const fetchedReport = await getHvacStartupReportById(db, id);
            if (fetchedReport) {
                setReport(fetchedReport);
                const [wo, tech, allTechs] = await Promise.all([
                    fetchedReport.workOrderId ? getWorkOrderById(db, fetchedReport.workOrderId) : Promise.resolve(null),
                    fetchedReport.technicianId ? getTechnicianById(db, fetchedReport.technicianId) : Promise.resolve(null),
                    getTechnicians(db)
                ]);
                setWorkOrder(wo);
                setTechnician(tech);
                setAllTechnicians(allTechs);
            } else {
                notFound();
            }
        } catch(e) {
            console.error(e);
            notFound();
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        fetchReport();
    }, [db, id])

    const handleDownload = useCallback(async () => {
        const content = printRef.current;
        if (!content || !report) return;

        setIsDownloading(true);
        try {
            const pages = content.querySelectorAll('.pdf-page') as NodeListOf<HTMLElement>;
            let pdf: jsPDF | null = null;

            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                const canvas = await html2canvas(page, { 
                    scale: 2, 
                    useCORS: true, 
                    allowTaint: true,
                    logging: false
                });
                
                const imgData = canvas.toDataURL('image/png');
                const canvasWidth = canvas.width;
                const canvasHeight = canvas.height;

                // Standard letter points are 612 x 792 (8.5 x 11 inches)
                if (i === 0) {
                    pdf = new jsPDF({
                        orientation: 'p',
                        unit: 'pt',
                        format: 'letter'
                    });
                } else {
                    pdf!.addPage('letter', 'p');
                }
                
                pdf!.addImage(imgData, 'PNG', 0, 0, 612, 792);
            }

            if (pdf) {
                pdf.save(`HVAC-Report-${report.workOrderId || report.id}.pdf`);
            }
        } catch (e) {
            console.error("Error generating PDF:", e);
            toast({ title: "Failed to generate PDF", variant: "destructive" });
        } finally {
            setIsDownloading(false);
        }
    }, [report, toast]);

    useEffect(() => {
        if (!isLoading && report && searchParams.get('action') === 'download') {
            const timer = setTimeout(() => handleDownload(), 1000);
            return () => clearTimeout(timer);
        }
    }, [isLoading, report, searchParams, handleDownload]);

    const handleFormSaved = () => {
        fetchReport();
        setIsEditing(false);
    }
    
    const handleDelete = async () => {
        if (!db || !report) return;

        try {
            const reportRef = doc(db, 'hvac_startup_reports', report.id);
            await deleteDocumentNonBlocking(reportRef);
            toast({ title: "HVAC Start-Up Report Deleted" });
            router.push(report.workOrderId ? `/work-orders/${report.workOrderId}` : '/');
        } catch (error) {
            console.error("Error deleting report:", error);
            toast({ title: "Delete failed", variant: "destructive" });
        } finally {
            setIsDeleteDialogOpen(false);
        }
    };

    if (isLoading) {
        return (
             <MainLayout>
                <div className="container mx-auto py-8">
                    <Card>
                        <CardContent className="p-8 text-center">
                             <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
                             <p className="mt-4 text-muted-foreground">Loading report data...</p>
                        </CardContent>
                    </Card>
                </div>
            </MainLayout>
        )
    }

    if (!report) {
        notFound();
    }
    
    return (
        <MainLayout>
            <div className="bg-gray-100 min-h-screen py-8">
                <div className="container mx-auto" style={{ maxWidth: '9in' }}>
                    <div className="mb-6 flex justify-between items-center gap-4 px-4 sm:px-0 print:hidden">
                        <Button variant="outline" asChild>
                            <a href={report.workOrderId ? `/work-orders/${report.workOrderId}` : '/'} className="flex items-center gap-2">
                                <ArrowLeft className="h-4 w-4" />
                                Back
                            </a>
                        </Button>
                        {!isEditing && (
                            <div className="flex items-center gap-2">
                                <Button variant="outline" onClick={() => window.print()} className="hidden sm:flex">
                                    <Printer className="mr-2 h-4 w-4" /> Print
                                </Button>
                                <Button variant="outline" onClick={handleDownload} disabled={isDownloading}>
                                    {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                                    Download PDF
                                </Button>
                                <Button variant="destructive" onClick={() => setIsDeleteDialogOpen(true)}>
                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                                </Button>
                                <Button variant="outline" onClick={() => setIsEditing(true)}>
                                    <Pencil className="mr-2 h-4 w-4" /> Edit
                                </Button>
                            </div>
                        )}
                    </div>
                
                {isEditing ? (
                    <HvacStartupReportForm 
                        report={report}
                        workOrder={workOrder}
                        technicians={allTechnicians}
                        onFormSaved={handleFormSaved}
                        onCancel={() => setIsEditing(false)}
                    />
                ) : (
                    <div className="space-y-8" ref={printRef}>
                        {/* PAGE 1: EQUIPMENT INFO */}
                        <div className="pdf-page bg-white text-black p-10 shadow-lg mx-auto overflow-hidden" style={{ width: '8.5in', height: '11in', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
                            <header className="flex justify-center items-center mb-8">
                                <h1 className="text-2xl font-black text-center border-b-4 border-black pb-2 px-8">
                                HVAC START-UP REPORT
                                </h1>
                            </header>

                            <main className="space-y-6 flex-1">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-b-2 border-black pb-6">
                                    <LabeledInput label="Site" value={workOrder?.workSite?.name || report.site} />
                                    <LabeledInput label="Date" value={report.date ? format(new Date(report.date), 'PPP') : ''} />
                                    <LabeledInput label="Technician" value={technician?.name || report.technician} />
                                    <LabeledInput label="Job #" value={workOrder?.id || report.workOrderId} />
                                </div>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-6">
                                    <LabeledInput label="Equipment Being Removed" value={report.equipmentBeingRemoved} />
                                    <LabeledInput label="M#" value={report.mNumber} />
                                    <LabeledInput label="Unit Tag" value={report.unitTag} />
                                    <LabeledInput label="S#" value={report.sNumber} />
                                    <LabeledInput label="Equipment Type" value={report.equipmentType} />
                                    
                                    <div className="sm:col-span-2 my-2">
                                        <Separator className="bg-black/20" />
                                    </div>
                                    
                                    <LabeledInput label="Manufacturer" value={report.equipmentManufacturer} />
                                    <LabeledInput label="Model" value={report.model} />
                                    <LabeledInput label="Serial" value={report.serial} />
                                    <LabeledInput label="Location" value={report.location} />
                                    <LabeledInput label="Belt size" value={report.beltSize} />
                                    <LabeledInput label="Filter size and Qty." value={report.filterSizeAndQty} />
                                    <LabeledInput label="Ambient Temp °F" value={report.ambientTemp} />
                                    <LabeledInput label="Equipment ID" value={report.equipmentId} />
                                    <LabeledInput label="Area Equipment Serves" value={report.areaEquipmentServes} colSpan="sm:col-span-2" />
                                </div>
                            </main>
                            
                            <footer className="mt-auto pt-6 text-[10px] font-bold text-gray-400 flex justify-between border-t border-gray-100">
                                <span>HVAC Start-Up Report - Job# {workOrder?.id || report.workOrderId}</span>
                                <span>Page 1 of 2</span>
                            </footer>
                        </div>

                        {/* PAGE 2: TECHNICAL DATA */}
                        <div className="pdf-page bg-white text-black p-10 shadow-lg mx-auto overflow-hidden" style={{ width: '8.5in', height: '11in', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
                            <main className="space-y-6 flex-1">
                                <h2 className="text-xl font-bold text-center border-b-4 border-black pb-2 mb-8">TECHNICAL PERFORMANCE DATA</h2>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-6">
                                    <div className="space-y-4">
                                        <div>
                                            <SectionTitle>Supply Voltage</SectionTitle>
                                            <div className="p-4 border-2 border-t-0 space-y-4 rounded-b-md">
                                                <LabeledInput label="L1-L2" value={report.supplyVoltage_L1_L2} />
                                                <LabeledInput label="L2-L3" value={report.supplyVoltage_L2_L3} />
                                                <LabeledInput label="L3-L1" value={report.supplyVoltage_L3_L1} />
                                                <LabeledInput label="Control Voltage AC/DC" value={report.controlVoltageACDC} />
                                            </div>
                                        </div>
                                        <div>
                                            <SectionTitle>Supply Blower Data</SectionTitle>
                                            <div className="p-4 border-2 border-t-0 space-y-4 rounded-b-md">
                                                <LabeledInput label="Motor HP" value={report.motorHp} />
                                                <LabeledInput label="Motor Amps" value={report.motorAmps} />
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-4">
                                        <GroupedLabeledInput label="Condenser: Suction Pressure" values={[report.suctionPressure_S1, report.suctionPressure_S2, report.suctionPressure_S3, report.suctionPressure_S4]} labels={['S-1', 'S-2', 'S-3', 'S-4']} />
                                        <GroupedLabeledInput label="Condenser: Discharge Pressure" values={[report.dischargePressure_S1, report.dischargePressure_S2, report.dischargePressure_S3, report.dischargePressure_S4]} labels={['S-1', 'S-2', 'S-3', 'S-4']} />
                                        <GroupedLabeledInput label="Condenser: Crankcase Heater AMP" values={[report.crankcaseHeaterAmp_S1, report.crankcaseHeaterAmp_S2, report.crankcaseHeaterAmp_S3, report.crankcaseHeaterAmp_S4]} labels={['S-1', 'S-2', 'S-3', 'S-4']} />
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-6 pt-4 border-t border-black/10">
                                    <div className="space-y-4">
                                        <div className="space-y-1">
                                            <p className="text-[10px] uppercase font-bold text-muted-foreground sm:text-[9px]">Compressor AMP</p>
                                            <div className="grid grid-cols-3 gap-2">
                                                <div><p className="text-[9px] text-center font-medium">T1</p><ValueBox value={report.compressorAmp_T1} className="h-7 px-1 justify-center" /></div>
                                                <div><p className="text-[9px] text-center font-medium">T2</p><ValueBox value={report.compressorAmp_T2} className="h-7 px-1 justify-center" /></div>
                                                <div><p className="text-[9px] text-center font-medium">T3</p><ValueBox value={report.compressorAmp_T3} className="h-7 px-1 justify-center" /></div>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] uppercase font-bold text-muted-foreground sm:text-[9px]">Compressor Voltage</p>
                                            <div className="grid grid-cols-3 gap-2">
                                                <div><p className="text-[9px] text-center font-medium">T1-T2</p><ValueBox value={report.compressorVoltage_T1_T2} className="h-7 px-1 justify-center" /></div>
                                                <div><p className="text-[9px] text-center font-medium">T2-T3</p><ValueBox value={report.compressorVoltage_T2_T3} className="h-7 px-1 justify-center" /></div>
                                                <div><p className="text-[9px] text-center font-medium">T3-T1</p><ValueBox value={report.compressorVoltage_T3_T1} className="h-7 px-1 justify-center" /></div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <LabeledInput label="Cond. Fan Voltage" value={report.condenserFanVoltage} />
                                            <LabeledInput label="Cond. Fan Amp" value={report.condenserFanAmp} />
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="space-y-1">
                                            <p className="text-[10px] uppercase font-bold text-muted-foreground sm:text-[9px]">Cooling (°F)</p>
                                            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                                <LabeledInput label="Evap EAT" value={report.cooling_evaporatorEAT} />
                                                <LabeledInput label="Evap LAT" value={report.cooling_evaporatorLAT} />
                                                <LabeledInput label="Cond EAT" value={report.cooling_condenserEAT} />
                                                <LabeledInput label="Cond LAT" value={report.cooling_condenserLAT} />
                                            </div>
                                        </div>
                                        <div>
                                            <SectionTitle>Motor Rated Amps</SectionTitle>
                                            <div className="p-4 border-2 border-t-0 space-y-3 rounded-b-md">
                                                <div className="grid grid-cols-3 gap-2">
                                                    <LabeledInput label="T1" value={report.motorRatedAmps_T1} />
                                                    <LabeledInput label="T2" value={report.motorRatedAmps_T2} />
                                                    <LabeledInput label="T3" value={report.motorRatedAmps_T3} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-6 pt-4 border-t border-black/10">
                                    <div>
                                        <SectionTitle>Gas Heating</SectionTitle>
                                        <div className="p-4 border-2 border-t-0 space-y-3 rounded-b-md">
                                            <GroupedLabeledInput label="RAT | SAT Temp °F" values={[report.gasHeating_RAT_SAT_S1, report.gasHeating_RAT_SAT_S2, report.gasHeating_RAT_SAT_S3, report.gasHeating_RAT_SAT_S4]} labels={['S-1', 'S-2', 'S-3', 'S-4']} />
                                            <LabeledInput label="Gas Pressure IN WC" value={report.gasPressureInWC} />
                                        </div>
                                    </div>
                                    <div>
                                        <SectionTitle>Electric Heating</SectionTitle>
                                        <div className="p-4 border-2 border-t-0 rounded-b-md h-full">
                                            <GroupedLabeledInput label="RAT | SAT Temp °F" values={[report.electricHeating_RAT_SAT_S1, report.electricHeating_RAT_SAT_S2, report.electricHeating_RAT_SAT_S3, report.electricHeating_RAT_SAT_S4]} labels={['S-1', 'S-2', 'S-3', 'S-4']} />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-6 pt-4 border-t border-black/10">
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <p className="text-[10px] font-bold uppercase mb-1">Voltage Output</p>
                                            <div className="grid grid-cols-1 gap-2">
                                                <LabeledInput label="T1-T2" value={report.voltage_T1_T2} />
                                                <LabeledInput label="T2-T3" value={report.voltage_T2_T3} />
                                                <LabeledInput label="T3-T1" value={report.voltage_T3_T1} />
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold uppercase mb-1">Amps Output</p>
                                            <div className="grid grid-cols-1 gap-2">
                                                <LabeledInput label="T1" value={report.amps_T1} />
                                                <LabeledInput label="T2" value={report.amps_T2} />
                                                <LabeledInput label="T3" value={report.amps_T3} />
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <SectionTitle>Final Checks</SectionTitle>
                                        <div className="p-4 border-2 border-t-0 rounded-b-md">
                                            <LabeledInput label="Checked Rotation" value={report.checkedRotation} />
                                        </div>
                                    </div>
                                </div>
                            </main>

                            <footer className="mt-auto pt-6 text-[10px] font-bold text-gray-400 flex justify-between border-t border-gray-100">
                                <span>HVAC Start-Up Report - Job# {workOrder?.id || report.workOrderId}</span>
                                <span>Page 2 of 2</span>
                            </footer>
                        </div>
                    </div>
                )}
                </div>
                 <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                    <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete this HVAC Start-Up Report.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </MainLayout>
    );
}
