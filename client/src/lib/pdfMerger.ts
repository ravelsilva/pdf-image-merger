import { PDFDocument } from 'pdf-lib';

/**
 * Merge multiple PDF files and images into a single PDF
 * All processing happens on the client side
 * Preserves PDF properties and form fields (including signature fields) when possible
 */
export async function mergePDFsAndImages(files: File[]): Promise<Uint8Array> {
  // Start with the first PDF if available to preserve its properties
  let pdfDoc: PDFDocument | null = null;
  let firstPdfIndex = -1;

  // Find the first PDF file
  for (let i = 0; i < files.length; i++) {
    if (files[i].type === 'application/pdf') {
      firstPdfIndex = i;
      const arrayBuffer = await files[i].arrayBuffer();
      pdfDoc = await PDFDocument.load(arrayBuffer, {
        updateMetadata: false,
      });
      break;
    }
  }

  // If no PDF found, create a new one
  if (!pdfDoc) {
    pdfDoc = await PDFDocument.create();
  }

  // Process all files
  for (let i = 0; i < files.length; i++) {
    // Skip the first PDF if we already loaded it
    if (i === firstPdfIndex) {
      continue;
    }

    const file = files[i];
    if (file.type === 'application/pdf') {
      await addPDFToDocument(pdfDoc, file);
    } else if (file.type.startsWith('image/')) {
      await addImageToDocument(pdfDoc, file);
    }
  }

  return await pdfDoc.save();
}

async function addPDFToDocument(
  pdfDoc: PDFDocument,
  file: File
): Promise<void> {
  const arrayBuffer = await file.arrayBuffer();
  const sourcePdf = await PDFDocument.load(arrayBuffer, {
    updateMetadata: false,
  });

  try {
    // Copy pages while preserving annotations and form fields
    const copiedPages = await pdfDoc.copyPages(
      sourcePdf,
      sourcePdf.getPageIndices()
    );

    copiedPages.forEach((page) => {
      pdfDoc.addPage(page);
    });
  } catch (error) {
    console.error('Error adding PDF to document:', error);
    throw error;
  }
}

async function addImageToDocument(
  pdfDoc: PDFDocument,
  file: File
): Promise<void> {
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  // Convert image to appropriate format for pdf-lib
  if (file.type === 'image/jpeg') {
    const image = await pdfDoc.embedJpg(uint8Array);
    addImagePage(pdfDoc, image);
  } else if (file.type === 'image/png') {
    const image = await pdfDoc.embedPng(uint8Array);
    addImagePage(pdfDoc, image);
  } else if (file.type === 'image/webp') {
    // Convert WebP to PNG for pdf-lib compatibility
    const pngData = await convertWebPToPNG(arrayBuffer);
    const image = await pdfDoc.embedPng(pngData);
    addImagePage(pdfDoc, image);
  }
}

function addImagePage(
  pdfDoc: PDFDocument,
  image: any
): void {
  // Get image dimensions
  const { width: imgWidth, height: imgHeight } = image;

  // Standard A4 dimensions in points (72 DPI)
  const A4_WIDTH = 595.28;
  const A4_HEIGHT = 841.89;

  // Calculate scaling to fit image on A4 page while maintaining aspect ratio
  const aspectRatio = imgWidth / imgHeight;
  let finalWidth = A4_WIDTH - 40; // 20pt margin on each side
  let finalHeight = finalWidth / aspectRatio;

  if (finalHeight > A4_HEIGHT - 40) {
    finalHeight = A4_HEIGHT - 40;
    finalWidth = finalHeight * aspectRatio;
  }

  // Center the image on the page
  const x = (A4_WIDTH - finalWidth) / 2;
  const y = (A4_HEIGHT - finalHeight) / 2;

  const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
  page.drawImage(image, {
    x,
    y,
    width: finalWidth,
    height: finalHeight,
  });
}

/**
 * Convert WebP image to PNG using Canvas API
 * This is a fallback for WebP support in pdf-lib
 */
async function convertWebPToPNG(arrayBuffer: ArrayBuffer): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([arrayBuffer], { type: 'image/webp' });
    const url = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        (pngBlob) => {
          if (!pngBlob) {
            reject(new Error('Failed to convert WebP to PNG'));
            return;
          }

          const reader = new FileReader();
          reader.onload = () => {
            resolve(new Uint8Array(reader.result as ArrayBuffer));
          };
          reader.onerror = () => {
            reject(new Error('Failed to read PNG blob'));
          };
          reader.readAsArrayBuffer(pngBlob);
        },
        'image/png'
      );

      URL.revokeObjectURL(url);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load WebP image'));
    };

    img.src = url;
  });
}
