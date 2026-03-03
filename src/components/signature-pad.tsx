
'use client';

import { useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

interface SignaturePadProps {
  onSave: (signatureDataUrl: string) => void;
  onClear: () => void;
  className?: string;
}

export function SignaturePad({ onSave, onClear, className }: SignaturePadProps) {
  const sigCanvas = useRef<SignatureCanvas>(null);

  const handleClear = () => {
    sigCanvas.current?.clear();
    onClear();
  };

  const handleSave = () => {
    if (sigCanvas.current) {
      if (sigCanvas.current.isEmpty()) {
        alert("Please provide a signature first.");
        return;
      }
      const dataUrl = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
      onSave(dataUrl);
    }
  };

  return (
    <div className={cn("w-full h-full flex flex-col p-0 bg-white", className)}>
      <div className="flex-1 bg-white overflow-hidden relative">
          <SignatureCanvas
            ref={sigCanvas}
            penColor="black"
            canvasProps={{ 
                className: 'w-full h-full cursor-crosshair',
                style: { width: '100%', height: '100%' }
            }}
          />
      </div>
      <div className="grid grid-cols-2 gap-0 border-t">
        <Button variant="ghost" onClick={handleClear} size="lg" className="h-16 rounded-none border-r text-lg font-bold">
          Clear
        </Button>
        <Button onClick={handleSave} size="lg" className="h-16 rounded-none text-lg font-bold bg-primary text-primary-foreground">
          Save Signature
        </Button>
      </div>
    </div>
  );
}
