import { getWorkOrderById, getTechnicians } from '@/lib/data';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { MainLayout } from '@/components/main-layout';
import { WorkOrderDetails } from '@/components/work-order-details';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function WorkOrderDetailPage({ params }: { params: { id: string } }) {
  const workOrder = getWorkOrderById(params.id);
  const technicians = getTechnicians();

  if (!workOrder) {
    notFound();
  }

  return (
    <MainLayout>
      <div className="container mx-auto py-8">
        <div className="mb-6">
          <Button variant="outline" asChild>
            <Link href="/" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </div>
        <WorkOrderDetails initialWorkOrder={workOrder} technicians={technicians} />
      </div>
    </MainLayout>
  );
}
