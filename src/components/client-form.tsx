
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { Client } from '@/lib/types';
import { useFirestore, addDocumentNonBlocking } from '@/firebase';
import { collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';


interface ClientFormProps {
    onClientAdded: (newClient: Client) => void;
    onCancel: () => void;
}

export function ClientForm({ onClientAdded, onCancel }: ClientFormProps) {
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
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if(!db) {
            toast({ title: "Error", description: "Database not available", variant: 'destructive' });
            return;
        }

        if(!name || !address) {
            toast({ title: "Missing Fields", description: "Client Name and Address are required.", variant: 'destructive' });
            return;
        }

        setIsLoading(true);

        const clientsRef = collection(db, 'clients');
        
        const newClientData: Omit<Client, 'id'> = {
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
        };

        addDocumentNonBlocking(clientsRef, newClientData)
          .then((docRef) => {
                const newClient: Client = {
                    id: docRef.id,
                    ...newClientData
                };
                
                toast({ title: "Client Created", description: `Successfully created "${name}".`});
                onClientAdded(newClient);
            })
          .catch((error) => {
                // The global error emitter will catch permission errors.
                if (!error.name.includes('Firebase')) { // Avoid double-toasting for permission errors
                    toast({ title: "Error", description: "Could not create client. Please try again.", variant: 'destructive' });
                }
                console.error("Error creating client:", error);
            })
          .finally(() => {
                setIsLoading(false);
            });
    };


    return (
        <form onSubmit={handleSubmit}>
            <Card>
                <CardHeader>
                    <CardTitle>Add New Client</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                         <div className="space-y-2">
                            <Label htmlFor="client-name">Client Name</Label>
                            <Input id="client-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., ACME Corporation" required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="address">Billing Address</Label>
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
                            <Input id="contact-name" value={contactName} onChange={e => setContactName(e.target.value)} placeholder="e.g., John Doe" />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="contact-phone">Contact Phone</Label>
                            <Input id="contact-phone" type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="contact-email">Contact Email</Label>
                            <Input id="contact-email" type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} />
                        </div>
                    </div>
                </CardContent>
            </Card>
            <div className="fixed bottom-0 left-0 w-full bg-background border-t shadow-lg">
                <div className="container mx-auto py-3 px-4 flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>Cancel</Button>
                    <Button type="submit" disabled={isLoading}>
                         {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Client
                    </Button>
                </div>
            </div>
        </form>
    );
}
