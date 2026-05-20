import { PDFDocument, PDFPage } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href;

export interface MergedPage {
  id: string;
  pageIndex: number;
  rotation: number; // 0, 90, 180, 270
  thumbnail: string;
}

/**
 * Apply rotation to a PDF page using transformations
 * This handles cases where setRotation might fail
 */
function applyRotationToPage(page: PDFPage, rotation: number): void {
  if (rotation === 0) return;

  // Normalize rotation to 0, 90, 180, 270
  let normalizedRotation = rotation % 360;
  if (normalizedRotation < 0) normalizedRotation += 360;

  // For 180 degrees, we need to handle it specially
  // because some PDF readers have issues with it
  if (normalizedRotation === 180) {
    // Apply 180 rotation as two 90-degree rotations
    try {
      page.setRotation(180 as any);
    } catch {
      // If all else fails, skip rotation for this page
      console.warn('Could not apply 180 degree rotation');
    }
  } else if (normalizedRotation === 360) {
    // 360 is same as 0, do nothing
    return;
  } else {
    // For 90 and 270, use setRotation directly
    try {
      page.setRotation(normalizedRotation as any);
    } catch {
      console.warn(`Could not apply ${normalizedRotation} degree rotation`);
    }
  }
}

/**
 * Create merged PDF with page reordering and rotation
 */
export async function createMergedPDFWithEdits(
  mergedPdfBytes: Uint8Array,
  pages: MergedPage[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(mergedPdfBytes);
  const allPages = pdfDoc.getPages();

  // Create a new document with reordered and rotated pages
  const newPdfDoc = await PDFDocument.create();

  for (const page of pages) {
    if (page.pageIndex < allPages.length) {
      // Copy the page from the original document
      const copiedPages = await newPdfDoc.copyPages(pdfDoc, [page.pageIndex]);
      const copiedPage = copiedPages[0];

      // Apply rotation if needed
      if (page.rotation !== 0) {
        try {
          applyRotationToPage(copiedPage, page.rotation);
        } catch (error) {
          console.error(`Error applying rotation to page ${page.id}:`, error);
        }
      }

      newPdfDoc.addPage(copiedPage);
    }
  }

  return await newPdfDoc.save();
}

/**
 * Generate thumbnail for a specific page
 */
export async function generatePageThumbnail(
  pdfBytes: Uint8Array,
  pageIndex: number
): Promise<string> {
  try {
    // Create a copy of the buffer to avoid ArrayBuffer detached errors
    const pdfBytesCopy = new Uint8Array(pdfBytes);
    const pdf = await pdfjsLib.getDocument({ data: pdfBytesCopy }).promise;

    if (pageIndex >= pdf.numPages) {
      throw new Error('Page index out of range');
    }

    const page = await pdf.getPage(pageIndex + 1);
    const scale = 1.2;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Failed to get canvas context');
    }

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
      canvasContext: context,
      viewport: viewport,
      canvas: canvas,
    } as any).promise;

    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Error generating page thumbnail:', error);
    throw error;
  }
}

/**
 * Get total number of pages in merged PDF
 */
export async function getPageCount(pdfBytes: Uint8Array): Promise<number> {
  try {
    const pdfDoc = await PDFDocument.load(pdfBytes);
    return pdfDoc.getPageCount();
  } catch (error) {
    console.error('Error getting page count:', error);
    throw error;
  }
}
