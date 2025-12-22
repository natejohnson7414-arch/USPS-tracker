'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { WorkSite } from '@/lib/types';
import { useFirestore, addDocumentNonBlocking } from '@/firebase';
import { collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';


interface WorkSiteFormProps {
    onSiteAdded: (newSite: WorkSite) => void;
    onCancel: () => void;
}

export function WorkSiteForm({ onSiteAdded, onCancel }: WorkSiteFormProps) {
    const db = useFirestore();
    const { toast } = useToast();
    const [name, setName] = useState('');
    const [address, setAddress] = useState('');
    const [city, setCity] = useState('');
    const [state, setState] = useState('');
    const [zip, setZip] = useState('');
    const [contactName, setContactName] = useState('');
    const [contactPhone, setContactPhone] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [notes, setNotes] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if(!db) {
            toast({ title: "Error", description: "Database not available", variant: 'destructive' });
            return;
        }

        if(!name || !address) {
            toast({ title: "Missing Fields", description: "Site Name and Address are required.", variant: 'destructive' });
            return;
        }

        setIsLoading(true);

        const workSitesRef = collection(db, 'work_sites');
        
        const newSiteData: Omit<WorkSite, 'id'> = {
            name,
            address,
            city,
            state,
            zip,
            contact: {
                name: contactName,
                phone: contactPhone,
                email: contactEmail,
            },
            notes
        };

        addDocumentNonBlocking(workSitesRef, newSiteData)
          .then((docRef) => {
                const newSite: WorkSite = {
                    id: docRef.id,
                    ...newSiteData
                };
                
                toast({ title: "Work Site Created", description: `Successfully created "${name}".`});
                onSiteAdded(newSite);
            })
          .catch((error) => {
                // The global error emitter will catch permission errors.
                // We can show a generic toast for other potential issues.
                if (!error.name.includes('Firebase')) { // Avoid double-toasting for permission errors
                    toast({ title: "Error", description: "Could not create work site. Please try again.", variant: 'destructive' });
                }
                console.error("Error creating work site:", error);
            })
          .finally(() => {
                setIsLoading(false);
            });
    };


    return (
        <Card>
            <CardHeader>
                <CardTitle>Add New Work Site</CardTitle>
            </CardHeader>
            <form onSubmit={handleSubmit}>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                         <div className="space-y-2">
                            <Label htmlFor="site-name">Site Name</Label>
                            <Input id="site-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Downtown Office Building" required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="address">Street Address</Label>
                            <Input id="address" value={address} onChange={e => setAddress(e.target.value)} placeholder="e.g., 123 Main St" required />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                             <div className="space-y-2 sm:col-span-2">
                                <Label htmlFor="city">City</Label>
                                <Input id="city" value={city} onChange={e => setCity(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="state">State</Label>
                                <Input id="state" value={state} onChange={e => setState(e.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="zip">ZIP Code</Label>
                            <Input id="zip" value={zip} onChange={e => setZip(e.target.value)} />
                        </div>
                    </div>
                     <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="contact-name">Contact Name</Label>
                            <Input id="contact-name" value={contactName} onChange={e => setContactName(e.target.value)} placeholder="e.g., Jane Doe" />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="contact-phone">Contact Phone</Label>
                            <Input id="contact-phone" type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="contact-email">Contact Email</Label>
                            <Input id="contact-email" type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="notes">Site Notes</Label>
                            <Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g., Access code is 1234. Beware of dog." />
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>Cancel</Button>
                    <Button type="submit" disabled={isLoading}>
                         {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Site
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
