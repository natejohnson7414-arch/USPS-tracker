'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, notFound, useSearchParams, useRouter } from 'next/navigation';
import { format, isSameDay } from 'date-fns';
import { useFirestore } from '@/firebase/provider';
import { getWorkOrderById } from '@/lib/data';
import type { WorkOrder, Acknowledgement, WorkOrderNote, PhotoMetadata } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Download, Loader2, Printer, ArrowLeft } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function WorkOrderAcknowledgmentPage() {
    const params = useParams();
    const id = params.id as string;
    const db = useFirestore();
    const printRef = useRef<HTMLDivElement>(null);
    const searchParams = useSearchParams();
    const router = useRouter();

    const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
    const [filteredAcks, setFilteredAcks] = useState<Acknowledgement[]>([]);
    const [filteredNotes, setFilteredNotes] = useState<WorkOrderNote[]>([]);
    const [beforePhotos, setBeforePhotos] = useState<string[]>([]);
    const [afterPhotos, setAfterPhotos] = useState<string[]>([]);
    const [notePhotos, setNotePhotos] = useState<string[]>([]);
    
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
                
                const acknowledgements = (wo.acknowledgements || []).filter(ack => {
                    const ackDateObj = new Date(ack.date);
                    return isSameDay(ackDateObj, ackDate);
                });
                setFilteredAcks(acknowledgements);

                const notes = (wo.notes || []).filter(note => {
                    const noteDate = new Date(note.createdAt);
                     return isSameDay(noteDate, ackDate);
                });
                setFilteredNotes(notes);

                const before = (wo.beforePhotoUrls || []).map(p => typeof p === 'string' ? p : p.url);
                const after = (wo.afterPhotoUrls || []).map(p => typeof p === 'string' ? p : p.url);
                const notePhotosList = notes.flatMap(note => (note.photoUrls || []).map(p => typeof p === 'string' ? p : p.url));
                
                setBeforePhotos(before);
                setAfterPhotos(after);
                setNotePhotos(notePhotosList);

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
            // Pre-load images to ensure they are rendered correctly by canvas
            const images = Array.from(content.getElementsByTagName('img'));
            await Promise.all(images.map(img => {
                if (img.complete) return Promise.resolve();
                return new Promise(resolve => {
                    img.onload = resolve;
                    img.onerror = resolve;
                });
            }));

            const pages = content.querySelectorAll('.pdf-page') as NodeListOf<HTMLElement>;
            let pdf: jsPDF | null = null;

            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                const canvas = await html2canvas(page, { 
                    scale: 2, 
                    useCORS: true, 
                    logging: false,
                    allowTaint: true,
                });
                
                const imgData = canvas.toDataURL('image/png');
                const pdfWidth = canvas.width;
                const pdfHeight = canvas.height;

                if (i === 0) {
                    pdf = new jsPDF({
                        orientation: pdfWidth > pdfHeight ? 'l' : 'p',
                        unit: 'pt',
                        format: [pdfWidth, pdfHeight]
                    });
                } else {
                    pdf!.addPage([pdfWidth, pdfHeight], pdfWidth > pdfHeight ? 'l' : 'p');
                }
                
                pdf!.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            }

            if (pdf) {
                pdf.save(`Acknowledgment-${workOrder.id}-${format(acknowledgmentDate, 'yyyy-MM-dd')}.pdf`);
            }
    
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
    
    const proxiedUrl = (url: string) => {
        if (!url) return '';
        if (url.startsWith('data:')) return url;
        return `/api/image-proxy?url=${encodeURIComponent(url)}`;
    };
    
    useEffect(() => {
        if (!isLoading && workOrder && searchParams.get('action') === 'download') {
            const timer = setTimeout(() => handleDownload(), 2000);
            return () => clearTimeout(timer);
        }
    }, [isLoading, workOrder, searchParams, handleDownload]);
    
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

    const photosPerPage = 6;
    const beforePhotoChunks = Array.from({ length: Math.ceil(beforePhotos.length / photosPerPage) }, (_, i) =>
        beforePhotos.slice(i * photosPerPage, i * photosPerPage + photosPerPage)
    );
    const afterPhotoChunks = Array.from({ length: Math.ceil(afterPhotos.length / photosPerPage) }, (_, i) =>
        afterPhotos.slice(i * photosPerPage, i * photosPerPage + photosPerPage)
    );
    const notePhotoChunks = Array.from({ length: Math.ceil(notePhotos.length / photosPerPage) }, (_, i) =>
        notePhotos.slice(i * photosPerPage, i * photosPerPage + photosPerPage)
    );

    return (
        <div className="bg-gray-100 min-h-screen py-8">
            <div id="action-buttons" className="fixed top-4 left-4 z-50 flex flex-col items-end gap-2 print:hidden">
                 <Button onClick={() => router.back()} variant="outline">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                </Button>
            </div>
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

            <div className="mx-auto" style={{ width: '8.5in' }} ref={printRef}>
                <div className="pdf-page bg-white text-black font-sans p-8 mb-8" style={{ minHeight: '11in' }}>
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
                        <div className="space-y-4">
                            {workOrder.customerSignatureUrl ? (
                                <div className="grid grid-cols-3 gap-4 items-center">
                                    <div className="font-medium">{workOrder.contactInfo || 'Customer Signature'}</div>
                                    <div className="bg-gray-100 p-2 rounded-md col-span-2">
                                        <img 
                                            src={proxiedUrl(workOrder.customerSignatureUrl)} 
                                            alt={`Signature`} 
                                            className="max-h-16 mx-auto" 
                                            crossOrigin="anonymous"
                                        />
                                    </div>
                                </div>
                            ) : filteredAcks.length > 0 ? (
                                filteredAcks.map((ack, index) => (
                                    <div key={index} className="grid grid-cols-3 gap-4 items-center">
                                        <div className="font-medium">{ack.name}</div>
                                        <div className="bg-gray-100 p-2 rounded-md col-span-2">
                                            <img 
                                                src={proxiedUrl(ack.signatureUrl)} 
                                                alt={`${ack.name}'s signature`} 
                                                className="max-h-16 mx-auto" 
                                                crossOrigin="anonymous"
                                            />
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-gray-500">No signatures available.</p>
                            )}
                        </div>
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
                </div>

                {beforePhotoChunks.map((chunk, pageIndex) => (
                    <div key={`before-${pageIndex}`} className="pdf-page bg-white text-black font-sans p-8 mb-8" style={{ minHeight: '11in' }}>
                        <header className="flex justify-between items-center mb-8">
                            <h2 className="text-xl font-semibold">Before Work Photos {beforePhotoChunks.length > 1 ? `(Page ${pageIndex + 1})` : ''}</h2>
                            <p className="text-sm text-gray-500">Job # {workOrder.id}</p>
                        </header>
                        <div className="grid grid-cols-2 gap-4">
                            {chunk.map((url, index) => (
                                <div key={index} className="border p-2 rounded-md flex flex-col items-center justify-center bg-gray-50" style={{ height: '280px' }}>
                                    <img 
                                        src={proxiedUrl(url)} 
                                        alt={`Before photo ${pageIndex * photosPerPage + index + 1}`} 
                                        className="max-w-full max-h-[240px] object-contain" 
                                        crossOrigin="anonymous"
                                    />
                                    <p className="text-xs text-muted-foreground mt-2">Before Photo {pageIndex * photosPerPage + index + 1}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}

                {afterPhotoChunks.map((chunk, pageIndex) => (
                    <div key={`after-${pageIndex}`} className="pdf-page bg-white text-black font-sans p-8 mb-8" style={{ minHeight: '11in' }}>
                        <header className="flex justify-between items-center mb-8">
                            <h2 className="text-xl font-semibold">After Work Photos {afterPhotoChunks.length > 1 ? `(Page ${pageIndex + 1})` : ''}</h2>
                            <p className="text-sm text-gray-500">Job # {workOrder.id}</p>
                        </header>
                        <div className="grid grid-cols-2 gap-4">
                            {chunk.map((url, index) => (
                                <div key={index} className="border p-2 rounded-md flex flex-col items-center justify-center bg-gray-50" style={{ height: '280px' }}>
                                    <img 
                                        src={proxiedUrl(url)} 
                                        alt={`After photo ${pageIndex * photosPerPage + index + 1}`} 
                                        className="max-w-full max-h-[240px] object-contain" 
                                        crossOrigin="anonymous"
                                    />
                                    <p className="text-xs text-muted-foreground mt-2">After Photo {pageIndex * photosPerPage + index + 1}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}

                {notePhotoChunks.map((chunk, pageIndex) => (
                    <div key={`note-photos-${pageIndex}`} className="pdf-page bg-white text-black font-sans p-8 mb-8" style={{ minHeight: '11in' }}>
                        <header className="flex justify-between items-center mb-8">
                            <h2 className="text-xl font-semibold">Field Photos {notePhotoChunks.length > 1 ? `(Page ${pageIndex + 1})` : ''}</h2>
                            <p className="text-sm text-gray-500">Job # {workOrder.id} - {format(acknowledgmentDate, 'yyyy-MM-dd')}</p>
                        </header>
                        <div className="grid grid-cols-2 gap-4">
                            {chunk.map((url, index) => (
                                <div key={index} className="border p-2 rounded-md flex flex-col items-center justify-center bg-gray-50" style={{ height: '280px' }}>
                                    <img 
                                        src={proxiedUrl(url)} 
                                        alt={`Daily photo ${pageIndex * photosPerPage + index + 1}`} 
                                        className="max-w-full max-h-[240px] object-contain" 
                                        crossOrigin="anonymous"
                                    />
                                    <p className="text-xs text-muted-foreground mt-2">Photo {pageIndex * photosPerPage + index + 1}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
