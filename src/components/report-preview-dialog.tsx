'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from './ui/button';
import { Loader2, Printer, Download } from 'lucide-react';
import { useState } from 'react';

interface ReportPreviewDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  workOrderId: string;
}

export function ReportPreviewDialog({ isOpen, onOpenChange, workOrderId }: ReportPreviewDialogProps) {
  const [isLoading, setIsLoading] = useState(true);
  const reportUrl = `/work-orders/${workOrderId}/report`;
  
  const handlePrint = () => {
    const iframe = document.getElementById('report-iframe') as HTMLIFrameElement;
    if (iframe?.contentWindow) {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
    }
  };

  const handleDownload = () => {
    window.open(`${reportUrl}?action=download`, '_blank');
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Report Preview</DialogTitle>
          <DialogDescription>Work Order #{workOrderId}</DialogDescription>
        </DialogHeader>
        <div className="flex-1 relative border-t border-b">
            {isLoading && (
                 <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <span className="ml-2">Loading Preview...</span>
                </div>
            )}
            <iframe
              id="report-iframe"
              src={reportUrl}
              className="w-full h-full border-0"
              onLoad={() => setIsLoading(false)}
              title={`Report for Work Order ${workOrderId}`}
            />
        </div>
         <DialogFooter className="p-6 pt-4 flex-row justify-end space-x-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
            <Button onClick={handlePrint}><Printer className="mr-2 h-4 w-4"/> Print</Button>
            <Button onClick={handleDownload}><Download className="mr-2 h-4 w-4"/> Download PDF</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
