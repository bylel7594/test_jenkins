import { PDFDocument } from 'pdf-lib'
import sharp from 'sharp'

export interface PageImage {
  pageNumber: number
  base64: string
  mediaType: 'image/jpeg'
}

// Convertit un PDF multipage en tableau d'images JPEG base64
export async function splitPdfToImages(
  pdfBuffer: Buffer
): Promise<PageImage[]> {
  const pdfDoc = await PDFDocument.load(pdfBuffer)
  const pageCount = pdfDoc.getPageCount()
  const results: PageImage[] = []

  for (let i = 0; i < pageCount; i++) {
    // Extrait la page comme PDF autonome
    const singlePage = await PDFDocument.create()
    const [copiedPage] = await singlePage.copyPages(pdfDoc, [i])
    singlePage.addPage(copiedPage)
    const singlePdfBytes = await singlePage.save()

    // Convertit en PNG via sharp puis en JPEG optimisé pour Claude
    const jpegBuffer = await sharp(Buffer.from(singlePdfBytes), {
      density: 200,
    })
      .jpeg({ quality: 90 })
      .toBuffer()

    results.push({
      pageNumber: i + 1,
      base64: jpegBuffer.toString('base64'),
      mediaType: 'image/jpeg',
    })
  }

  return results
}

// Convertit une image (JPEG, PNG, WEBP) en base64 pour Claude
export async function imageToBase64(
  buffer: Buffer,
  mimeType: string
): Promise<{ base64: string; mediaType: 'image/jpeg' | 'image/png' | 'image/webp' }> {
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
    return { base64: buffer.toString('base64'), mediaType: 'image/jpeg' }
  }
  if (mimeType === 'image/png') {
    return { base64: buffer.toString('base64'), mediaType: 'image/png' }
  }
  if (mimeType === 'image/webp') {
    return { base64: buffer.toString('base64'), mediaType: 'image/webp' }
  }
  // Convertit les autres formats en JPEG
  const jpegBuffer = await sharp(buffer).jpeg({ quality: 90 }).toBuffer()
  return { base64: jpegBuffer.toString('base64'), mediaType: 'image/jpeg' }
}

export function getPageCount(pdfBuffer: Buffer): Promise<number> {
  return PDFDocument.load(pdfBuffer).then((doc) => doc.getPageCount())
}
