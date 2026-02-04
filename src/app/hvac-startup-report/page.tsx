
'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';
import { MainLayout } from '@/components/main-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFirestore, addDocumentNonBlocking, useCollection, useUser, useMemoFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where } from 'firebase/firestore';
import type { HvacStartupReport, WorkOrder, Technician } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { getWorkOrderById } from '@/lib/data';

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <h3 className="font-bold bg-gray-100 p-2 border-b border-t">{children}</h3>
);

const LabeledInput = ({ label, value, onChange, colSpan = 'sm:col-span-1' }: { label: string, value: string, onChange: (val: string) => void, colSpan?: string }) => (
    <div className={`grid grid-cols-[1fr_2fr] sm:grid-cols-1 gap-1 ${colSpan}`}>
        <label className="text-sm text-muted-foreground sm:text-xs">{label}</label>
        <Input value={value} onChange={e => onChange(e.target.value)} className="h-8" />
    </div>
);

const GroupedLabeledInput = ({ label, values, onChange, labels, colSpan = 'sm:col-span-1' }: { label: string, values: string[], onChange: (index: number, value: string) => void, labels: string[], colSpan?: string }) => (
     <div className={`${colSpan} space-y-1`}>
        <p className="text-sm text-muted-foreground sm:text-xs">{label}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {values.map((v, i) => (
                <div key={i}>
                    <p className="text-xs text-center text-muted-foreground">{labels[i]}</p>
                    <Input value={v} onChange={e => onChange(i, e.target.value)} className="h-8 text-center" />
                </div>
            ))}
        </div>
    </div>
);


export default function HvacStartupReportPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const woIdFromQuery = searchParams.get('workOrderId');
  const [isSaving, setIsSaving] = useState(false);

  const [formState, setFormState] = useState<Partial<HvacStartupReport>>({
    date: new Date().toISOString(),
  });

  const workOrdersQuery = useMemoFirebase(() => db ? query(collection(db, 'work_orders'), where("status", "!=", "Completed")) : null, [db]);
  const { data: workOrders } = useCollection<WorkOrder>(workOrdersQuery);

  const techniciansQuery = useMemoFirebase(() => db ? query(collection(db, 'technicians')) : null, [db]);
  const { data: technicians } = useCollection<Technician>(techniciansQuery);
  
  const handleInputChange = (field: keyof HvacStartupReport, value: string) => {
    setFormState(prev => ({ ...prev, [field]: value }));
  };
  
  useEffect(() => {
    if (user?.uid) {
        handleInputChange('technicianId', user.uid);
    }
    if (woIdFromQuery && db) {
        handleInputChange('workOrderId', woIdFromQuery);
        getWorkOrderById(db, woIdFromQuery).then(wo => {
            if (wo && wo.workSite) {
                handleInputChange('site', wo.workSite.name);
            }
        });
    }
  }, [woIdFromQuery, db, user]);
  
  const handleGroupedInputChange = (baseField: string, index: number, value: string) => {
    const fieldName = `${baseField}_S${index + 1}` as keyof HvacStartupReport;
    handleInputChange(fieldName, value);
  };
  
  const handleAmpVoltInputChange = (baseField: string, index: number, value: string) => {
    const fieldName = `${baseField}_T${index + 1}` as keyof HvacStartupReport;
    handleInputChange(fieldName, value);
  }
  
  const handleCompressorVoltInputChange = (field: keyof HvacStartupReport, value: string) => {
    handleInputChange(field, value);
  }

  const resetForm = () => {
    setFormState({
        date: new Date().toISOString(),
        technicianId: user?.uid,
    })
  }

  const handleSaveForm = async () => {
    if (!db) {
        toast({ title: "Database not connected", variant: "destructive" });
        return;
    }
    if (!formState.workOrderId || !formState.technicianId || !formState.date) {
      toast({ title: "Missing Required Fields", description: "Work Order, Technician, and Date are required.", variant: 'destructive' });
      return;
    }
    
    setIsSaving(true);

    try {
        const reportData: Partial<HvacStartupReport> = {
            ...formState,
            date: new Date(formState.date).toISOString()
        };
        
        await addDocumentNonBlocking(collection(db, 'hvac_startup_reports'), reportData);

        toast({ title: 'HVAC Start-Up Report Saved' });
        resetForm();

    } catch (error) {
        if (error instanceof Error && !error.message.includes('permission-error')) {
            console.error("Error saving report:", error);
            toast({ title: 'Save Failed', description: 'Could not save the report.', variant: 'destructive' });
        }
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <MainLayout>
      <div className="bg-white text-black min-h-screen">
        <div className="container mx-auto p-4 sm:p-8" style={{ maxWidth: '8.5in' }}>
          <Card className="shadow-lg">
            <CardContent className="p-6 sm:p-8">
              <header className="flex justify-center items-center mb-6">
                <h1 className="text-xl sm:text-2xl font-bold text-center">
                  HVAC START-UP REPORT
                </h1>
              </header>

              <main className="space-y-4">
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-b pb-4">
                    <div className="space-y-1">
                        <label className="text-sm font-medium">Site/Work Order</label>
                         <Select onValueChange={(val) => handleInputChange('workOrderId', val)} value={formState.workOrderId} disabled={isSaving || !!woIdFromQuery}>
                            <SelectTrigger className="h-8">
                                <SelectValue placeholder="Select a work order" />
                            </SelectTrigger>
                            <SelectContent>
                                {workOrders?.map(wo => (
                                <SelectItem key={wo.id} value={wo.id}>
                                    {wo.id} - {wo.jobName}
                                </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-medium">Date</label>
                        <DatePicker date={formState.date ? new Date(formState.date) : undefined} setDate={(d) => handleInputChange('date', d?.toISOString() || '')} />
                    </div>
                     <div className="space-y-1">
                        <label className="text-sm font-medium">Technician</label>
                        <Select onValueChange={(val) => handleInputChange('technicianId', val)} value={formState.technicianId} disabled={isSaving}>
                            <SelectTrigger className="h-8">
                                <SelectValue placeholder="Select technician" />
                            </SelectTrigger>
                            <SelectContent>
                                {technicians?.map(tech => (
                                <SelectItem key={tech.id} value={tech.id}>
                                    {tech.name}
                                </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                     <LabeledInput label="Job #" value={formState.workOrderId || ''} onChange={() => {}} colSpan="sm:col-span-1" />
                </div>
                
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                    <LabeledInput label="Equipment Being Removed" value={formState.equipmentBeingRemoved || ''} onChange={(val) => handleInputChange('equipmentBeingRemoved', val)} />
                    <LabeledInput label="M#" value={formState.mNumber || ''} onChange={(val) => handleInputChange('mNumber', val)} />
                    <LabeledInput label="Unit Tag" value={formState.unitTag || ''} onChange={(val) => handleInputChange('unitTag', val)} />
                    <LabeledInput label="S#" value={formState.sNumber || ''} onChange={(val) => handleInputChange('sNumber', val)} />
                    <LabeledInput label="Equipment Type" value={formState.equipmentType || ''} onChange={(val) => handleInputChange('equipmentType', val)} />
                    <div className="sm:col-span-2 my-4">
                        <Separator />
                    </div>
                    <LabeledInput label="Manufacturer" value={formState.equipmentManufacturer || ''} onChange={(val) => handleInputChange('equipmentManufacturer', val)} />
                    <LabeledInput label="Model" value={formState.model || ''} onChange={(val) => handleInputChange('model', val)} />
                    <LabeledInput label="Serial" value={formState.serial || ''} onChange={(val) => handleInputChange('serial', val)} />
                    <LabeledInput label="Location" value={formState.location || ''} onChange={(val) => handleInputChange('location', val)} />
                    <LabeledInput label="Belt size" value={formState.beltSize || ''} onChange={(val) => handleInputChange('beltSize', val)} />
                    <LabeledInput label="Filter size and Qty." value={formState.filterSizeAndQty || ''} onChange={(val) => handleInputChange('filterSizeAndQty', val)} />
                    <LabeledInput label="Ambient Temp °F" value={formState.ambientTemp || ''} onChange={(val) => handleInputChange('ambientTemp', val)} />
                    <LabeledInput label="Equipment ID" value={formState.equipmentId || ''} onChange={(val) => handleInputChange('equipmentId', val)} />
                    <LabeledInput label="Area Equipment Serves" value={formState.areaEquipmentServes || ''} onChange={(val) => handleInputChange('areaEquipmentServes', val)} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 pt-4">
                     <div>
                        <SectionTitle>Supply Voltage</SectionTitle>
                        <div className="p-4 border border-t-0 space-y-4">
                             <LabeledInput label="L1-L2" value={formState.supplyVoltage_L1_L2 || ''} onChange={val => handleInputChange('supplyVoltage_L1_L2', val)} />
                             <LabeledInput label="L2-L3" value={formState.supplyVoltage_L2_L3 || ''} onChange={val => handleInputChange('supplyVoltage_L2_L3', val)} />
                             <LabeledInput label="L3-L1" value={formState.supplyVoltage_L3_L1 || ''} onChange={val => handleInputChange('supplyVoltage_L3_L1', val)} />
                             <LabeledInput label="Control Voltage AC/DC" value={formState.controlVoltageACDC || ''} onChange={val => handleInputChange('controlVoltageACDC', val)} />
                        </div>
                     </div>
                     <div>
                        <SectionTitle>Supply Blower Data</SectionTitle>
                        <div className="p-4 border border-t-0 space-y-4">
                             <LabeledInput label="Motor HP" value={formState.motorHp || ''} onChange={val => handleInputChange('motorHp', val)} />
                             <LabeledInput label="Motor Amps" value={formState.motorAmps || ''} onChange={val => handleInputChange('motorAmps', val)} />
                        </div>
                     </div>
                </div>

                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 pt-4">
                    <GroupedLabeledInput label="Condenser: Suction Pressure" values={[formState.suctionPressure_S1 || '', formState.suctionPressure_S2 || '', formState.suctionPressure_S3 || '', formState.suctionPressure_S4 || '']} onChange={(i, v) => handleGroupedInputChange('suctionPressure', i, v)} labels={['S-1', 'S-2', 'S-3', 'S-4']} />
                    <GroupedLabeledInput label="Condenser: Discharge Pressure" values={[formState.dischargePressure_S1 || '', formState.dischargePressure_S2 || '', formState.dischargePressure_S3 || '', formState.dischargePressure_S4 || '']} onChange={(i, v) => handleGroupedInputChange('dischargePressure', i, v)} labels={['S-1', 'S-2', 'S-3', 'S-4']} />
                    <GroupedLabeledInput label="Condenser: Crankcase Heater AMP" values={[formState.crankcaseHeaterAmp_S1 || '', formState.crankcaseHeaterAmp_S2 || '', formState.crankcaseHeaterAmp_S3 || '', formState.crankcaseHeaterAmp_S4 || '']} onChange={(i, v) => handleGroupedInputChange('crankcaseHeaterAmp', i, v)} labels={['S-1', 'S-2', 'S-3', 'S-4']} />
                    <div>
                         <p className="text-sm text-muted-foreground sm:text-xs">Compressor AMP</p>
                         <LabeledInput label="T1" value={formState.compressorAmp_T1 || ''} onChange={v => handleAmpVoltInputChange('compressorAmp', 0, v)} />
                         <LabeledInput label="T2" value={formState.compressorAmp_T2 || ''} onChange={v => handleAmpVoltInputChange('compressorAmp', 1, v)} />
                         <LabeledInput label="T3" value={formState.compressorAmp_T3 || ''} onChange={v => handleAmpVoltInputChange('compressorAmp', 2, v)} />
                    </div>
                 </div>
                 
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 pt-4">
                    <div>
                        <p className="text-sm text-muted-foreground sm:text-xs">Compressor Voltage</p>
                        <LabeledInput label="T1-T2" value={formState.compressorVoltage_T1_T2 || ''} onChange={v => handleCompressorVoltInputChange('compressorVoltage_T1_T2', v)} />
                        <LabeledInput label="T2-T3" value={formState.compressorVoltage_T2_T3 || ''} onChange={v => handleCompressorVoltInputChange('compressorVoltage_T2_T3', v)} />
                        <LabeledInput label="T3-T1" value={formState.compressorVoltage_T3_T1 || ''} onChange={v => handleCompressorVoltInputChange('compressorVoltage_T3_T1', v)} />
                        <LabeledInput label="Condenser Fan Voltage" value={formState.condenserFanVoltage || ''} onChange={val => handleInputChange('condenserFanVoltage', val)} />
                        <LabeledInput label="Condenser Fan Amp" value={formState.condenserFanAmp || ''} onChange={val => handleInputChange('condenserFanAmp', val)} />
                    </div>
                     <div>
                        <p className="text-sm text-muted-foreground sm:text-xs">Cooling</p>
                        <LabeledInput label="Evaporator EAT °F" value={formState.cooling_evaporatorEAT || ''} onChange={val => handleInputChange('cooling_evaporatorEAT', val)} />
                        <LabeledInput label="Evaporator LAT °F" value={formState.cooling_evaporatorLAT || ''} onChange={val => handleInputChange('cooling_evaporatorLAT', val)} />
                        <LabeledInput label="Condenser EAT °F" value={formState.cooling_condenserEAT || ''} onChange={val => handleInputChange('cooling_condenserEAT', val)} />
                        <LabeledInput label="Condenser LAT °F" value={formState.cooling_condenserLAT || ''} onChange={val => handleInputChange('cooling_condenserLAT', val)} />
                    </div>
                 </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 pt-4">
                    <div>
                        <SectionTitle>Motor Rated Amps</SectionTitle>
                        <div className="p-4 border border-t-0 space-y-2">
                             <LabeledInput label="T1" value={formState.motorRatedAmps_T1 || ''} onChange={v => handleAmpVoltInputChange('motorRatedAmps', 0, v)} />
                             <LabeledInput label="T2" value={formState.motorRatedAmps_T2 || ''} onChange={v => handleAmpVoltInputChange('motorRatedAmps', 1, v)} />
                             <LabeledInput label="T3" value={formState.motorRatedAmps_T3 || ''} onChange={v => handleAmpVoltInputChange('motorRatedAmps', 2, v)} />
                        </div>
                     </div>
                     <div>
                        <SectionTitle>Gas Heating</SectionTitle>
                        <div className="p-4 border border-t-0 space-y-2">
                            <GroupedLabeledInput label="RAT | SAT Temp °F" values={[formState.gasHeating_RAT_SAT_S1 || '', formState.gasHeating_RAT_SAT_S2 || '', formState.gasHeating_RAT_SAT_S3 || '', formState.gasHeating_RAT_SAT_S4 || '']} onChange={(i, v) => handleGroupedInputChange('gasHeating_RAT_SAT', i, v)} labels={['S-1', 'S-2', 'S-3', 'S-4']} />
                            <LabeledInput label="Gas Pressure IN WC" value={formState.gasPressureInWC || ''} onChange={val => handleInputChange('gasPressureInWC', val)} />
                        </div>
                     </div>
                </div>

                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 pt-4">
                    <div>
                        <SectionTitle>Electric Heating</SectionTitle>
                        <div className="p-4 border border-t-0 space-y-2">
                            <GroupedLabeledInput label="RAT | SAT Temp °F" values={[formState.electricHeating_RAT_SAT_S1 || '', formState.electricHeating_RAT_SAT_S2 || '', formState.electricHeating_RAT_SAT_S3 || '', formState.electricHeating_RAT_SAT_S4 || '']} onChange={(i, v) => handleGroupedInputChange('electricHeating_RAT_SAT', i, v)} labels={['S-1', 'S-2', 'S-3', 'S-4']} />
                        </div>
                    </div>
                    <div>
                        <SectionTitle>Voltage</SectionTitle>
                        <div className="p-4 border border-t-0 space-y-2">
                            <LabeledInput label="T1-T2" value={formState.voltage_T1_T2 || ''} onChange={v => handleAmpVoltInputChange('voltage', 0, v)} />
                            <LabeledInput label="T2-T3" value={formState.voltage_T2_T3 || ''} onChange={v => handleAmpVoltInputChange('voltage', 1, v)} />
                            <LabeledInput label="T3-T1" value={formState.voltage_T3_T1 || ''} onChange={v => handleAmpVoltInputChange('voltage', 2, v)} />
                        </div>
                    </div>
                </div>

                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 pt-4">
                    <div>
                        <SectionTitle>Amps</SectionTitle>
                        <div className="p-4 border border-t-0 space-y-2">
                            <LabeledInput label="T1" value={formState.amps_T1 || ''} onChange={v => handleAmpVoltInputChange('amps', 0, v)} />
                            <LabeledInput label="T2" value={formState.amps_T2 || ''} onChange={v => handleAmpVoltInputChange('amps', 1, v)} />
                            <LabeledInput label="T3" value={formState.amps_T3 || ''} onChange={v => handleAmpVoltInputChange('amps', 2, v)} />
                        </div>
                    </div>
                    <div>
                        <SectionTitle>&nbsp;</SectionTitle>
                        <div className="p-4 border border-t-0">
                            <LabeledInput label="Checked Rotation" value={formState.checkedRotation || ''} onChange={val => handleInputChange('checkedRotation', val)} />
                        </div>
                    </div>
                </div>
                 <div className="flex justify-end gap-2 mt-8">
                    <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSaving}>
                      Cancel
                    </Button>
                    <Button onClick={handleSaveForm} disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Save Report
                    </Button>
                </div>
              </main>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
