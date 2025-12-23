
'use client';

import { useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from './ui/button';
import { useToast } from '@/hooks/use-toast';
import { Eraser } from 'lucide-react';

interface SignaturePadProps {
  onSave: (signatureDataUrl: string) => void;
  onClear: () => void;
}

export function SignaturePad({ onSave, onClear }: SignaturePadProps) {
  const sigRef = useRef<SignatureCanvas>(null);
  const { toast } = useToast();

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
  };
  
  const handleClear = () => {
    sigRef.current?.clear();
    onClear();
  }

  return (
    <div className="w-full">
        <style jsx>{`
            .signature-canvas {
                border: 2px dashed hsl(var(--border));
                border-radius: var(--radius);
                width: 100%;
                height: 100%;
                touch-action: none;
            }
        `}</style>
        <div className="w-full h-48 bg-muted rounded-md touch-none">
            <SignatureCanvas
                ref={sigRef}
                penColor="black"
                canvasProps={{
                    className: 'signature-canvas'
                }}
            />
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <Button variant="outline" onClick={handleClear}>
            <Eraser className="mr-2" />
            Clear
          </Button>
          <Button onClick={handleSave}>
            Save Signature
          </Button>
        </div>
    </div>
  );
}
