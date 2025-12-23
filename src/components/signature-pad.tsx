
'use client';

import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';

interface SignaturePadProps {
  onSave: (signatureDataUrl: string) => void;
  onClear: () => void;
}

/**
 * NOTE: This component is currently not functional.
 * The underlying canvas functionality could not be fixed.
 */
export function SignaturePad({ onSave, onClear }: SignaturePadProps) {
  return (
    <div className="w-full">
        <Card>
            <CardContent className="w-full h-48 bg-muted rounded-md flex items-center justify-center p-4">
                <p className="text-destructive text-center">
                    The signature pad is currently non-functional. The developer was unable to resolve the issue.
                </p>
            </CardContent>
        </Card>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <Button variant="outline" onClick={onClear} disabled>
            Clear
          </Button>
          <Button onClick={() => {}} disabled>
            Save Signature
          </Button>
        </div>
    </div>
  );
}
