'use client';

import React, { useState } from 'react';
import Image from 'next/image';
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
  const [isSaving, setIsSaving] = useState(false);

  const [formState, setFormState] = useState<Partial<HvacStartupReport>>({
    date: new Date().toISOString(),
    suctionPressure: [],
    dischargePressure: [],
    crankcaseHeaterAmp: [],
    compressorAmp: [],
    compressorVoltage: [],
    motorRatedAmps: [],
    gasHeating_RAT_SAT: [],
    electricHeating_RAT_SAT: [],
    voltage: [],
    amps: [],
  });

  const workOrdersQuery = useMemoFirebase(() => db ? query(collection(db, 'work_orders'), where("status", "==", "In Progress")) : null, [db]);
  const { data: workOrders } = useCollection<WorkOrder>(workOrdersQuery);

  const techniciansQuery = useMemoFirebase(() => db ? query(collection(db, 'technicians')) : null, [db]);
  const { data: technicians } = useCollection<Technician>(techniciansQuery);

  const handleInputChange = (field: keyof HvacStartupReport, value: string) => {
    setFormState(prev => ({ ...prev, [field]: value }));
  };
  
  const handleArrayInputChange = (field: keyof HvacStartupReport, index: number, value: string) => {
      setFormState(prev => {
          const arr = (prev[field] as string[] | undefined) || [];
          const newArr = [...arr];
          newArr[index] = value;
          return {...prev, [field]: newArr};
      })
  }

  const resetForm = () => {
    setFormState({
        date: new Date().toISOString(),
        suctionPressure: [],
        dischargePressure: [],
        crankcaseHeaterAmp: [],
        compressorAmp: [],
        compressorVoltage: [],
        motorRatedAmps: [],
        gasHeating_RAT_SAT: [],
        electricHeating_RAT_SAT: [],
        voltage: [],
        amps: [],
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
                    <div className="space-y-1">
                        <label className="text-sm font-medium">Site/Work Order</label>
                         <Select onValueChange={(val) => handleInputChange('workOrderId', val)} value={formState.workOrderId} disabled={isSaving}>
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
                    <GroupedLabeledInput label="Condenser: Suction Pressure" values={formState.suctionPressure || []} onChange={(i, v) => handleArrayInputChange('suctionPressure', i, v)} labels={['S-1', 'S-2', 'S-3', 'S-4']} />
                    <GroupedLabeledInput label="Condenser: Discharge Pressure" values={formState.dischargePressure || []} onChange={(i, v) => handleArrayInputChange('dischargePressure', i, v)} labels={['S-1', 'S-2', 'S-3', 'S-4']} />
                    <GroupedLabeledInput label="Condenser: Crankcase Heater AMP" values={formState.crankcaseHeaterAmp || []} onChange={(i, v) => handleArrayInputChange('crankcaseHeaterAmp', i, v)} labels={['S-1', 'S-2', 'S-3', 'S-4']} />
                    <div>
                         <p className="text-sm text-muted-foreground sm:text-xs">Compressor AMP</p>
                         <LabeledInput label="T1" value={formState.compressorAmp?.[0] || ''} onChange={v => handleArrayInputChange('compressorAmp', 0, v)} />
                         <LabeledInput label="T2" value={formState.compressorAmp?.[1] || ''} onChange={v => handleArrayInputChange('compressorAmp', 1, v)} />
                         <LabeledInput label="T3" value={formState.compressorAmp?.[2] || ''} onChange={v => handleArrayInputChange('compressorAmp', 2, v)} />
                    </div>
                 </div>
                 
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 pt-4">
                    <div>
                        <p className="text-sm text-muted-foreground sm:text-xs">Compressor Voltage</p>
                        <LabeledInput label="T1-T2" value={formState.compressorVoltage?.[0] || ''} onChange={v => handleArrayInputChange('compressorVoltage', 0, v)} />
                        <LabeledInput label="T2-T3" value={formState.compressorVoltage?.[1] || ''} onChange={v => handleArrayInputChange('compressorVoltage', 1, v)} />
                        <LabeledInput label="T3-T1" value={formState.compressorVoltage?.[2] || ''} onChange={v => handleArrayInputChange('compressorVoltage', 2, v)} />
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
                             <LabeledInput label="T1" value={formState.motorRatedAmps?.[0] || ''} onChange={v => handleArrayInputChange('motorRatedAmps', 0, v)} />
                             <LabeledInput label="T2" value={formState.motorRatedAmps?.[1] || ''} onChange={v => handleArrayInputChange('motorRatedAmps', 1, v)} />
                             <LabeledInput label="T3" value={formState.motorRatedAmps?.[2] || ''} onChange={v => handleArrayInputChange('motorRatedAmps', 2, v)} />
                        </div>
                     </div>
                     <div>
                        <SectionTitle>Gas Heating</SectionTitle>
                        <div className="p-4 border border-t-0 space-y-2">
                            <GroupedLabeledInput label="RAT | SAT Temp °F" values={formState.gasHeating_RAT_SAT || []} onChange={(i, v) => handleArrayInputChange('gasHeating_RAT_SAT', i, v)} labels={['S-1', 'S-2', 'S-3', 'S-4']} />
                            <LabeledInput label="Gas Pressure IN WC" value={formState.gasPressureInWC || ''} onChange={val => handleInputChange('gasPressureInWC', val)} />
                        </div>
                     </div>
                </div>

                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 pt-4">
                    <div>
                        <SectionTitle>Electric Heating</SectionTitle>
                        <div className="p-4 border border-t-0 space-y-2">
                            <GroupedLabeledInput label="RAT | SAT Temp °F" values={formState.electricHeating_RAT_SAT || []} onChange={(i, v) => handleArrayInputChange('electricHeating_RAT_SAT', i, v)} labels={['S-1', 'S-2', 'S-3', 'S-4']} />
                        </div>
                    </div>
                    <div>
                        <SectionTitle>Voltage</SectionTitle>
                        <div className="p-4 border border-t-0 space-y-2">
                            <LabeledInput label="T1-T2" value={formState.voltage?.[0] || ''} onChange={v => handleArrayInputChange('voltage', 0, v)} />
                            <LabeledInput label="T2-T3" value={formState.voltage?.[1] || ''} onChange={v => handleArrayInputChange('voltage', 1, v)} />
                            <LabeledInput label="T3-T1" value={formState.voltage?.[2] || ''} onChange={v => handleArrayInputChange('voltage', 2, v)} />
                        </div>
                    </div>
                </div>

                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 pt-4">
                    <div>
                        <SectionTitle>Amps</SectionTitle>
                        <div className="p-4 border border-t-0 space-y-2">
                            <LabeledInput label="T1" value={formState.amps?.[0] || ''} onChange={v => handleArrayInputChange('amps', 0, v)} />
                            <LabeledInput label="T2" value={formState.amps?.[1] || ''} onChange={v => handleArrayInputChange('amps', 1, v)} />
                            <LabeledInput label="T3" value={formState.amps?.[2] || ''} onChange={v => handleArrayInputChange('amps', 2, v)} />
                        </div>
                    </div>
                    <div>
                        <SectionTitle>&nbsp;</SectionTitle>
                        <div className="p-4 border border-t-0">
                            <LabeledInput label="Checked Rotation" value={formState.checkedRotation || ''} onChange={val => handleInputChange('checkedRotation', val)} />
                        </div>
                    </div>
                </div>
                 <div className="flex justify-end mt-8">
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