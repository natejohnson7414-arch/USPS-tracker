import { getWorkOrders, getTechnicians } from '@/lib/data';
import { DashboardClient } from './dashboard-client';
import { MainLayout } from '@/components/main-layout';

export default function DashboardPage() {
  const workOrders = getWorkOrders();
  const technicians = getTechnicians();

  return (
    <MainLayout>
      <DashboardClient initialWorkOrders={workOrders} technicians={technicians} />
    </MainLayout>
  );
}
