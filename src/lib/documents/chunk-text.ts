export function chunkText(text: string, maxWords = 300): string[] {
  if (!Number.isInteger(maxWords) || maxWords < 1) {
    throw new Error('maxWords must be a positive integer')
  }

  const words = text.trim().split(/\s+/).filter(Boolean)
  const chunks: string[] = []
  for (let index = 0; index < words.length; index += maxWords) {
    chunks.push(words.slice(index, index + maxWords).join(' '))
  }
  return chunks
}
