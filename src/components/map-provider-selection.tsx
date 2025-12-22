
'use client';

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "./ui/button";

interface MapProviderSelectionProps {
  address: string | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function MapProviderSelection({ address, isOpen, onOpenChange }: MapProviderSelectionProps) {
  
  const handleOpenMaps = (provider: 'google' | 'apple') => {
    if (!address) return;

    const encodedAddress = encodeURIComponent(address);
    let url;
    if (provider === 'google') {
      url = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
    } else {
      url = `http://maps.apple.com/?q=${encodedAddress}`;
    }
    window.open(url, '_blank');
    onOpenChange(false);
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Get Directions</AlertDialogTitle>
          <AlertDialogDescription>
            Choose your preferred maps application to open directions to:
            <br />
            <span className="font-semibold">{address}</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-col sm:space-x-0 gap-2">
            <Button onClick={() => handleOpenMaps('google')}>
              Open in Google Maps
            </Button>
             <Button onClick={() => handleOpenMaps('apple')}>
              Open in Apple Maps
            </Button>
             <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
