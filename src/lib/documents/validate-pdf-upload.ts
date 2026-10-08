import 'server-only'

import { extractPdfText } from '@/lib/documents/extract-pdf'
import { MAX_PDF_UPLOAD_SIZE_BYTES } from '@/utils/constants'

export async function validatePdfUpload(
  file: unknown,
): Promise<{ file: File; buffer: Buffer; text: string }> {
  if (!(file instanceof File)) {
    throw new Error('A PDF file is required')
  }
  if (file.type !== 'application/pdf') {
    throw new Error('Only PDF documents are supported')
  }
  if (file.size === 0) {
    throw new Error('The PDF file cannot be empty')
  }
  if (file.size > MAX_PDF_UPLOAD_SIZE_BYTES) {
    throw new Error('PDF files must be 25 MB or smaller')
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  if (buffer.length === 0) {
    throw new Error('The PDF file cannot be empty')
  }
  if (buffer.length > MAX_PDF_UPLOAD_SIZE_BYTES) {
    throw new Error('PDF files must be 25 MB or smaller')
  }
  if (buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new Error('The uploaded file does not have a valid PDF signature')
  }

  let text: string
  try {
    text = await extractPdfText(buffer)
  } catch (error) {
    throw new Error('The uploaded file is not a readable PDF', { cause: error })
  }

  return { file, buffer, text }
}
