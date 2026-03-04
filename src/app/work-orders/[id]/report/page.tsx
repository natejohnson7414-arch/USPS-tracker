
'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, notFound, useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { useFirestore } from '@/firebase';
import { getWorkOrderById } from '@/lib/data';
import type { WorkOrder } from '@/lib/types';
import { summarizeNotes } from '@/ai/flows/summarize-notes-flow';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Download, Loader2, Printer } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function WorkOrderReportPage() {
    const params = useParams();
    const id = params.id as string;
    const db = useFirestore();
    const printRef = useRef<HTMLDivElement>(null);
    const searchParams = useSearchParams();

    const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
    const [summarizedDescription, setSummarizedDescription] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [isDownloading, setIsDownloading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isInIframe, setIsInIframe] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setIsInIframe(window.self !== window.top);
        }
    }, []);

    useEffect(() => {
        if (!id || !db) return;

        const fetchAndSummarize = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const wo = await getWorkOrderById(db, id);
                if (!wo) {
                    notFound();
                    return;
                }
                setWorkOrder(wo);
                
                // 1. Check for manual override from the office
                if (wo.customWorkPerformedSummary) {
                    setSummarizedDescription(wo.customWorkPerformedSummary);
                    setIsLoading(false);
                    return;
                }

                // 2. Aggregate filtered info for the AI (excluding items marked by admin)
                const contentParts = [
                    `Job Specification: ${wo.description}`,
                    ...wo.notes.filter(n => !n.excludeFromReport).map(n => `Technician Note: ${n.text}`),
                    ...wo.activities.filter(a => !a.excludeFromReport).map(a => `Activity Performed: ${a.description}`)
                ].filter(Boolean);

                if (contentParts.length > 0) {
                    const result = await summarizeNotes({ notes: contentParts });
                    setSummarizedDescription(result.summary);
                } else {
                    setSummarizedDescription('No description provided.');
                }

            } catch (err) {
                console.error("Error generating report:", err);
                setError("Failed to generate report data.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchAndSummarize();
    }, [id, db]);

    const handleDownload = useCallback(async () => {
        const content = printRef.current;
        if (!content || !workOrder) return;
    
        setIsDownloading(true);
    
        try {
            const pages = content.querySelectorAll('.pdf-page') as NodeListOf<HTMLElement>;
            let pdf: jsPDF | null = null;
    
            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
    
                const canvas = await html2canvas(page, {
                    scale: 1.5,
                    useCORS: true, 
                    allowTaint: true,
                });
    
                const imgData = canvas.toDataURL('image/jpeg', 0.8);
                const canvasWidth = canvas.width;
                const canvasHeight = canvas.height;
                const pdfWidth = canvasWidth;
                const pdfHeight = canvasHeight;
    
                if (i === 0) {
                    const orientation = pdfWidth > pdfHeight ? 'l' : 'p';
                    pdf = new jsPDF({
                        orientation,
                        unit: 'px',
                        format: [pdfWidth, pdfHeight],
                        hotfixes: ['px_scaling'],
                    });
                } else {
                    const orientation = pdfWidth > pdfHeight ? 'l' : 'p';
                    pdf!.addPage([pdfWidth, pdfHeight], orientation);
                }
    
                pdf!.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
            }
    
            if (pdf) {
                pdf.save(`Work-Order-Report-${workOrder.id}.pdf`);
            }
    
        } catch (e) {
            console.error("Error generating PDF:", e);
            setError("Failed to generate PDF.");
        } finally {
            setIsDownloading(false);
        }
    }, [workOrder]);
    
    const handlePrint = () => {
        window.print();
    }
    
    useEffect(() => {
        const action = searchParams.get('action');
        if (!isLoading && action && !isInIframe) {
            if (action === 'download') {
                handleDownload();
            } else if (action === 'print') {
                setTimeout(() => window.print(), 500);
            }
        }
    }, [isLoading, searchParams, isInIframe, handleDownload]);
    
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data === 'download-pdf') {
                handleDownload();
            }
        };

        window.addEventListener('message', handleMessage);

        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, [handleDownload]);


    const action = searchParams.get('action');

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-100">
                <div className="p-8 bg-white shadow-lg rounded-lg text-center">
                    <p className="text-lg font-medium">Generating Technical Summary...</p>
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

    const proxiedUrl = (url: string) => `/api/image-proxy?url=${encodeURIComponent(url)}`;
    
    const latestAck = workOrder.acknowledgements && workOrder.acknowledgements.length > 0 
        ? workOrder.acknowledgements[workOrder.acknowledgements.length - 1] 
        : null;

    const displaySignatureUrl = workOrder.customerSignatureUrl || latestAck?.signatureUrl;
    const displayName = workOrder.customerSignatureUrl ? (workOrder.contactInfo || '') : (latestAck?.name || '');
    const rawDate = workOrder.customerSignatureUrl ? workOrder.signatureDate : latestAck?.date;
    const displayDateStr = rawDate ? format(new Date(rawDate), 'MM/dd/yyyy') : ' ';
    
    const beforePhotos = workOrder.beforePhotoUrls || [];
    const afterPhotos = workOrder.afterPhotoUrls || [];
    const activityPhotos = workOrder.notes.flatMap(note => note.photoUrls || []).filter(Boolean);

    const photosPerPage = 6;

    const beforePhotoChunks = Array.from({ length: Math.ceil(beforePhotos.length / photosPerPage) }, (_, i) =>
        beforePhotos.slice(i * photosPerPage, i * photosPerPage + photosPerPage)
    );
    const afterPhotoChunks = Array.from({ length: Math.ceil(afterPhotos.length / photosPerPage) }, (_, i) =>
        afterPhotos.slice(i * photosPerPage, i * photosPerPage + photosPerPage)
    );
    const activityPhotoChunks = Array.from({ length: Math.ceil(activityPhotos.length / photosPerPage) }, (_, i) =>
        activityPhotos.slice(i * photosPerPage, i * photosPerPage + photosPerPage)
    );

    return (
        <div className="bg-gray-100 min-h-screen py-8">
            {!action && !isInIframe && (
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
            )}

        <div className="bg-white text-black font-sans mx-auto printable-area" style={{ width: '8.5in' }} ref={printRef}>
            
            <div className="pdf-page p-8" style={{ minHeight: '11in' }}>
                <header className="flex justify-between items-start mb-8">
                    <div>
                        <h2 className="font-bold text-lg">Facilities Office</h2>
                        <p className="mt-4">Date: <span className="font-medium underline decoration-dotted">{displayDateStr}</span></p>
                        <p className="mt-2">Facilities HUB Project Manager:</p>
                    </div>
                    <div>
                        <p className="mt-4 text-right">Crawford Job #</p>
                        <div className="bg-gray-200 p-2 rounded text-center font-medium">{workOrder.id}</div>
                    </div>
                </header>

                <main>
                    <h1 className="text-center font-bold text-lg tracking-wider mb-4">WORK ACKNOWLEDGEMENT LETTER</h1>
                    
                    <div className="space-y-[-2px]">
                        <div className="flex items-stretch">
                            <div className="w-1/3 flex items-center pr-4 text-sm"><p>Facility Name:</p></div>
                            <div className="w-2/3 border-2 border-black p-2 text-sm font-medium -ml-px -mt-px flex items-center min-h-[2rem]">{workOrder.workSite?.name || ''}</div>
                        </div>
                        <div className="flex items-stretch">
                            <div className="w-1/3 flex items-start pt-2 pr-4 text-sm"><p>Work Performed Summary:</p></div>
                            <div className="w-2/3 border-2 border-black p-2 text-sm -ml-px -mt-px min-h-[14rem] break-words leading-relaxed">{summarizedDescription}</div>
                        </div>
                        <div className="flex items-stretch">
                            <div className="w-1/3 flex items-center pr-4 text-sm"><p>Contractor:</p></div>
                            <div className="w-2/3 border-2 border-black p-2 text-sm font-medium -ml-px -mt-px flex items-center min-h-[2rem]">Crawford Co</div>
                        </div>
                        <div className="flex items-stretch">
                            <div className="w-1/3 flex items-center pr-4 text-sm"><p>Call #/Problem #:</p></div>
                            <div className="w-2/3 border-2 border-black p-2 text-sm -ml-px -mt-px flex items-center min-h-[2rem]">{workOrder.customerPO || ''}</div>
                        </div>
                        <div className="flex items-stretch">
                            <div className="w-1/3 flex items-center pr-4 text-sm"><p>Temp upon Arrival:</p></div>
                            <div className="w-2/3 border-2 border-black p-2 text-sm -ml-px -mt-px flex items-center min-h-[2rem]">{workOrder.tempOnArrival || ''}</div>
                        </div>
                        <div className="flex items-stretch">
                            <div className="w-1/3 flex items-center pr-4 text-sm"><p>Temp upon Leaving:</p></div>
                            <div className="w-2/3 border-2 border-black p-2 text-sm -ml-px -mt-px flex items-center min-h-[2rem]">{workOrder.tempOnLeaving || ''}</div>
                        </div>
                        <div className="flex items-stretch">
                            <div className="w-1/3 flex items-center pr-4 text-sm"><p>Before and After Pictures:</p></div>
                            <div className="w-2/3 border-2 border-black p-2 text-sm font-medium -ml-px -mt-px flex items-center min-h-[2rem]">See below</div>
                        </div>
                    </div>

                    <div className="mt-8">
                        <h2 className="font-bold">USPS STAFF MEMBER:</h2>
                        <p className="text-sm">Please review this sheet and verify that the above listed contractor has been on site to address the item(s) described in "Work Performed Summary". Please print, sign, and date below on the day that work was completed.</p>
                    </div>
                    
                    <div className="space-y-[-2px] mt-2">
                        <div className="flex items-stretch">
                            <div className="w-1/3 flex items-center pr-4 text-sm"><p>Name:</p></div>
                            <div className="w-2/3 border-2 border-black p-2 text-sm font-medium -ml-px -mt-px min-h-[2rem] flex items-center">{displayName}</div>
                        </div>
                        <div className="flex items-stretch">
                            <div className="w-1/3 flex items-center pr-4 text-sm"><p>Signature:</p></div>
                            <div className="w-2/3 border-2 border-black p-2 -ml-px -mt-px min-h-[3rem] flex items-center">
                                {!!displaySignatureUrl && (
                                    <img src={proxiedUrl(displaySignatureUrl)} alt="Customer Signature" style={{ objectFit: 'contain', maxHeight: '100%', maxWidth: '150px' }} />
                                )}
                            </div>
                        </div>
                        <div className="flex items-stretch">
                            <div className="w-1/3 flex items-center pr-4 text-sm"><p>Date:</p></div>
                            <div className="w-2/3 border-2 border-black p-2 text-sm font-medium -ml-px -mt-px min-h-[2rem] flex items-center">{displayDateStr}</div>
                        </div>
                        <div className="flex items-stretch">
                            <div className="w-1/3 flex items-start pt-2 pr-4 text-sm"><p>Comments:</p></div>
                            <div className="w-2/3 border-2 border-black p-2 -ml-px -mt-px min-h-[4rem]"></div>
                        </div>
                    </div>

                    <p className="mt-8 text-sm">
                        Contractor, please have a USPS staff member fill in the bottom half of this sheet after finishing work. Submit this completed form along with your request for payment. Thank you!
                    </p>
                </main>
            </div>

            {beforePhotoChunks.map((chunk, pageIndex) => (
                <div key={`before-page-${pageIndex}`} className="pdf-page p-8" style={{ minHeight: '11in' }}>
                    <header className="flex justify-between items-center mb-8">
                         <h1 className="font-bold text-xl">Before Photos {beforePhotoChunks.length > 1 ? `(Page ${pageIndex + 1})` : ''}</h1>
                         <p className="text-sm text-gray-600">Work Order # {workOrder.id}</p>
                    </header>
                    <main>
                         <div className="grid grid-cols-2 gap-8">
                            {chunk.map((url, index) => (
                                <div key={index} className="space-y-2">
                                    <div className="w-full border rounded-lg overflow-hidden flex items-center justify-center bg-gray-50" style={{ height: '280px' }}>
                                        {!!url && <img src={proxiedUrl(url)} alt={`Before photo ${pageIndex * photosPerPage + index + 1}`} className="max-w-full max-h-full object-contain" />}
                                    </div>
                                    <p className="text-center text-sm text-gray-500">Before Photo {pageIndex * photosPerPage + index + 1}</p>
                                </div>
                            ))}
                        </div>
                    </main>
                </div>
            ))}
            
            {afterPhotoChunks.map((chunk, pageIndex) => (
                <div key={`after-page-${pageIndex}`} className="pdf-page p-8" style={{ minHeight: '11in' }}>
                    <header className="flex justify-between items-center mb-8">
                         <h1 className="font-bold text-xl">After Photos {afterPhotoChunks.length > 1 ? `(Page ${pageIndex + 1})` : ''}</h1>
                         <p className="text-sm text-gray-600">Work Order # {workOrder.id}</p>
                    </header>
                    <main>
                         <div className="grid grid-cols-2 gap-8">
                            {chunk.map((url, index) => (
                                <div key={index} className="space-y-2">
                                    <div className="w-full border rounded-lg overflow-hidden flex items-center justify-center bg-gray-50" style={{ height: '280px' }}>
                                        {!!url && <img src={proxiedUrl(url)} alt={`After photo ${pageIndex * photosPerPage + index + 1}`} className="max-w-full max-h-full object-contain" />}
                                    </div>
                                    <p className="text-center text-sm text-gray-500">After Photo {pageIndex * photosPerPage + index + 1}</p>
                                </div>
                            ))}
                        </div>
                    </main>
                </div>
            ))}

            {activityPhotoChunks.map((chunk, pageIndex) => (
                <div key={`activity-page-${pageIndex}`} className="pdf-page p-8" style={{ minHeight: '11in' }}>
                    <header className="flex justify-between items-center mb-8">
                         <h1 className="font-bold text-xl">Activity Photos {activityPhotoChunks.length > 1 ? `(Page ${pageIndex + 1})` : ''}</h1>
                         <p className="text-sm text-gray-600">Work Order # {workOrder.id}</p>
                    </header>
                    <main>
                         <div className="grid grid-cols-2 gap-8">
                            {chunk.map((url, index) => (
                                <div key={index} className="space-y-2">
                                    <div className="w-full border rounded-lg overflow-hidden flex items-center justify-center bg-gray-50" style={{ height: '280px' }}>
                                        {!!url && <img src={proxiedUrl(url)} alt={`Activity photo ${pageIndex * photosPerPage + index + 1}`} className="max-w-full max-h-full object-contain" />}
                                    </div>
                                    <p className="text-center text-sm text-gray-500">Activity Photo {pageIndex * photosPerPage + index + 1}</p>
                                </div>
                            ))}
                        </div>
                    </main>
                </div>
            ))}
        </div>
        </div>
    );
}
