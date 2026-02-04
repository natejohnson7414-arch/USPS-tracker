
'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';
import { MainLayout } from '@/components/main-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Separator } from '@/components/ui/separator';
import { SignaturePad } from '@/components/signature-pad';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useFirestore, addDocumentNonBlocking, useCollection, useMemoFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { uploadImage } from '@/firebase/storage';
import { collection, query } from 'firebase/firestore';
import type { TrainingRecord, Attendee, WorkOrder } from '@/lib/types';
import { Loader2, PlusCircle, Trash2 } from 'lucide-react';
import { getWorkOrderById } from '@/lib/data';

const checklistItems = {
  item1: 'Have trainees sign the owners training sign-in sheet.',
  item2: 'Review basic operations of each new piece of equipment. A simple explanation of the piece of equipment we replaced works and ties into the rest of the system.',
  item3: 'Explain Basic Controls',
  item3i: 'What areas are tied to each controller or remote space temp sensors.',
  item3ii: 'How to open thermostats lockable cover or turn on BAS device.',
  item3iii: 'If password protected, provided password, record this on owner training sign in sheet.',
  item3iv: 'How to change from heating to cooling.',
  item3v: 'How to adjust temperatures.',
  item4: 'Train staff on basics of equipment. "Only on equipment we installed"',
  item4a: 'Show where and how to shut down the unit.',
  item4ai: 'Disconnects.',
  item4aii: 'Emergency shut down buttons',
  item4b: 'Show where filters are located.',
  item4bi: 'Give them filter count and sizes.',
  item4bii: 'Explain how often they need changing.',
  item4c: 'Show where belts are located.',
  item4ci: 'Give them belt count and sizes.',
  item4cii: 'Explain how often they need changing.',
  item4d: 'Show where condenser is located.',
  item4di: 'Explain to them the importance of a clean coil.',
  item4dii: 'Tell them how to identify a dirty coil.',
  item4e: 'Show them where the unit drains.',
  item4ei: 'Explain the importance of why it need to stay clean.',
  item4f: 'Show them where the chemical treatment is added',
  item4g: 'Show them where the cooling tower is located',
  item4gi: 'Explain the importance of why it needs to stay clean.',
  item4h: 'Explain what clearance equipment needs to operate, epically base board heaters.',
  item4i: 'Recommend a simple daily inspection. Consisting of simply taking a minute or two to walk through a mechanical room or facility and listening to the equipment and look for anything such as water on floor or anything out of normal.',
  item5: 'Ask who does there Maintenance? Recommend we give them a price, if they agree call office we may have you stay on-site and get a list of equipment/with belts and filter counts and sizes.',
};


export default function TrainingAttendancePage() {
  const db = useFirestore();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const woIdFromQuery = searchParams.get('workOrderId');

  const [isSaving, setIsSaving] = useState(false);
  const [trainingCourse, setTrainingCourse] = useState('');
  const [trainer, setTrainer] = useState('');
  const [description, setDescription] = useState('');
  const [basUserName, setBasUserName] = useState('');
  const [basPassword, setBasPassword] = useState('');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [trainerSignatureUrl, setTrainerSignatureUrl] = useState<string | null>(null);
  const [attendees, setAttendees] = useState<Partial<Attendee>[]>([{ id: `attendee-${Date.now()}`, name: '' }]);
  const [checklist, setChecklist] = useState<{[key: string]: boolean}>(
    Object.keys(checklistItems).reduce((acc, key) => ({ ...acc, [key]: false }), {})
  );
  
  const [isSignatureDialogOpen, setIsSignatureDialogOpen] = useState(false);
  const [signatureTarget, setSignatureTarget] = useState<{ type: 'trainer' | 'attendee'; index?: number } | null>(null);

  const [workOrderId, setWorkOrderId] = useState<string | undefined>();
  const workOrdersQuery = useMemoFirebase(() => db ? query(collection(db, 'work_orders')) : null, [db]);
  const { data: workOrders } = useCollection<WorkOrder>(workOrdersQuery);

  useEffect(() => {
    if (woIdFromQuery && db) {
        setWorkOrderId(woIdFromQuery);
        // fetch work order to pre-populate course name
        getWorkOrderById(db, woIdFromQuery).then(wo => {
            if (wo) {
                setTrainingCourse(wo.jobName);
            }
        });
    }
  }, [woIdFromQuery, db]);

  const handleAddAttendee = () => {
    setAttendees([...attendees, { id: `attendee-${Date.now()}`, name: '' }]);
  };

  const handleRemoveAttendee = (index: number) => {
    setAttendees(attendees.filter((_, i) => i !== index));
  };
  
  const handleAttendeeNameChange = (index: number, name: string) => {
    const newAttendees = [...attendees];
    newAttendees[index].name = name;
    setAttendees(newAttendees);
  };
  
  const handleChecklistChange = (key: string, checked: boolean) => {
    setChecklist(prev => ({...prev, [key]: checked}));
  }

  const openSignatureDialog = (type: 'trainer' | 'attendee', index?: number) => {
    setSignatureTarget({ type, index });
    setIsSignatureDialogOpen(true);
  };

  const handleSignatureSave = async (signatureDataUrl: string) => {
    if (!signatureTarget) return;

    const savingToast = toast({
      title: 'Saving Signature...',
      description: 'Uploading signature to storage.',
    });

    try {
      const path = `signatures/training/${Date.now()}_${signatureTarget.type}.png`;
      const response = await fetch(signatureDataUrl);
      const blob = await response.blob();
      const url = await uploadImage(blob, path);

      if (signatureTarget.type === 'trainer') {
        setTrainerSignatureUrl(url);
      } else if (signatureTarget.type === 'attendee' && signatureTarget.index !== undefined) {
        const newAttendees = [...attendees];
        newAttendees[signatureTarget.index].signatureUrl = url;
        setAttendees(newAttendees);
      }
      
      savingToast.dismiss();
      toast({ title: 'Signature Saved' });
      setIsSignatureDialogOpen(false);
      setSignatureTarget(null);

    } catch (error) {
      console.error('Error uploading signature:', error);
      savingToast.dismiss();
      toast({ title: 'Error', description: 'Could not save signature.', variant: 'destructive' });
    }
  };
  
  const resetForm = () => {
      setWorkOrderId(undefined);
      setTrainingCourse('');
      setTrainer('');
      setDescription('');
      setBasUserName('');
      setBasPassword('');
      setDate(new Date());
      setTrainerSignatureUrl(null);
      setAttendees([{ id: `attendee-${Date.now()}`, name: '' }]);
      setChecklist(Object.keys(checklistItems).reduce((acc, key) => ({ ...acc, [key]: false }), {}));
  }

  const handleSaveForm = async () => {
    if (!db) {
        toast({ title: "Database not connected", variant: "destructive" });
        return;
    }
    if (!trainingCourse || !trainer || !date) {
      toast({ title: "Missing Required Fields", description: "Training Course, Trainer, and Date are required.", variant: 'destructive' });
      return;
    }
    
    setIsSaving(true);
    
    try {
        const trainingRecordData: Omit<TrainingRecord, 'id'> = {
            workOrderId: workOrderId || null,
            trainingCourse,
            trainer,
            description,
            basUserName,
            basPassword: basPassword || null,
            date: date.toISOString(),
            trainerSignatureUrl: trainerSignatureUrl || null,
            attendees: attendees.filter(a => a.name).map(a => ({
                id: a.id || `attendee-${Date.now()}`,
                name: a.name || '',
                signatureUrl: a.signatureUrl || null,
            })),
            checklist,
        };

        await addDocumentNonBlocking(collection(db, 'training_records'), trainingRecordData);

        toast({ title: 'Training Record Saved' });
        resetForm();

    } catch (error) {
        if (error instanceof Error && !error.message.includes('permission-error')) {
            console.error("Error saving training record:", error);
            toast({ title: 'Save Failed', description: 'Could not save the training record.', variant: 'destructive' });
        }
    } finally {
        setIsSaving(false);
    }
  };

  const ChecklistItem = ({ id, label, level = 0, subItem = false }: {id: string, label: string, level?: number, subItem?: boolean}) => (
     <div className="flex items-start gap-3" style={{ marginLeft: `${level * 1.5}rem` }}>
        {!subItem && <Checkbox id={id} checked={checklist[id]} onCheckedChange={(checked) => handleChecklistChange(id, Boolean(checked))} className="mt-1" />}
        <label htmlFor={id} className="text-sm font-medium leading-normal flex-1">{label}</label>
     </div>
  );


  return (
    <MainLayout>
      <div className="bg-white text-black min-h-screen">
        <div className="container mx-auto p-4 sm:p-8" style={{ maxWidth: '8.5in' }}>
          <Card className="shadow-lg">
            <CardContent className="p-6 sm:p-8">
              <header className="flex flex-col sm:flex-row justify-end items-start mb-8 gap-4">
                <div className="text-right text-xs sm:text-sm">
                  <p className="font-bold">Heating / Air Conditioning / Plumbing / Piping / Electrical</p>
                  <p>1306 Mill Street Rock Island, Illinois 61265</p>
                  <p>Phone: (309) 788-4573 Fax: (309) 788-4691</p>
                  <p>www.Crawford-Company.Com</p>
                </div>
              </header>

              <main>
                <h1 className="text-xl sm:text-2xl font-bold text-center border-b-2 border-black pb-2 mb-6">
                  Training Attendance Record
                </h1>

                <div className="space-y-4">
                   <div className="grid sm:grid-cols-[150px_1fr] items-center gap-2">
                    <label className="font-semibold">Work Order:</label>
                     <Select onValueChange={setWorkOrderId} value={workOrderId} disabled={isSaving || !!woIdFromQuery}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a work order (optional)" />
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
                  <div className="grid sm:grid-cols-[150px_1fr] items-center gap-2">
                    <label className="font-semibold">Training Course:</label>
                    <Input value={trainingCourse} onChange={e => setTrainingCourse(e.target.value)} />
                  </div>
                  <div className="grid sm:grid-cols-[150px_1fr] items-center gap-2">
                    <label className="font-semibold">Trainer:</label>
                    <Input value={trainer} onChange={e => setTrainer(e.target.value)} />
                  </div>
                  <div className="grid sm:grid-cols-[150px_1fr] items-start gap-2">
                    <label className="font-semibold">Description of Course (Include A List Of Belts & Filters):</label>
                    <Textarea rows={4} value={description} onChange={e => setDescription(e.target.value)} />
                  </div>
                  
                  <Separator className="my-6" />

                  <div className="grid sm:grid-cols-[150px_1fr] items-center gap-2">
                    <label className="font-semibold">BAS User Name:</label>
                    <Input value={basUserName} onChange={e => setBasUserName(e.target.value)} />
                  </div>
                   <div className="grid sm:grid-cols-[150px_1fr] items-center gap-2">
                    <label className="font-semibold">BAS Password:</label>
                    <Input type="password" value={basPassword} onChange={e => setBasPassword(e.target.value)} />
                  </div>
                  <div className="grid sm:grid-cols-[150px_1fr] items-center gap-2">
                    <label className="font-semibold">Date:</label>
                    <DatePicker date={date} setDate={setDate} />
                  </div>
                   <div className="grid sm:grid-cols-[150px_1fr] items-center gap-2">
                    <label className="font-semibold">Trainer Signature:</label>
                     <div className="border rounded-md p-2 h-20 flex items-center justify-center cursor-pointer hover:bg-muted" onClick={() => openSignatureDialog('trainer')}>
                      {trainerSignatureUrl ? (
                        <Image src={trainerSignatureUrl} alt="Trainer Signature" width={150} height={50} style={{ objectFit: 'contain' }} />
                      ) : (
                        <span className="text-muted-foreground text-sm">Click to sign</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  <div className="grid grid-cols-2 border-2 border-black">
                    <div className="p-2 font-bold text-center border-b-2 border-r-2 border-black">Attendees Name</div>
                    <div className="p-2 font-bold text-center border-b-2 border-black">Signature</div>
                    
                    {attendees.map((attendee, index) => (
                      <React.Fragment key={attendee.id}>
                        <div className="border-r-2 border-black flex items-center">
                          <Input 
                            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0" 
                            placeholder={`Attendee ${index + 1}`}
                            value={attendee.name}
                            onChange={(e) => handleAttendeeNameChange(index, e.target.value)}
                          />
                           <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleRemoveAttendee(index)}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                        <div 
                          className="p-2 h-20 flex items-center justify-center cursor-pointer hover:bg-muted"
                          onClick={() => openSignatureDialog('attendee', index)}
                        >
                           {attendee.signatureUrl ? (
                                <Image src={attendee.signatureUrl} alt={`Attendee ${index + 1} Signature`} width={150} height={50} style={{ objectFit: 'contain' }} />
                            ) : (
                                <span className="text-muted-foreground text-sm">Click to sign</span>
                            )}
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                   <Button variant="outline" size="sm" className="mt-4" onClick={handleAddAttendee}>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Add Attendee
                    </Button>
                </div>

                <Separator className="my-8" />
                
                <div className="space-y-4">
                    <h2 className="text-xl font-bold text-center">Owners Training Check List</h2>
                    <ChecklistItem id="item1" label={checklistItems.item1} />
                    <ChecklistItem id="item2" label={checklistItems.item2} />
                    
                    <ChecklistItem id="item3" label={checklistItems.item3} />
                    <ChecklistItem id="item3i" label={`i. ${checklistItems.item3i}`} level={1} subItem={true} />
                    <ChecklistItem id="item3ii" label={`ii. ${checklistItems.item3ii}`} level={1} subItem={true} />
                    <ChecklistItem id="item3iii" label={`iii. ${checklistItems.item3iii}`} level={1} subItem={true} />
                    <ChecklistItem id="item3iv" label={`iv. ${checklistItems.item3iv}`} level={1} subItem={true} />
                    <ChecklistItem id="item3v" label={`v. ${checklistItems.item3v}`} level={1} subItem={true} />

                    <ChecklistItem id="item4" label={checklistItems.item4} />
                    <div style={{ marginLeft: `1.5rem` }} className="space-y-4">
                        <ChecklistItem id="item4a" label={`a. ${checklistItems.item4a}`} />
                         <ChecklistItem id="item4ai" label={`i. ${checklistItems.item4ai}`} level={1} subItem={true} />
                         <ChecklistItem id="item4aii" label={`ii. ${checklistItems.item4aii}`} level={1} subItem={true} />

                        <ChecklistItem id="item4b" label={`b. ${checklistItems.item4b}`} />
                        <ChecklistItem id="item4bi" label={`i. ${checklistItems.item4bi}`} level={1} subItem={true} />
                        <ChecklistItem id="item4bii" label={`ii. ${checklistItems.item4bii}`} level={1} subItem={true} />
                        
                        <ChecklistItem id="item4c" label={`c. ${checklistItems.item4c}`} />
                        <ChecklistItem id="item4ci" label={`i. ${checklistItems.item4ci}`} level={1} subItem={true} />
                        <ChecklistItem id="item4cii" label={`ii. ${checklistItems.item4cii}`} level={1} subItem={true} />

                        <ChecklistItem id="item4d" label={`d. ${checklistItems.item4d}`} />
                        <ChecklistItem id="item4di" label={`i. ${checklistItems.item4di}`} level={1} subItem={true} />
                        <ChecklistItem id="item4dii" label={`ii. ${checklistItems.item4dii}`} level={1} subItem={true} />
                        
                        <ChecklistItem id="item4e" label={`e. ${checklistItems.item4e}`} />
                        <ChecklistItem id="item4ei" label={`i. ${checklistItems.item4ei}`} level={1} subItem={true} />

                        <ChecklistItem id="item4f" label={`f. ${checklistItems.item4f}`} />
                        <ChecklistItem id="item4g" label={`g. ${checklistItems.item4g}`} />
                         <ChecklistItem id="item4gi" label={`i. ${checklistItems.item4gi}`} level={1} subItem={true} />

                        <ChecklistItem id="item4h" label={`h. ${checklistItems.item4h}`} />
                        <ChecklistItem id="item4i" label={`i. ${checklistItems.item4i}`} />
                    </div>
                     <ChecklistItem id="item5" label={checklistItems.item5} />
                </div>


                 <div className="flex justify-end gap-2 mt-8">
                    <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSaving}>
                        Cancel
                    </Button>
                    <Button onClick={handleSaveForm} disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Save Record
                    </Button>
                </div>
              </main>
            </CardContent>
          </Card>
        </div>
      </div>

       <Dialog open={isSignatureDialogOpen} onOpenChange={setIsSignatureDialogOpen}>
            <DialogContent className="h-[90vh] w-[90vw] max-w-full flex flex-col">
                <DialogHeader>
                    <DialogTitle>Provide Signature</DialogTitle>
                    <DialogDescription>Please sign in the box below.</DialogDescription>
                </DialogHeader>
                <SignaturePad 
                    onSave={handleSignatureSave}
                    onClear={() => {}}
                    className="flex-1 min-h-0 py-4"
                />
            </DialogContent>
        </Dialog>
    </MainLayout>
  );
}
