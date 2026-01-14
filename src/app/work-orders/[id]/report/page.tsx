
'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, notFound } from 'next/navigation';
import { format } from 'date-fns';
import { useFirestore } from '@/firebase';
import { getWorkOrderById } from '@/lib/data';
import type { WorkOrder } from '@/lib/types';
import { summarizeNotes } from '@/ai/flows/summarize-notes-flow';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function WorkOrderReportPage() {
    const params = useParams();
    const id = params.id as string;
    const db = useFirestore();
    const printRef = useRef<HTMLDivElement>(null);

    const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
    const [summarizedDescription, setSummarizedDescription] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [isDownloading, setIsDownloading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
                
                const notesToSummarize = [wo.description, ...wo.notes.map(n => n.text)].filter(Boolean);

                if (notesToSummarize.length > 0) {
                    const result = await summarizeNotes({ notes: notesToSummarize });
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

    const handleDownload = async () => {
        if (!printRef.current || !workOrder) return;
        
        setIsDownloading(true);

        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'pt',
            format: 'a4'
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();

        const reportPages = printRef.current.querySelectorAll('.pdf-page');

        try {
            for (let i = 0; i < reportPages.length; i++) {
                const page = reportPages[i] as HTMLElement;
                if (i > 0) {
                    pdf.addPage();
                }

                const canvas = await html2canvas(page, {
                    scale: 2, // Higher scale for better quality
                    useCORS: true,
                    allowTaint: true,
                });

                const imgData = canvas.toDataURL('image/png');
                const canvasWidth = canvas.width;
                const canvasHeight = canvas.height;
                const canvasRatio = canvasWidth / canvasHeight;

                // Calculate the dimensions to fit the PDF page while maintaining aspect ratio
                let finalPdfWidth = pdfWidth;
                let finalPdfHeight = pdfWidth / canvasRatio;

                // If the height is still too large, scale down by height instead
                if (finalPdfHeight > pdfHeight) {
                    finalPdfHeight = pdfHeight;
                    finalPdfWidth = pdfHeight * canvasRatio;
                }
                
                const x = (pdfWidth - finalPdfWidth) / 2;
                const y = (pdfHeight - finalPdfHeight) / 2;

                pdf.addImage(imgData, 'PNG', x, y, finalPdfWidth, finalPdfHeight);
            }

            pdf.save(`Work-Order-Report-${workOrder.id}.pdf`);

        } catch (e) {
            console.error("Error generating PDF:", e);
            setError("Failed to generate PDF.");
        } finally {
            setIsDownloading(false);
        }
    };
    
    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-100">
                <div className="p-8 bg-white shadow-lg rounded-lg text-center">
                    <p className="text-lg font-medium">Generating Report...</p>
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
    
    const signatureDate = workOrder.signatureDate ? format(new Date(workOrder.signatureDate), 'MM/dd/yyyy') : ' ';
    const allPhotoUrls = workOrder.notes.flatMap(note => note.photoUrls || []).filter(Boolean);


    return (
        <div className="bg-gray-100 min-h-screen py-8">
        <div className="bg-white text-black font-sans mx-auto printable-area" style={{ width: '8.5in' }} ref={printRef}>
            
            <div className="pdf-page p-8" style={{ minHeight: '11in' }}>
                <header className="flex justify-between items-start mb-8">
                    <div>
                        <h2 className="font-bold text-lg">Facilities Office</h2>
                        <div className="relative h-16 w-48">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="https://storage.googleapis.com/sourcegraph-assets/cody-play/usps-logo.png" alt="USPS Logo" style={{objectFit:"contain", height: '100%', width: '100%'}} crossOrigin="anonymous" />
                        </div>
                        <p className="mt-4">Date: <span className="font-medium underline decoration-dotted">{signatureDate}</span></p>
                        <p className="mt-2">Facilities HUB Project Manager:</p>
                    </div>
                    <div>
                        <div className="relative h-16 w-48">
                           {/* eslint-disable-next-line @next/next/no-img-element */}
                           <img src="https://firebasestudio.app/assets/images/crawford-logo.png" alt="Crawford Company Logo" style={{objectFit:"contain", height: '100%', width: '100%'}} crossOrigin="anonymous" />
                        </div>
                        <p className="mt-4 text-right">Crawford Job #</p>
                        <div className="bg-gray-200 p-2 rounded text-center font-medium">{workOrder.id}</div>
                    </div>
                </header>

                <main>
                    <h1 className="text-center font-bold text-lg tracking-wider mb-4">WORK ACKNOWLEDGEMENT LETTER</h1>
                    
                    <div className="flex items-start gap-4">
                        <div className="w-1/3 space-y-2 text-sm">
                            <p>Facility Name:</p>
                            <p>Work Description:</p>
                            <div className="h-24"></div>
                            <p>Contractor:</p>
                            <p>Call #/Problem #:</p>
                            <p>Temp upon Arrival:</p>
                            <p>Temp upon Leaving:</p>
                            <p>Before and After Pictures:</p>
                        </div>

                        <div className="w-2/3 border-2 border-black text-sm">
                            <div className="p-2 border-b-2 border-black font-medium">{workOrder.workSite?.name || ''}</div>
                            <div className="p-2 border-b-2 border-black min-h-[9.5rem] break-words">{summarizedDescription}</div>
                            <div className="p-2 border-b-2 border-black font-medium">Crawford Co</div>
                            <div className="p-2 border-b-2 border-black min-h-[1.8rem]">{workOrder.customerPO || ''}</div>
                            <div className="p-2 border-b-2 border-black min-h-[1.8rem]">{workOrder.tempOnArrival || ''}</div>
                            <div className="p-2 border-b-2 border-black min-h-[1.8rem]">{workOrder.tempOnLeaving || ''}</div>
                            <div className="p-2 font-medium">See below</div>
                        </div>
                    </div>

                    <div className="mt-8">
                        <h2 className="font-bold">USPS STAFF MEMBER:</h2>
                        <p className="text-sm">Please review this sheet and verify that the above listed contractor has been on site to address the item(s) described in "Work Description". Please print, sign, and date below on the day that work was completed.</p>
                    </div>
                    
                    <div className="flex items-start gap-4 mt-2">
                        <div className="w-1/3 space-y-2 text-sm">
                            <p>Name:</p>
                            <p>Signature:</p>
                            <p>Date:</p>
                            <p>Comments:</p>
                        </div>
                        <div className="w-2/3 border-2 border-black text-sm">
                            <div className="p-2 border-b-2 border-black font-medium min-h-[2rem]">{workOrder.contactInfo || ''}</div>
                            <div className="p-2 border-b-2 border-black min-h-[3rem] h-[3rem] flex items-center">
                                {!!workOrder.customerSignatureUrl && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={workOrder.customerSignatureUrl} alt="Customer Signature" style={{ objectFit: 'contain', height: '40px', width: '150px' }} crossOrigin="anonymous" />
                                )}
                            </div>
                            <div className="p-2 border-b-2 border-black font-medium min-h-[2rem]">{signatureDate}</div>
                            <div className="p-2 min-h-[4rem]"></div>
                        </div>
                    </div>

                    <p className="mt-8 text-sm">
                        Contractor, please have a USPS staff member fill in the bottom half of this sheet after finishing work. Submit this completed form along with your request for payment. Thank you!
                    </p>
                </main>
            </div>

            {allPhotoUrls.length > 0 && (
                <div className="pdf-page p-8" style={{ minHeight: '11in' }}>
                    <header className="flex justify-between items-center mb-8">
                         <h1 className="font-bold text-xl">Photo Appendix</h1>
                         <p className="text-sm text-gray-600">Work Order # {workOrder.id}</p>
                    </header>
                    <main>
                         <div className="grid grid-cols-2 gap-8">
                            {allPhotoUrls.map((url, index) => (
                                <div key={index} className="space-y-2">
                                    <div className="relative aspect-video w-full border rounded-lg overflow-hidden">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        {!!url && <img src={url} alt={`Work photo ${index + 1}`} style={{objectFit:"contain", height: '100%', width: '100%'}} crossOrigin="anonymous" />}
                                    </div>
                                    <p className="text-center text-sm text-gray-500">Photo {index + 1}</p>
                                </div>
                            ))}
                        </div>
                    </main>
                </div>
            )}
        </div>
         <div id="download-button" className="fixed bottom-8 right-8">
            <Button onClick={handleDownload} disabled={isDownloading}>
                {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                {isDownloading ? 'Downloading...' : 'Download PDF'}
            </Button>
        </div>
        </div>
    );

    
}

    