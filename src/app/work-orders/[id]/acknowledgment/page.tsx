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
            // Pre-load all images explicitly to ensure canvas capture works
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
                
                const imgData = canvas.toDataURL('image/jpeg', 0.8);
                const pdfWidth = 612; // 8.5" at 72dpi
                const pdfHeight = 792; // 11" at 72dpi

                if (i === 0) {
                    pdf = new jsPDF({
                        orientation: 'p',
                        unit: 'pt',
                        format: 'letter'
                    });
                } else {
                    pdf!.addPage('letter', 'p');
                }
                
                pdf!.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            }

            if (pdf) {
                pdf.save(`Acknowledgment-${workOrder.id}-${format(acknowledgmentDate, 'yyyy-MM-dd')}.pdf`);
            }
    
        } catch (e) {
            console.error("Error generating PDF:", e);
            setError("Failed to generate PDF archive.");
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
            const timer = setTimeout(() => handleDownload(), 2500);
            return () => clearTimeout(timer);
        }
    }, [isLoading, workOrder, searchParams, handleDownload]);
    
    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-100">
                <div className="p-8 bg-white shadow-lg rounded-lg text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mb-4" />
                    <p className="text-lg font-medium">Generating Document Documentation...</p>
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
                        <h1 className="text-2xl font-bold uppercase tracking-tight">Daily Work Acknowledgment</h1>
                        <p className="text-lg text-muted-foreground">{format(acknowledgmentDate, 'PPPP')}</p>
                    </header>

                    <section className="mb-8">
                        <h2 className="text-xl font-bold border-b-2 border-black pb-2 mb-4 uppercase text-[12px] tracking-widest">Work Order Details</h2>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                            <div className="font-bold uppercase text-[10px] text-muted-foreground">Job #:</div><div className="font-mono font-bold">{workOrder.id}</div>
                            <div className="font-bold uppercase text-[10px] text-muted-foreground">Job Name:</div><div>{workOrder.jobName}</div>
                            <div className="font-bold uppercase text-[10px] text-muted-foreground">Job Site:</div><div>{workOrder.workSite?.name || 'N/A'}</div>
                            <div className="font-bold uppercase text-[10px] text-muted-foreground">Address:</div><div className="text-xs">{workOrder.workSite?.address || 'N/A'}</div>
                        </div>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-bold border-b-2 border-black pb-2 mb-4 uppercase text-[12px] tracking-widest">Signatures & Verification</h2>
                        <div className="space-y-6">
                            {workOrder.customerSignatureUrl ? (
                                <div className="grid grid-cols-3 gap-4 items-center border p-4 rounded-lg bg-slate-50/50">
                                    <div className="font-bold uppercase text-[10px] text-muted-foreground">{workOrder.contactInfo || 'Customer Signature'}</div>
                                    <div className="bg-white p-2 border rounded-md col-span-2 flex items-center justify-center min-h-[80px]">
                                        <img 
                                            src={proxiedUrl(workOrder.customerSignatureUrl)} 
                                            alt={`Signature`} 
                                            className="max-h-16" 
                                            crossOrigin="anonymous"
                                        />
                                    </div>
                                </div>
                            ) : filteredAcks.length > 0 ? (
                                filteredAcks.map((ack, index) => (
                                    <div key={index} className="grid grid-cols-3 gap-4 items-center border p-4 rounded-lg bg-slate-50/50">
                                        <div className="font-bold uppercase text-[10px] text-muted-foreground">{ack.name}</div>
                                        <div className="bg-white p-2 border rounded-md col-span-2 flex items-center justify-center min-h-[80px]">
                                            <img 
                                                src={proxiedUrl(ack.signatureUrl)} 
                                                alt={`${ack.name}'s signature`} 
                                                className="max-h-16" 
                                                crossOrigin="anonymous"
                                            />
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-10 border-2 border-dashed rounded-lg">
                                    <p className="text-sm text-muted-foreground italic">No signatures recorded for this date.</p>
                                </div>
                            )}
                        </div>
                    </section>
                    
                    <section className="mb-8">
                        <h2 className="text-xl font-bold border-b-2 border-black pb-2 mb-4 uppercase text-[12px] tracking-widest">Daily Field Notes</h2>
                         {filteredNotes.length > 0 ? (
                            <ul className="space-y-3">
                                {filteredNotes.map((note) => (
                                    <li key={note.id} className="text-sm border-l-4 border-primary pl-4 py-1 bg-slate-50/30">{note.text}</li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-muted-foreground italic">No descriptive notes logged for this session.</p>
                        )}
                    </section>
                </div>

                {beforePhotoChunks.map((chunk, pageIndex) => (
                    <div key={`before-${pageIndex}`} className="pdf-page bg-white text-black font-sans p-8 mb-8" style={{ minHeight: '11in' }}>
                        <header className="flex justify-between items-center mb-8 border-b-2 pb-2 border-primary">
                            <h2 className="text-xl font-bold uppercase tracking-tighter text-primary">BEFORE WORK PHOTOS {beforePhotoChunks.length > 1 ? `(Page ${pageIndex + 1})` : ''}</h2>
                            <p className="text-xs font-mono font-bold">Job # {workOrder.id}</p>
                        </header>
                        <div className="grid grid-cols-2 gap-6">
                            {chunk.map((url, index) => (
                                <div key={index} className="border p-2 rounded-md flex flex-col items-center justify-center bg-gray-50 shadow-sm" style={{ height: '320px' }}>
                                    <img 
                                        src={proxiedUrl(url)} 
                                        alt={`Before photo ${pageIndex * photosPerPage + index + 1}`} 
                                        className="max-w-full max-h-[280px] object-contain" 
                                        crossOrigin="anonymous"
                                    />
                                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mt-2">Before Photo {pageIndex * photosPerPage + index + 1}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}

                {afterPhotoChunks.map((chunk, pageIndex) => (
                    <div key={`after-${pageIndex}`} className="pdf-page bg-white text-black font-sans p-8 mb-8" style={{ minHeight: '11in' }}>
                        <header className="flex justify-between items-center mb-8 border-b-2 pb-2 border-primary">
                            <h2 className="text-xl font-bold uppercase tracking-tighter text-primary">AFTER WORK PHOTOS {afterPhotoChunks.length > 1 ? `(Page ${pageIndex + 1})` : ''}</h2>
                            <p className="text-xs font-mono font-bold">Job # {workOrder.id}</p>
                        </header>
                        <div className="grid grid-cols-2 gap-6">
                            {chunk.map((url, index) => (
                                <div key={index} className="border p-2 rounded-md flex flex-col items-center justify-center bg-gray-50 shadow-sm" style={{ height: '320px' }}>
                                    <img 
                                        src={proxiedUrl(url)} 
                                        alt={`After photo ${pageIndex * photosPerPage + index + 1}`} 
                                        className="max-w-full max-h-[280px] object-contain" 
                                        crossOrigin="anonymous"
                                    />
                                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mt-2">After Photo {pageIndex * photosPerPage + index + 1}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}

                {notePhotoChunks.map((chunk, pageIndex) => (
                    <div key={`note-photos-${pageIndex}`} className="pdf-page bg-white text-black font-sans p-8 mb-8" style={{ minHeight: '11in' }}>
                        <header className="flex justify-between items-center mb-8 border-b-2 pb-2 border-primary">
                            <h2 className="text-xl font-bold uppercase tracking-tighter text-primary">DAILY DOCUMENTATION {notePhotoChunks.length > 1 ? `(Page ${pageIndex + 1})` : ''}</h2>
                            <p className="text-xs font-mono font-bold">Job # {workOrder.id}</p>
                        </header>
                        <div className="grid grid-cols-2 gap-6">
                            {chunk.map((url, index) => (
                                <div key={index} className="border p-2 rounded-md flex flex-col items-center justify-center bg-gray-50 shadow-sm" style={{ height: '320px' }}>
                                    <img 
                                        src={proxiedUrl(url)} 
                                        alt={`Daily photo ${pageIndex * photosPerPage + index + 1}`} 
                                        className="max-w-full max-h-[280px] object-contain" 
                                        crossOrigin="anonymous"
                                    />
                                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mt-2">Daily Photo {pageIndex * photosPerPage + index + 1}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
