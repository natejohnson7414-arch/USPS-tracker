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
    <h3 className="font-bold bg-gray-100 p-2 border-b border-t">{children}</h3>
);

const ValueBox = ({ value, className }: { value?: string, className?: string }) => (
    <div className={`min-h-8 px-3 py-1.5 text-sm border rounded-md bg-white flex items-center ${className}`}>
        {value || ''}
    </div>
);

const LabeledInput = ({ label, value, colSpan = 'sm:col-span-1' }: { label: string, value?: string, colSpan?: string }) => (
    <div className={`grid grid-cols-[1fr_2fr] sm:grid-cols-1 gap-1 ${colSpan}`}>
        <label className="text-sm text-muted-foreground sm:text-xs">{label}</label>
        <ValueBox value={value} />
    </div>
);

const GroupedLabeledInput = ({ label, values, labels, colSpan = 'sm:col-span-1' }: { label: string, values: (string | undefined)[], labels: string[], colSpan?: string }) => (
     <div className={`${colSpan} space-y-1`}>
        <p className="text-sm text-muted-foreground sm:text-xs">{label}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {values.map((v, i) => (
                <div key={i}>
                    <p className="text-xs text-center text-muted-foreground">{labels[i]}</p>
                    <ValueBox value={v} className="justify-center" />
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
                const pdfWidth = canvas.width;
                const pdfHeight = canvas.height;

                if (i === 0) {
                    pdf = new jsPDF({
                        orientation: pdfWidth > pdfHeight ? 'l' : 'p',
                        unit: 'pt',
                        format: [pdfWidth, pdfHeight]
                    });
                } else {
                    pdf!.addPage([pdfWidth, pdfHeight], pdfWidth > pdfHeight ? 'l' : 'p');
                }
                
                pdf!.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
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
                        <CardContent className="p-8">
                             <Skeleton className="h-24 w-1/2 mx-auto mb-8" />
                             <Skeleton className="h-8 w-full mb-4" />
                             <Skeleton className="h-8 w-full mb-4" />
                             <Skeleton className="h-20 w-full mb-4" />
                             <Skeleton className="h-40 w-full" />
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
                    <div ref={printRef}>
                        <div className="pdf-page bg-white text-black p-8 shadow-lg mx-auto" style={{ width: '8.5in', minHeight: '11in' }}>
                            <header className="flex justify-center items-center mb-6">
                                <h1 className="text-xl sm:text-2xl font-bold text-center">
                                HVAC START-UP REPORT
                                </h1>
                            </header>

                            <main className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-b pb-4">
                                    <LabeledInput label="Site" value={workOrder?.workSite?.name || report.site} />
                                    <LabeledInput label="Date" value={report.date ? new Date(report.date).toLocaleDateString() : ''} />
                                    <LabeledInput label="Technician" value={technician?.name || report.technician} />
                                    <LabeledInput label="Job #" value={workOrder?.id || report.workOrderId} />
                                </div>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                                    <LabeledInput label="Equipment Being Removed" value={report.equipmentBeingRemoved} />
                                    <LabeledInput label="M#" value={report.mNumber} />
                                    <LabeledInput label="Unit Tag" value={report.unitTag} />
                                    <LabeledInput label="S#" value={report.sNumber} />
                                    <LabeledInput label="Equipment Type" value={report.equipmentType} />
                                    <div className="sm:col-span-2 my-4">
                                        <Separator />
                                    </div>
                                    <LabeledInput label="Manufacturer" value={report.equipmentManufacturer} />
                                    <LabeledInput label="Model" value={report.model} />
                                    <LabeledInput label="Serial" value={report.serial} />
                                    <LabeledInput label="Location" value={report.location} />
                                    <LabeledInput label="Belt size" value={report.beltSize} />
                                    <LabeledInput label="Filter size and Qty." value={report.filterSizeAndQty} />
                                    <LabeledInput label="Ambient Temp °F" value={report.ambientTemp} />
                                    <LabeledInput label="Equipment ID" value={report.equipmentId} />
                                    <LabeledInput label="Area Equipment Serves" value={report.areaEquipmentServes} />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 pt-4">
                                    <div>
                                        <SectionTitle>Supply Voltage</SectionTitle>
                                        <div className="p-4 border border-t-0 space-y-4">
                                            <LabeledInput label="L1-L2" value={report.supplyVoltage_L1_L2} />
                                            <LabeledInput label="L2-L3" value={report.supplyVoltage_L2_L3} />
                                            <LabeledInput label="L3-L1" value={report.supplyVoltage_L3_L1} />
                                            <LabeledInput label="Control Voltage AC/DC" value={report.controlVoltageACDC} />
                                        </div>
                                    </div>
                                    <div>
                                        <SectionTitle>Supply Blower Data</SectionTitle>
                                        <div className="p-4 border border-t-0 space-y-4">
                                            <LabeledInput label="Motor HP" value={report.motorHp} />
                                            <LabeledInput label="Motor Amps" value={report.motorAmps} />
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 pt-4">
                                    <GroupedLabeledInput label="Condenser: Suction Pressure" values={[report.suctionPressure_S1, report.suctionPressure_S2, report.suctionPressure_S3, report.suctionPressure_S4]} labels={['S-1', 'S-2', 'S-3', 'S-4']} />
                                    <GroupedLabeledInput label="Condenser: Discharge Pressure" values={[report.dischargePressure_S1, report.dischargePressure_S2, report.dischargePressure_S3, report.dischargePressure_S4]} labels={['S-1', 'S-2', 'S-3', 'S-4']} />
                                    <GroupedLabeledInput label="Condenser: Crankcase Heater AMP" values={[report.crankcaseHeaterAmp_S1, report.crankcaseHeaterAmp_S2, report.crankcaseHeaterAmp_S3, report.crankcaseHeaterAmp_S4]} labels={['S-1', 'S-2', 'S-3', 'S-4']} />
                                    <div>
                                        <p className="text-sm text-muted-foreground sm:text-xs">Compressor AMP</p>
                                        <LabeledInput label="T1" value={report.compressorAmp_T1} />
                                        <LabeledInput label="T2" value={report.compressorAmp_T2} />
                                        <LabeledInput label="T3" value={report.compressorAmp_T3} />
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 pt-4">
                                    <div>
                                        <p className="text-sm text-muted-foreground sm:text-xs">Compressor Voltage</p>
                                        <LabeledInput label="T1-T2" value={report.compressorVoltage_T1_T2} />
                                        <LabeledInput label="T2-T3" value={report.compressorVoltage_T2_T3} />
                                        <LabeledInput label="T3-T1" value={report.compressorVoltage_T3_T1} />
                                        <LabeledInput label="Condenser Fan Voltage" value={report.condenserFanVoltage} />
                                        <LabeledInput label="Condenser Fan Amp" value={report.condenserFanAmp} />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground sm:text-xs">Cooling</p>
                                        <LabeledInput label="Evaporator EAT °F" value={report.cooling_evaporatorEAT} />
                                        <LabeledInput label="Evaporator LAT °F" value={report.cooling_evaporatorLAT} />
                                        <LabeledInput label="Condenser EAT °F" value={report.cooling_condenserEAT} />
                                        <LabeledInput label="Condenser LAT °F" value={report.cooling_condenserLAT} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 pt-4">
                                    <div>
                                        <SectionTitle>Motor Rated Amps</SectionTitle>
                                        <div className="p-4 border border-t-0 space-y-2">
                                            <LabeledInput label="T1" value={report.motorRatedAmps_T1} />
                                            <LabeledInput label="T2" value={report.motorRatedAmps_T2} />
                                            <LabeledInput label="T3" value={report.motorRatedAmps_T3} />
                                        </div>
                                    </div>
                                    <div>
                                        <SectionTitle>Gas Heating</SectionTitle>
                                        <div className="p-4 border border-t-0 space-y-2">
                                            <GroupedLabeledInput label="RAT | SAT Temp °F" values={[report.gasHeating_RAT_SAT_S1, report.gasHeating_RAT_SAT_S2, report.gasHeating_RAT_SAT_S3, report.gasHeating_RAT_SAT_S4]} labels={['S-1', 'S-2', 'S-3', 'S-4']} />
                                            <LabeledInput label="Gas Pressure IN WC" value={report.gasPressureInWC} />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 pt-4">
                                    <div>
                                        <SectionTitle>Electric Heating</SectionTitle>
                                        <div className="p-4 border border-t-0 space-y-2">
                                            <GroupedLabeledInput label="RAT | SAT Temp °F" values={[report.electricHeating_RAT_SAT_S1, report.electricHeating_RAT_SAT_S2, report.electricHeating_RAT_SAT_S3, report.electricHeating_RAT_SAT_S4]} labels={['S-1', 'S-2', 'S-3', 'S-4']} />
                                        </div>
                                    </div>
                                    <div>
                                        <SectionTitle>Voltage</SectionTitle>
                                        <div className="p-4 border border-t-0 space-y-2">
                                            <LabeledInput label="T1-T2" value={report.voltage_T1_T2} />
                                            <LabeledInput label="T2-T3" value={report.voltage_T2_T3} />
                                            <LabeledInput label="T3-T1" value={report.voltage_T3_T1} />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 pt-4">
                                    <div>
                                        <SectionTitle>Amps</SectionTitle>
                                        <div className="p-4 border border-t-0 space-y-2">
                                            <LabeledInput label="T1" value={report.amps_T1} />
                                            <LabeledInput label="T2" value={report.amps_T2} />
                                            <LabeledInput label="T3" value={report.amps_T3} />
                                        </div>
                                    </div>
                                    <div>
                                        <SectionTitle>&nbsp;</SectionTitle>
                                        <div className="p-4 border border-t-0">
                                            <LabeledInput label="Checked Rotation" value={report.checkedRotation} />
                                        </div>
                                    </div>
                                </div>
                            </main>
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
