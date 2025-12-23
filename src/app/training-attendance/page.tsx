
'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { MainLayout } from '@/components/main-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Separator } from '@/components/ui/separator';
import { SignaturePad } from '@/components/signature-pad';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useFirestore, addDocumentNonBlocking } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { uploadImage } from '@/firebase/storage';
import { collection } from 'firebase/firestore';
import type { TrainingRecord, Attendee } from '@/lib/types';
import { Loader2, PlusCircle, Trash2 } from 'lucide-react';

export default function TrainingAttendancePage() {
  const db = useFirestore();
  const { toast } = useToast();

  const [isSaving, setIsSaving] = useState(false);
  const [trainingCourse, setTrainingCourse] = useState('');
  const [trainer, setTrainer] = useState('');
  const [description, setDescription] = useState('');
  const [basUserName, setBasUserName] = useState('');
  const [basPassword, setBasPassword] = useState('');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [trainerSignatureUrl, setTrainerSignatureUrl] = useState<string | null>(null);
  const [attendees, setAttendees] = useState<Partial<Attendee>[]>([{ id: `attendee-${Date.now()}`, name: '' }]);
  
  const [isSignatureDialogOpen, setIsSignatureDialogOpen] = useState(false);
  const [signatureTarget, setSignatureTarget] = useState<{ type: 'trainer' | 'attendee'; index?: number } | null>(null);

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

  const openSignatureDialog = (type: 'trainer' | 'attendee', index?: number) => {
    setSignatureTarget({ type, index });
    setIsSignatureDialogOpen(true);
  };

  const handleSignatureSave = async (signatureDataUrl: string) => {
    if (!signatureTarget) return;

    try {
      const path = `signatures/training/${Date.now()}.png`;
      const url = await uploadImage(await (await fetch(signatureDataUrl)).blob(), path);

      if (signatureTarget.type === 'trainer') {
        setTrainerSignatureUrl(url);
      } else if (signatureTarget.type === 'attendee' && signatureTarget.index !== undefined) {
        const newAttendees = [...attendees];
        newAttendees[signatureTarget.index].signatureUrl = url;
        setAttendees(newAttendees);
      }
      
      toast({ title: 'Signature Saved' });
      setIsSignatureDialogOpen(false);
      setSignatureTarget(null);
    } catch (error) {
      console.error('Error uploading signature:', error);
      toast({ title: 'Error', description: 'Could not save signature.', variant: 'destructive' });
    }
  };

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
        const trainingRecordData = {
            trainingCourse,
            trainer,
            description,
            basUserName,
            basPassword,
            date: date.toISOString(),
            trainerSignatureUrl,
            attendees: attendees.filter(a => a.name) // Only save attendees with a name
        };

        await addDocumentNonBlocking(collection(db, 'training_records'), trainingRecordData);

        toast({ title: 'Training Record Saved' });
        // Reset form
        setTrainingCourse('');
        setTrainer('');
        setDescription('');
        setBasUserName('');
        setBasPassword('');
        setDate(new Date());
        setTrainerSignatureUrl(null);
        setAttendees([{ id: `attendee-${Date.now()}`, name: '' }]);

    } catch (error) {
        console.error("Error saving training record:", error);
        toast({ title: 'Save Failed', description: 'Could not save the training record.', variant: 'destructive' });
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
              <header className="flex flex-col sm:flex-row justify-between items-start mb-8 gap-4">
                <div className="relative h-24 w-64">
                  <Image src="https://www.crawford-company.com/hubfs/new-art-o-lite-logo-1.png" alt="Crawford Art-O-Lite Company Logo" fill style={{objectFit:"contain"}} />
                </div>
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
                 <div className="flex justify-end mt-8">
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
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Provide Signature</DialogTitle>
                    <DialogDescription>Please sign in the box below.</DialogDescription>
                </DialogHeader>
                <SignaturePad 
                    onSave={handleSignatureSave}
                    onClear={() => {}}
                />
            </DialogContent>
        </Dialog>
    </MainLayout>
  );
}
