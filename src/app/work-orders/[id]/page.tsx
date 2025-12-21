
import { WorkOrderDetailClient } from './work-order-detail-client';

// This is now a Server Component responsible for handling the route.
export default function WorkOrderDetailPage({ params }: { params: { id: string } }) {
  // It renders the Client Component and passes the ID down.
  // All the complex logic is now inside WorkOrderDetailClient.
  return <WorkOrderDetailClient id={params.id} />;
}
