
'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { MainLayout } from '@/components/main-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { useFirestore, useUser, deleteDocumentNonBlocking } from '@/firebase';
import type { TrainingRecord, WorkOrder } from '@/lib/types';
import { Loader2, Trash2, Pencil, ArrowLeft } from 'lucide-react';
import { notFound, useParams, useRouter } from 'next/navigation';
import { getTrainingRecordById, getWorkOrderById } from '@/lib/data';
import { Skeleton } from '@/components/ui/skeleton';
import { TrainingRecordForm } from '@/components/training-record-form';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { doc } from 'firebase/firestore';


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

export default function ViewTrainingRecordPage() {
    const db = useFirestore();
    const { user } = useUser();
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const id = params.id as string;

    const [record, setRecord] = useState<TrainingRecord | null>(null);
    const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    const fetchRecord = async () => {
        if (!db || !id || !user) return;
        setIsLoading(true);
        try {
            const fetchedRecord = await getTrainingRecordById(db, id);
            if (fetchedRecord) {
                setRecord(fetchedRecord);
                if (fetchedRecord.workOrderId) {
                    const fetchedWorkOrder = await getWorkOrderById(db, fetchedRecord.workOrderId);
                    setWorkOrder(fetchedWorkOrder || null);
                }
            } else {
                notFound();
            }
        } catch (error) {
            console.error("Failed to fetch record:", error);
            notFound();
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        fetchRecord();
    }, [db, id, user])
    
    const handleFormSaved = () => {
        fetchRecord();
        setIsEditing(false);
    }
    
    const handleDelete = async () => {
        if (!db || !record) return;

        try {
            const recordRef = doc(db, 'training_records', record.id);
            await deleteDocumentNonBlocking(recordRef);
            toast({ title: "Training Record Deleted" });
            router.push('/training-attendance');
        } catch (error) {
            console.error("Error deleting record:", error);
            toast({ title: "Delete failed", variant: "destructive" });
        } finally {
            setIsDeleteDialogOpen(false);
        }
    };


    const ChecklistItem = ({ id, label, level = 0, subItem = false }: {id: string, label: string, level?: number, subItem?: boolean}) => (
        <div className="flex items-start gap-3" style={{ marginLeft: `${level * 1.5}rem` }}>
           {!subItem && <Checkbox id={id} checked={record?.checklist?.[id] || false} disabled className="mt-1" />}
           <label htmlFor={id} className="text-sm font-medium leading-normal flex-1">{label}</label>
        </div>
     );

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

    if (!record) {
        notFound();
    }


  return (
    <MainLayout>
      <div className="bg-white text-black min-h-screen">
        <div className="container mx-auto p-4 sm:p-8" style={{ maxWidth: '8.5in' }}>
            <div className="mb-6 flex justify-between items-center gap-4">
                <Button variant="outline" asChild>
                    <a href={record.workOrderId ? `/work-orders/${record.workOrderId}` : '/training-attendance'} className="flex items-center gap-2">
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </a>
                </Button>
                {!isEditing && (
                    <div className="flex items-center gap-2">
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
                 <TrainingRecordForm 
                    record={record}
                    workOrder={workOrder}
                    onFormSaved={handleFormSaved}
                    onCancel={() => setIsEditing(false)}
                 />
            ) : (
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
                            <Input readOnly value={workOrder ? `${workOrder.id} - ${workOrder.jobName}` : (record?.workOrderId || 'N/A')} />
                        </div>
                        <div className="grid sm:grid-cols-[150px_1fr] items-center gap-2">
                            <label className="font-semibold">Training Course:</label>
                            <Input readOnly value={record.trainingCourse} />
                        </div>
                        <div className="grid sm:grid-cols-[150px_1fr] items-center gap-2">
                            <label className="font-semibold">Trainer:</label>
                            <Input readOnly value={record.trainer} />
                        </div>
                        <div className="grid sm:grid-cols-[150px_1fr] items-start gap-2">
                            <label className="font-semibold">Description of Course (Include A List Of Belts & Filters):</label>
                            <Textarea rows={4} readOnly value={record.description} />
                        </div>
                        
                        <Separator className="my-6" />

                        <div className="grid sm:grid-cols-[150px_1fr] items-center gap-2">
                            <label className="font-semibold">BAS User Name:</label>
                            <Input readOnly value={record.basUserName} />
                        </div>
                        <div className="grid sm:grid-cols-[150px_1fr] items-center gap-2">
                            <label className="font-semibold">BAS Password:</label>
                            <Input readOnly type="password" value={record.basPassword || ''} />
                        </div>
                        <div className="grid sm:grid-cols-[150px_1fr] items-center gap-2">
                            <label className="font-semibold">Date:</label>
                            <Input readOnly value={record.date ? new Date(record.date).toLocaleDateString() : ''} />
                        </div>
                        <div className="grid sm:grid-cols-[150px_1fr] items-center gap-2">
                            <label className="font-semibold">Trainer Signature:</label>
                            <div className="border rounded-md p-2 h-20 flex items-center justify-center">
                            {record.trainerSignatureUrl ? (
                                <Image src={record.trainerSignatureUrl} alt="Trainer Signature" width={150} height={50} style={{ objectFit: 'contain' }} />
                            ) : (
                                <span className="text-muted-foreground text-sm">Not Signed</span>
                            )}
                            </div>
                        </div>
                        </div>

                        <div className="mt-8">
                        <div className="grid grid-cols-2 border-2 border-black">
                            <div className="p-2 font-bold text-center border-b-2 border-r-2 border-black">Attendees Name</div>
                            <div className="p-2 font-bold text-center border-b-2 border-black">Signature</div>
                            
                            {record.attendees.map((attendee) => (
                            <React.Fragment key={attendee.id}>
                                <div className="border-r-2 border-black flex items-center">
                                <Input 
                                    className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0" 
                                    readOnly
                                    value={attendee.name}
                                />
                                </div>
                                <div 
                                className="p-2 h-20 flex items-center justify-center"
                                >
                                {attendee.signatureUrl ? (
                                        <Image src={attendee.signatureUrl} alt={`Attendee ${attendee.name} Signature`} width={150} height={50} style={{ objectFit: 'contain' }} />
                                    ) : (
                                        <span className="text-muted-foreground text-sm">Not Signed</span>
                                    )}
                                </div>
                            </React.Fragment>
                            ))}
                            {record.attendees.length === 0 && (
                                <>
                                <div className="border-r-2 border-black p-2 text-center text-muted-foreground">No attendees</div>
                                <div className="p-2"></div>
                                </>
                            )}
                        </div>
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
                    </main>
                    </CardContent>
                </Card>
            )}
        </div>
      </div>
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this training record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
