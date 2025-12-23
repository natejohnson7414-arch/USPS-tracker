
'use client';

import { useRef, useEffect, useState } from 'react';
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

interface SignaturePadProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onSave: (signatureDataUrl: string) => void;
}

export function SignaturePad({ isOpen, setIsOpen, onSave }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);

  const getCanvasContext = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext('2d');
  };

  const clearCanvas = () => {
    const context = getCanvasContext();
    if (context && canvasRef.current) {
      context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      setHasSigned(false);
    }
  };
  
  useEffect(() => {
    if (!isOpen) {
      clearCanvas();
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas dimensions based on container
    const rect = canvas.parentElement!.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = 200; // Fixed height

    const context = getCanvasContext();
    if (!context) return;
    context.strokeStyle = '#000000';
    context.lineWidth = 2;
    context.lineCap = 'round';
    context.lineJoin = 'round';

    const getTouchPos = (canvas: HTMLCanvasElement, touch: Touch) => {
        const rect = canvas.getBoundingClientRect();
        return {
          x: touch.clientX - rect.left,
          y: touch.clientY - rect.top,
        };
    };

    const startDrawing = (event: MouseEvent | TouchEvent) => {
      event.preventDefault();
      const context = getCanvasContext();
      if (!context) return;

      setIsDrawing(true);
      setHasSigned(true);
      
      let x, y;
      if (event instanceof MouseEvent) {
        x = event.offsetX;
        y = event.offsetY;
      } else {
        const touchPos = getTouchPos(canvas, event.touches[0]);
        x = touchPos.x;
        y = touchPos.y;
      }
      context.beginPath();
      context.moveTo(x, y);
    };

    const draw = (event: MouseEvent | TouchEvent) => {
      event.preventDefault();
      if (!isDrawing) return;
      
      const context = getCanvasContext();
      if (!context) return;

      let x, y;
      if (event instanceof MouseEvent) {
        x = event.offsetX;
        y = event.offsetY;
      } else {
        const touchPos = getTouchPos(canvas, event.touches[0]);
        x = touchPos.x;
        y = touchPos.y;
      }

      context.lineTo(x, y);
      context.stroke();
    };

    const stopDrawing = () => {
      const context = getCanvasContext();
      if (!context) return;
      context.closePath();
      setIsDrawing(false);
    };
    
    // Mouse events
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);

    // Touch events
    canvas.addEventListener('touchstart', startDrawing);
    canvas.addEventListener('touchmove', draw);
    canvas.addEventListener('touchend', stopDrawing);

    return () => {
      canvas.removeEventListener('mousedown', startDrawing);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', stopDrawing);
      canvas.removeEventListener('mouseleave', stopDrawing);
      canvas.removeEventListener('touchstart', startDrawing);
      canvas.removeEventListener('touchmove', draw);
      canvas.removeEventListener('touchend', stopDrawing);
    };
  }, [isOpen, isDrawing]);

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (canvas && hasSigned) {
      const dataUrl = canvas.toDataURL('image/png');
      onSave(dataUrl);
      setIsOpen(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Customer Signature</DialogTitle>
          <DialogDescription>Please sign in the box below.</DialogDescription>
        </DialogHeader>
        <div className="w-full h-[200px] border bg-muted rounded-md touch-none">
            <canvas ref={canvasRef} />
        </div>
        <DialogFooter className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={clearCanvas}>
            <Eraser className="mr-2" />
            Clear
          </Button>
          <Button onClick={handleSave} disabled={!hasSigned}>
            Save Signature
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
