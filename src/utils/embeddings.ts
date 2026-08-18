import { pipeline, env } from '@xenova/transformers'

// Skip local model checks, force downloading from HF Hub if not present
env.allowLocalModels = false
env.useBrowserCache = false

type FeatureExtractionPipeline = (
  text: string,
  options: { pooling: 'mean'; normalize: boolean }
) => Promise<{ data: Iterable<number> }>

class PipelineSingleton {
  static instance: FeatureExtractionPipeline | null = null

  static async getInstance() {
    if (this.instance === null) {
      this.instance = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2') as FeatureExtractionPipeline
    }
    return this.instance
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const extractor = await PipelineSingleton.getInstance()
  const output = await extractor(text, { pooling: 'mean', normalize: true })
  return Array.from(output.data)
}
