
'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, notFound, useSearchParams } from 'next/navigation';
import { format, isSameDay } from 'date-fns';
import { useFirestore } from '@/firebase';
import { getWorkOrderById } from '@/lib/data';
import type { WorkOrder, Acknowledgement, WorkOrderNote } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Download, Loader2, Printer } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function WorkOrderAcknowledgmentPage() {
    const params = useParams();
    const id = params.id as string;
    const db = useFirestore();
    const printRef = useRef<HTMLDivElement>(null);
    const searchParams = useSearchParams();

    const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
    const [filteredAcks, setFilteredAcks] = useState<Acknowledgement[]>([]);
    const [filteredNotes, setFilteredNotes] = useState<WorkOrderNote[]>([]);
    const [filteredPhotos, setFilteredPhotos] = useState<string[]>([]);
    
    const [isLoading, setIsLoading] = useState(true);
    const [isDownloading, setIsDownloading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const dateParam = searchParams.get('date');
    const acknowledgmentDate = dateParam ? new Date(dateParam) : new Date();

    useEffect(() => {
        if (!id || !db) return;

        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const wo = await getWorkOrderById(db, id);
                if (!wo) {
                    notFound();
                    return;
                }
                setWorkOrder(wo);
                
                const ackDate = dateParam ? new Date(dateParam) : new Date();
                // Adjust for timezone offset by creating date in UTC
                const targetDate = new Date(Date.UTC(ackDate.getFullYear(), ackDate.getMonth(), ackDate.getDate()));


                const acknowledgements = (wo.acknowledgements || []).filter(ack => {
                    const ackDate = new Date(ack.date);
                    return isSameDay(ackDate, targetDate);
                });
                setFilteredAcks(acknowledgements);

                const notes = (wo.notes || []).filter(note => {
                    const noteDate = new Date(note.createdAt);
                     return isSameDay(noteDate, targetDate);
                });
                setFilteredNotes(notes);

                const photos = notes.flatMap(note => note.photoUrls || []);
                setFilteredPhotos(photos);


            } catch (err) {
                console.error("Error generating acknowledgment:", err);
                setError("Failed to generate acknowledgment data.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [id, db, dateParam]);

    const handleDownload = useCallback(async () => {
        const content = printRef.current;
        if (!content || !workOrder) return;
    
        setIsDownloading(true);
    
        try {
            const canvas = await html2canvas(content, { scale: 2, useCORS: true, allowTaint: true });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'pt',
                format: [canvas.width, canvas.height]
            });
            pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
            pdf.save(`Acknowledgment-${workOrder.id}-${format(acknowledgmentDate, 'yyyy-MM-dd')}.pdf`);
    
        } catch (e) {
            console.error("Error generating PDF:", e);
            setError("Failed to generate PDF.");
        } finally {
            setIsDownloading(false);
        }
    }, [workOrder, acknowledgmentDate]);
    
    const handlePrint = () => {
        window.print();
    }
    
    const proxiedUrl = (url: string) => `/api/image-proxy?url=${encodeURIComponent(url)}`;
    
    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-100">
                <div className="p-8 bg-white shadow-lg rounded-lg text-center">
                    <p className="text-lg font-medium">Generating Document...</p>
                    <Skeleton className="w-full h-96 mt-4" />
                </div>
            </div>
        );
    }
    
    if (error) {
        return (
             <div className="flex h-screen items-center justify-center bg-gray-100">
                <div className="p-8 bg-white shadow-lg rounded-lg text-center text-red-600">
                    <p className="text-lg font-medium">Error</p>
                    <p>{error}</p>
                </div>
            </div>
        );
    }

    if (!workOrder) {
        notFound();
    }

    return (
        <div className="bg-gray-100 min-h-screen py-8">
            <div id="action-buttons" className="fixed bottom-8 right-8 z-50 flex flex-col items-end gap-2 print:hidden">
                <Button onClick={handlePrint}>
                    <Printer className="mr-2 h-4 w-4" />
                    Print
                </Button>
                <Button onClick={handleDownload} disabled={isDownloading}>
                    {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    {isDownloading ? 'Downloading...' : 'Download PDF'}
                </Button>
            </div>

            <div className="bg-white text-black font-sans mx-auto p-8" style={{ width: '8.5in', minHeight: '11in' }} ref={printRef}>
                <header className="text-center mb-8">
                    <h1 className="text-2xl font-bold">Daily Work Acknowledgment</h1>
                    <p className="text-lg">{format(acknowledgmentDate, 'PPPP')}</p>
                </header>

                <section className="mb-8">
                    <h2 className="text-xl font-semibold border-b pb-2 mb-4">Work Order Details</h2>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                        <div className="font-bold">Job #:</div><div>{workOrder.id}</div>
                        <div className="font-bold">Job Name:</div><div>{workOrder.jobName}</div>
                        <div className="font-bold">Job Site:</div><div>{workOrder.workSite?.name || 'N/A'}</div>
                        <div className="font-bold">Address:</div><div>{workOrder.workSite?.address || 'N/A'}</div>
                    </div>
                </section>

                <section className="mb-8">
                    <h2 className="text-xl font-semibold border-b pb-2 mb-4">Signatures</h2>
                    {filteredAcks.length > 0 ? (
                        <div className="space-y-4">
                            {filteredAcks.map((ack, index) => (
                                <div key={index} className="grid grid-cols-3 gap-4 items-center">
                                    <div className="font-medium">{ack.name}</div>
                                    <div className="bg-gray-100 p-2 rounded-md col-span-2">
                                        <img src={proxiedUrl(ack.signatureUrl)} alt={`${ack.name}'s signature`} className="max-h-16 mx-auto" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-500">No signatures for this date.</p>
                    )}
                </section>
                
                <section className="mb-8">
                    <h2 className="text-xl font-semibold border-b pb-2 mb-4">Notes</h2>
                     {filteredNotes.length > 0 ? (
                        <ul className="list-disc pl-5 space-y-2">
                            {filteredNotes.map((note) => (
                                <li key={note.id} className="text-sm">{note.text}</li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-gray-500">No notes for this date.</p>
                    )}
                </section>
                
                <section className="break-before-page">
                    <h2 className="text-xl font-semibold border-b pb-2 mb-4">Photos from Notes</h2>
                     {filteredPhotos.length > 0 ? (
                        <div className="grid grid-cols-2 gap-4">
                            {filteredPhotos.map((url, index) => (
                                <div key={index} className="border p-2 rounded-md">
                                    <img src={proxiedUrl(url)} alt={`Daily photo ${index + 1}`} className="w-full h-auto" />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-500">No photos associated with notes for this date.</p>
                    )}
                </section>
            </div>
        </div>
    );
}
