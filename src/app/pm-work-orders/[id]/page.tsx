'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { MainLayout } from '@/components/main-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeft, Save, FileCheck, MapPin, Package, Calendar, Settings, Pencil, ChevronDown } from 'lucide-react';
import { useFirestore, useUser, updateDocumentNonBlocking } from '@/firebase';
import { getPmWorkOrderById } from '@/lib/data';
import type { PmWorkOrder, PmTask, PmAssetTaskGroup, PhotoMetadata } from '@/lib/types';
import { PmTaskItem } from '@/components/pm-task-item';
import { PmSubmissionModal } from '@/components/pm-submission-modal';
import { doc, getDoc, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function PmWorkOrderExecutionPage() {
  const { id } = useParams();
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [pmWO, setPmWorkOrder] = useState<PmWorkOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  
  const [isIdDialogOpen, setIsIdDialogOpen] = useState(false);
  const [newJobId, setNewJobId] = useState('');
  const [isUpdatingId, setIsUpdatingId] = useState(false);

  useEffect(() => {
    if (db && id) {
      getPmWorkOrderById(db, id as string).then(data => {
        if (data) {
          setPmWorkOrder(data);
          setNewJobId(data.id);
        }
        setIsLoading(false);
      });
    }
  }, [db, id]);

  const handleTaskUpdate = (groupIndex: number, taskIndex: number, updatedTask: PmTask) => {
    if (!pmWO) return;
    const newAssetTasks = [...pmWO.assetTasks];
    const newTasks = [...newAssetTasks[groupIndex].tasks];
    newTasks[taskIndex] = updatedTask;
    newAssetTasks[groupIndex] = { ...newAssetTasks[groupIndex], tasks: newTasks };
    
    setPmWorkOrder({ ...pmWO, assetTasks: newAssetTasks });
  };

  const handleUpdateId = async () => {
    if (!db || !pmWO || !newJobId || newJobId === pmWO.id) {
      setIsIdDialogOpen(false);
      return;
    }

    setIsUpdatingId(true);
    try {
      const newDocRef = doc(db, 'pm_work_orders', newJobId);
      const oldDocRef = doc(db, 'pm_work_orders', pmWO.id);
      
      // Check for duplicates in both job registries
      const [newPmSnap, standardWoSnap] = await Promise.all([
        getDoc(newDocRef),
        getDoc(doc(db, 'work_orders', newJobId))
      ]);

      if (newPmSnap.exists() || standardWoSnap.exists()) {
        toast({ title: "Duplicate Job Number", description: `The Job # "${newJobId}" is already in use.`, variant: "destructive" });
        setIsUpdatingId(false);
        return;
      }

      const batch = writeBatch(db);
      const updatedData = { ...pmWO, id: newJobId, updatedAt: new Date().toISOString() };
      
      batch.set(newDocRef, updatedData);
      batch.delete(oldDocRef);
      
      await batch.commit();
      
      toast({ title: "Job Number Updated" });
      router.replace(`/pm-work-orders/${newJobId}`);
      setIsIdDialogOpen(false);
    } catch (e) {
      toast({ title: "Update Failed", variant: 'destructive' });
    } finally {
      setIsUpdatingId(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!db || !pmWO) return;
    setIsSaving(true);
    try {
      const woRef = doc(db, 'pm_work_orders', pmWO.id);
      await updateDocumentNonBlocking(woRef, {
        assetTasks: pmWO.assetTasks,
        status: 'Submitted For Review',
        updatedAt: new Date().toISOString()
      });
      toast({ title: "Work Order Submitted" });
      router.push('/assets');
    } catch (e) {
      toast({ title: "Submission Failed", variant: 'destructive' });
    } finally {
      setIsSaving(false);
      setIsSubmitModalOpen(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!db || !pmWO) return;
    setIsSaving(true);
    try {
      const woRef = doc(db, 'pm_work_orders', pmWO.id);
      await updateDocumentNonBlocking(woRef, {
        assetTasks: pmWO.assetTasks,
        status: pmWO.status === 'Scheduled' ? 'In Progress' : pmWO.status,
        updatedAt: new Date().toISOString()
      });
      toast({ title: "Draft Saved" });
    } catch (e) {
      toast({ title: "Save Failed", variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <MainLayout><div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div></MainLayout>;
  if (!pmWO) return <MainLayout><div className="container py-12">PM Work Order not found.</div></MainLayout>;

  const isCompleted = pmWO.status === 'Completed' || pmWO.status === 'Submitted For Review';

  return (
    <MainLayout>
      <div className="container mx-auto py-8">
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <Button variant="ghost" className="mb-2 -ml-4" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">Preventative Maintenance</h1>
              <Badge variant={isCompleted ? "secondary" : "default"}>{pmWO.status}</Badge>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 items-center text-sm text-muted-foreground font-medium">
              <div className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {pmWO.workSiteName}</div>
              <div className="flex items-center gap-1.5"><Calendar className="h-4 w-4" /> {pmWO.scheduledMonth}/{pmWO.scheduledYear}</div>
              <div className="flex items-center gap-1.5 font-mono bg-muted/50 px-2 py-0.5 rounded border">
                ID: {pmWO.id}
                {!isCompleted && (
                  <Button variant="ghost" size="icon" className="h-5 w-5 ml-1" onClick={() => setIsIdDialogOpen(true)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          </div>
          {!isCompleted && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleSaveDraft} disabled={isSaving}>
                <Save className="mr-2 h-4 w-4" /> Save Draft
              </Button>
              <Button onClick={() => setIsSubmitModalOpen(true)} disabled={isSaving}>
                <FileCheck className="mr-2 h-4 w-4" /> Submit Review
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader className="pb-3">
                <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Units In This Scope</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-2 pr-3">
                    {pmWO.assetTasks.map((group, idx) => {
                      const unitTotal = group.tasks.length;
                      const unitDone = group.tasks.filter(t => t.completed || t.isNA).length;
                      const unitFinished = unitDone === unitTotal;
                      return (
                        <div key={idx} className="flex items-center justify-between text-xs border-b pb-2 last:border-0">
                          <span className={cn("truncate max-w-[150px] font-medium", unitFinished && "text-green-600")}>
                            {group.assetTag}
                          </span>
                          <Badge variant={unitFinished ? "default" : "outline"} className={cn("scale-75 origin-right", unitFinished && "bg-green-600")}>
                            {unitDone}/{unitTotal}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3 space-y-4">
            <Accordion type="multiple" className="space-y-4">
              {pmWO.assetTasks.map((group, groupIdx) => {
                const unitTotal = group.tasks.length;
                const unitDone = group.tasks.filter(t => t.completed || t.isNA).length;
                const unitFinished = unitDone === unitTotal;
                const unitProgressPercent = (unitDone / unitTotal) * 100;

                return (
                  <AccordionItem 
                    key={groupIdx} 
                    value={`item-${groupIdx}`} 
                    className={cn(
                      "border rounded-lg overflow-hidden transition-all",
                      unitFinished ? "border-green-200 bg-green-50/10" : "border-primary/10 bg-card"
                    )}
                  >
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex flex-col items-start text-left gap-1 w-full pr-4">
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-2">
                            <Package className={cn("h-5 w-5", unitFinished ? "text-green-600" : "text-primary")} />
                            <span className="text-lg font-bold">{group.assetName}</span>
                          </div>
                          {unitFinished ? (
                            <Badge className="bg-green-600 h-5 text-[10px] uppercase">Unit Done</Badge>
                          ) : (
                            <span className="text-[10px] font-black text-muted-foreground uppercase">{unitDone} / {unitTotal} Tasks</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-[10px] uppercase text-muted-foreground">TAG: {group.assetTag}</span>
                          <span className="text-[10px] text-muted-foreground">•</span>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">{group.templateName}</span>
                        </div>
                        {!unitFinished && (
                          <div className="w-full mt-2">
                            <Progress value={unitProgressPercent} className="h-1.5" />
                          </div>
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 pt-1">
                      <div className="flex justify-end mb-2">
                        <Button variant="outline" size="sm" asChild className="h-8 text-xs">
                          <Link href={`/assets/${group.assetId}`} target="_blank">
                            <Settings className="h-3 w-3 mr-2" /> Equipment History
                          </Link>
                        </Button>
                      </div>
                      <div className="space-y-3">
                        {group.tasks.map((task, taskIdx) => (
                          <PmTaskItem 
                            key={`${groupIdx}-${taskIdx}`} 
                            task={task} 
                            index={taskIdx} 
                            onUpdate={(updatedTask) => handleTaskUpdate(groupIdx, taskIdx, updatedTask)}
                            assetTag={group.assetTag}
                            isCompletedWorkOrder={isCompleted}
                          />
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        </div>
      </div>

      <PmSubmissionModal 
        isOpen={isSubmitModalOpen}
        onOpenChange={setIsSubmitModalOpen}
        assetTasks={pmWO.assetTasks}
        onConfirm={handleSubmitReview}
        isSubmitting={isSaving}
      />

      <Dialog open={isIdDialogOpen} onOpenChange={setIsIdDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Job Number</DialogTitle>
            <DialogDescription>
              Update the Job # for this preventative maintenance work order.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="pm-id">Job Number</Label>
              <Input 
                id="pm-id" 
                value={newJobId} 
                onChange={(e) => setNewJobId(e.target.value)} 
                placeholder="e.g. PM-12345"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsIdDialogOpen(false)} disabled={isUpdatingId}>
              Cancel
            </Button>
            <Button onClick={handleUpdateId} disabled={isUpdatingId || !newJobId || newJobId === pmWO.id}>
              {isUpdatingId && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
