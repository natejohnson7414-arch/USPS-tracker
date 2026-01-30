
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
import Image from 'next/image';

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
        const content = printRef.current;
        if (!content || !workOrder) return;
    
        setIsDownloading(true);
    
        try {
            const pages = content.querySelectorAll('.pdf-page') as NodeListOf<HTMLElement>;
            let pdf: jsPDF | null = null;
    
            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
    
                const canvas = await html2canvas(page, {
                    scale: 2,
                    useCORS: true, 
                    allowTaint: true,
                });
    
                const imgData = canvas.toDataURL('image/png');
                const canvasWidth = canvas.width;
                const canvasHeight = canvas.height;
                const pdfWidth = canvasWidth;
                const pdfHeight = canvasHeight;
    
                if (i === 0) {
                    const orientation = pdfWidth > pdfHeight ? 'l' : 'p';
                    pdf = new jsPDF({
                        orientation,
                        unit: 'px',
                        format: [pdfWidth, pdfHeight]
                    });
                } else {
                    const orientation = pdfWidth > pdfHeight ? 'l' : 'p';
                    pdf!.addPage([pdfWidth, pdfHeight], orientation);
                }
    
                pdf!.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
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
             <div id="download-button" className="fixed bottom-8 right-8 z-50">
                <Button onClick={handleDownload} disabled={isDownloading}>
                    {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    {isDownloading ? 'Downloading...' : 'Download PDF'}
                </Button>
            </div>

        <div className="bg-white text-black font-sans mx-auto printable-area" style={{ width: '8.5in' }} ref={printRef}>
            
            <div className="pdf-page p-8" style={{ minHeight: '11in' }}>
                <header className="flex justify-between items-start mb-8">
                    <div>
                        <h2 className="font-bold text-lg">Facilities Office</h2>
                        <div className="relative h-16 w-48">
                             <Image src="https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/USPS_Eagle_logo.svg/1200px-USPS_Eagle_logo.svg.png" alt="USPS Logo" fill style={{objectFit:"contain"}} unoptimized/>
                        </div>
                        <p className="mt-4">Date: <span className="font-medium underline decoration-dotted">{signatureDate}</span></p>
                        <p className="mt-2">Facilities HUB Project Manager:</p>
                    </div>
                    <div>
                        <div className="relative h-16 w-48">
                           <Image src="https://www.crawford-company.com/hubfs/new-art-o-lite-logo-1.png" alt="Crawford Company Logo" fill style={{objectFit:"contain"}} unoptimized/>
                        </div>
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
                            <div className="w-1/3 flex items-start pt-2 pr-4 text-sm"><p>Work Description:</p></div>
                            <div className="w-2/3 border-2 border-black p-2 text-sm -ml-px -mt-px min-h-[9.5rem] break-words">{summarizedDescription}</div>
                        </div>
                        <div className="flex items-stretch">
                            <div className="w-1/3 flex items-center pr-4 text-sm"><p>Contractor:</p></div>
                            <div className="w-2/3 border-2 border-black p-2 text-sm font-medium -ml-px -mt-px flex items-center min-h-[2rem]">Crawford Co</div>
                        </div>
                        <div className="flex items-stretch">
                            <div className="w-1/3 flex items-center pr-4 text-sm"><p>Call #/Problem #:</p></div>
                            <div className="w-2/3 border-2 border-black p-2 text-sm -ml-px -mt-px min-h-[2rem] flex items-center">{workOrder.customerPO || ''}</div>
                        </div>
                        <div className="flex items-stretch">
                            <div className="w-1/3 flex items-center pr-4 text-sm"><p>Temp upon Arrival:</p></div>
                            <div className="w-2/3 border-2 border-black p-2 text-sm -ml-px -mt-px min-h-[2rem] flex items-center">{workOrder.tempOnArrival || ''}</div>
                        </div>
                        <div className="flex items-stretch">
                            <div className="w-1/3 flex items-center pr-4 text-sm"><p>Temp upon Leaving:</p></div>
                            <div className="w-2/3 border-2 border-black p-2 text-sm -ml-px -mt-px min-h-[2rem] flex items-center">{workOrder.tempOnLeaving || ''}</div>
                        </div>
                        <div className="flex items-stretch">
                            <div className="w-1/3 flex items-center pr-4 text-sm"><p>Before and After Pictures:</p></div>
                            <div className="w-2/3 border-2 border-black p-2 text-sm font-medium -ml-px -mt-px flex items-center min-h-[2rem]">See below</div>
                        </div>
                    </div>

                    <div className="mt-8">
                        <h2 className="font-bold">USPS STAFF MEMBER:</h2>
                        <p className="text-sm">Please review this sheet and verify that the above listed contractor has been on site to address the item(s) described in "Work Description". Please print, sign, and date below on the day that work was completed.</p>
                    </div>
                    
                    <div className="space-y-[-2px] mt-2">
                        <div className="flex items-stretch">
                            <div className="w-1/3 flex items-center pr-4 text-sm"><p>Name:</p></div>
                            <div className="w-2/3 border-2 border-black p-2 text-sm font-medium -ml-px -mt-px min-h-[2rem] flex items-center">{workOrder.contactInfo || ''}</div>
                        </div>
                        <div className="flex items-stretch">
                            <div className="w-1/3 flex items-center pr-4 text-sm"><p>Signature:</p></div>
                            <div className="w-2/3 border-2 border-black p-2 -ml-px -mt-px min-h-[3rem] flex items-center">
                                {!!workOrder.customerSignatureUrl && (
                                    <Image src={workOrder.customerSignatureUrl} alt="Customer Signature" className="object-contain max-h-full" width={150} height={40} unoptimized />
                                )}
                            </div>
                        </div>
                        <div className="flex items-stretch">
                            <div className="w-1/3 flex items-center pr-4 text-sm"><p>Date:</p></div>
                            <div className="w-2/3 border-2 border-black p-2 text-sm font-medium -ml-px -mt-px min-h-[2rem] flex items-center">{signatureDate}</div>
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
                                        {!!url && <Image src={url} alt={`Work photo ${index + 1}`} fill style={{objectFit:"contain"}} unoptimized />}
                                    </div>
                                    <p className="text-center text-sm text-gray-500">Photo {index + 1}</p>
                                </div>
                            ))}
                        </div>
                    </main>
                </div>
            )}
        </div>
        </div>
    );

    

    