
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { WorkSite } from '@/lib/types';
import { useFirestore, addDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';


interface WorkSiteFormProps {
    site: WorkSite | null;
    onFormSaved: () => void;
    onCancel: () => void;
}

export function WorkSiteForm({ site, onFormSaved, onCancel }: WorkSiteFormProps) {
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

    useEffect(() => {
        if (site) {
            setName(site.name || '');
            setAddress(site.address || '');
            setCity(site.city || '');
            setState(site.state || '');
            setZip(site.zip || '');
            setContactName(site.contact?.name || '');
            setContactPhone(site.contact?.phone || '');
            setContactEmail(site.contact?.email || '');
            setNotes(site.notes || '');
        } else {
            // Reset form for creating a new site
            setName('');
            setAddress('');
            setCity('');
            setState('');
            setZip('');
            setContactName('');
            setContactPhone('');
            setContactEmail('');
            setNotes('');
        }
    }, [site]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!db) {
            toast({ title: "Error", description: "Database not available", variant: 'destructive' });
            return;
        }

        if(!name || !address || !city || !state) {
            toast({ 
                title: "Missing Fields", 
                description: "Site Name, Address, City, and State are required.", 
                variant: 'destructive' 
            });
            return;
        }

        setIsLoading(true);

        const siteData: Omit<WorkSite, 'id'> = {
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
        
        try {
            if (site) { // Editing existing site
                const siteRef = doc(db, 'work_sites', site.id);
                const batch = writeBatch(db);
                
                // 1. Update the work site document itself
                batch.update(siteRef, siteData);

                // 2. If the name changed, find and update related work orders
                if (site.name !== name) {
                    const workOrdersQuery = query(collection(db, 'work_orders'), where("workSiteId", "==", site.id));
                    const workOrdersSnapshot = await getDocs(workOrdersQuery);
                    
                    workOrdersSnapshot.forEach(workOrderDoc => {
                        const workOrderRef = doc(db, 'work_orders', workOrderDoc.id);
                        batch.update(workOrderRef, { jobName: name });
                    });
                }
                
                // 3. Commit the batch
                await batch.commit();
                toast({ title: "Work Site Updated", description: `Successfully updated "${name}" and related work orders.`});

            } else { // Creating new site
                await addDocumentNonBlocking(collection(db, 'work_sites'), siteData);
                toast({ title: "Work Site Created", description: `Successfully created "${name}".`});
            }
            
            onFormSaved();

        } catch (error) {
            if (error instanceof Error && !error.message.includes('permission-error')) {
                console.error("Error saving work site:", error);
                toast({ title: "Error", description: `Could not ${site ? 'update' : 'create'} work site. Please try again.`, variant: 'destructive' });
            }
        } finally {
            setIsLoading(false);
        }
    };


    return (
        <form onSubmit={handleSubmit}>
            <Card>
                <CardHeader>
                    <CardTitle>{site ? 'Edit Work Site' : 'Add New Work Site'}</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                         <div className="space-y-2">
                            <Label htmlFor="site-name">Site Name <span className="text-destructive">*</span></Label>
                            <Input id="site-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Downtown Office Building" required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="address">Street Address <span className="text-destructive">*</span></Label>
                            <Input id="address" value={address} onChange={e => setAddress(e.target.value)} placeholder="e.g., 123 Main St" required />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                             <div className="space-y-2 sm:col-span-2">
                                <Label htmlFor="city">City <span className="text-destructive">*</span></Label>
                                <Input id="city" value={city} onChange={e => setCity(e.target.value)} required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="state">State <span className="text-destructive">*</span></Label>
                                <Input id="state" value={state} onChange={e => setState(e.target.value)} required />
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
            </Card>
            <div className="fixed bottom-0 left-0 w-full bg-background border-t shadow-lg">
                 <div className="container mx-auto py-3 px-4 flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>Cancel</Button>
                    <Button type="submit" disabled={isLoading}>
                         {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {site ? 'Save Changes' : 'Save Site'}
                    </Button>
                </div>
            </div>
        </form>
    );
}
