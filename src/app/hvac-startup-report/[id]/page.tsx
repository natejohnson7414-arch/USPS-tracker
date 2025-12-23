
'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { MainLayout } from '@/components/main-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { notFound, useParams } from 'next/navigation';
import { useFirestore } from '@/firebase';
import type { HvacStartupReport, WorkOrder, Technician } from '@/lib/types';
import { getHvacStartupReportById, getWorkOrderById, getTechnicianById } from '@/lib/data';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <h3 className="font-bold bg-gray-100 p-2 border-b border-t">{children}</h3>
);

const LabeledInput = ({ label, value, colSpan = 'sm:col-span-1' }: { label: string, value?: string, colSpan?: string }) => (
    <div className={`grid grid-cols-[1fr_2fr] sm:grid-cols-1 gap-1 ${colSpan}`}>
        <label className="text-sm text-muted-foreground sm:text-xs">{label}</label>
        <Input readOnly value={value || ''} className="h-8" />
    </div>
);

const GroupedLabeledInput = ({ label, values, labels, colSpan = 'sm:col-span-1' }: { label: string, values: (string | undefined)[], labels: string[], colSpan?: string }) => (
     <div className={`${colSpan} space-y-1`}>
        <p className="text-sm text-muted-foreground sm:text-xs">{label}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {values.map((v, i) => (
                <div key={i}>
                    <p className="text-xs text-center text-muted-foreground">{labels[i]}</p>
                    <Input readOnly value={v || ''} className="h-8 text-center" />
                </div>
            ))}
        </div>
    </div>
);


export default function ViewHvacStartupReportPage() {
    const db = useFirestore();
    const params = useParams();
    const id = params.id as string;

    const [report, setReport] = useState<HvacStartupReport | null>(null);
    const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
    const [technician, setTechnician] = useState<Technician | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!db || !id) return;
        
        const fetchReport = async () => {
            setIsLoading(true);
            const fetchedReport = await getHvacStartupReportById(db, id);
            if (fetchedReport) {
                setReport(fetchedReport);
                if (fetchedReport.workOrderId) {
                    const wo = await getWorkOrderById(db, fetchedReport.workOrderId);
                    setWorkOrder(wo || null);
                }
                if (fetchedReport.technicianId) {
                    const tech = await getTechnicianById(db, fetchedReport.technicianId);
                    setTechnician(tech || null);
                }
            } else {
                notFound();
            }
            setIsLoading(false);
        }
        fetchReport();

    }, [db, id])

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
            <div className="bg-white text-black min-h-screen">
                <div className="container mx-auto p-4 sm:p-8" style={{ maxWidth: '8.5in' }}>
                <Card className="shadow-lg">
                    <CardContent className="p-6 sm:p-8">
                    <header className="flex justify-between items-start mb-6">
                        <div className="relative h-16 w-48">
                            <Image src="https://www.crawford-company.com/hubfs/new-art-o-lite-logo-1.png" alt="Crawford Company Logo" fill style={{ objectFit: "contain" }} />
                        </div>
                        <h1 className="text-xl sm:text-2xl font-bold text-center">
                        HVAC START-UP REPORT
                        </h1>
                        <div className="w-48"></div>
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
                    </CardContent>
                </Card>
                </div>
            </div>
        </MainLayout>
    );
}
