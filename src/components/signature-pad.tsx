
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
    <div className={cn("w-full h-full flex flex-col p-2 bg-background", className)}>
      <div className="flex-1 bg-muted rounded-md border border-input overflow-hidden relative">
          <SignatureCanvas
            ref={sigCanvas}
            penColor="black"
            canvasProps={{ 
                className: 'w-full h-full cursor-crosshair',
                style: { width: '100%', height: '100%' }
            }}
          />
          <div className="absolute top-2 left-2 pointer-events-none">
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest opacity-50">Sign Here</p>
          </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mt-3 pb-safe">
        <Button variant="outline" onClick={handleClear} size="lg" className="h-12">
          Clear
        </Button>
        <Button onClick={handleSave} size="lg" className="h-12">
          Save Signature
        </Button>
      </div>
    </div>
  );
}
