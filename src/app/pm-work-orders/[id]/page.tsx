
'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MainLayout } from '@/components/main-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeft, Save, FileCheck, MapPin, Package, Calendar, Settings } from 'lucide-react';
import { useFirestore, useUser, updateDocumentNonBlocking } from '@/firebase';
import { getPmWorkOrderById } from '@/lib/data';
import type { PmWorkOrder, PmTask, PmAssetTaskGroup, PhotoMetadata } from '@/lib/types';
import { PmTaskItem } from '@/components/pm-task-item';
import { PmSubmissionModal } from '@/components/pm-submission-modal';
import { doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';

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

  useEffect(() => {
    if (db && id) {
      getPmWorkOrderById(db, id as string).then(data => {
        if (data) setPmWorkOrder(data);
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

  const allTasks = pmWO.assetTasks.flatMap(g => g.tasks);
  const completedTasks = allTasks.filter(t => t.completed).length;
  const progress = allTasks.length > 0 ? (completedTasks / allTasks.length) * 100 : 0;
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
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground font-medium">
              <div className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {pmWO.workSiteName}</div>
              <div className="flex items-center gap-1.5"><Calendar className="h-4 w-4" /> {pmWO.scheduledMonth}/{pmWO.scheduledYear}</div>
              <div className="flex items-center gap-1.5"><Package className="h-4 w-4" /> {pmWO.assetTasks.length} Units</div>
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
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader><CardTitle className="text-sm font-bold uppercase">Consolidated Progress</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span>{completedTasks} of {allTasks.length} total tasks</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
                <div className="pt-4 space-y-3">
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Units in Scope</p>
                  {pmWO.assetTasks.map((group, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs border-b pb-2 last:border-0">
                      <span className="truncate max-w-[150px] font-medium">{group.assetTag}</span>
                      <Badge variant="outline" className="scale-75 origin-right">{group.tasks.filter(t => t.completed).length}/{group.tasks.length}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3 space-y-8">
            {pmWO.assetTasks.map((group, groupIdx) => (
              <Card key={groupIdx} className="overflow-hidden border-primary/10">
                <CardHeader className="bg-primary/5 py-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Package className="h-4 w-4 text-primary" />
                        {group.assetName}
                      </CardTitle>
                      <CardDescription className="font-mono text-[10px] uppercase">
                        TAG: {group.assetTag} • {group.templateName}
                      </CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/assets/${group.assetId}`} target="_blank">
                        <Settings className="h-4 w-4 mr-2" /> History
                      </Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
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
                </CardContent>
              </Card>
            ))}
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
    </MainLayout>
  );
}
