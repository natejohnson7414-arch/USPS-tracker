import AssetsPageContent from './assets-page-content';

/**
 * Server Component Shell
 * Segment config must be in a Server Component in Next.js 15.
 */
export const dynamic = "force-static";
export const revalidate = false;

export default function AssetsPage() {
  return <AssetsPageContent />;
}
