
'use client';

import { useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from './ui/button';
import { Eraser } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SignaturePadProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onSave: (signatureDataUrl: string) => void;
}

export function SignaturePad({ isOpen, setIsOpen, onSave }: SignaturePadProps) {
  const sigRef = useRef<SignatureCanvas>(null);
  const { toast } = useToast();

  const clear = () => {
    sigRef.current?.clear();
  };

  const handleSave = () => {
    if (!sigRef.current || sigRef.current.isEmpty()) {
      toast({
        title: 'Signature is empty',
        description: 'Please provide a signature before saving.',
        variant: 'destructive',
      });
      return;
    }

    const dataUrl = sigRef.current.getTrimmedCanvas().toDataURL('image/png');
    onSave(dataUrl);
    setIsOpen(false);
  };
  
  const handleOpenChange = (open: boolean) => {
    if (!open) {
        clear();
    }
    setIsOpen(open);
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Customer Signature</DialogTitle>
          <DialogDescription>Please sign in the box below.</DialogDescription>
        </DialogHeader>
        
        <div className="w-full border-2 border-dashed bg-muted rounded-md touch-none">
          <SignatureCanvas
            ref={sigRef}
            penColor="black"
            canvasProps={{
              className: 'w-full h-auto aspect-[2/1]',
            }}
          />
        </div>

        <DialogFooter className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={clear}>
            <Eraser className="mr-2" />
            Clear
          </Button>
          <Button onClick={handleSave}>
            Save Signature
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
