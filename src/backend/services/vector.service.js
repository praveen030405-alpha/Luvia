const { GoogleGenerativeAI } = require('@google/generative-ai');

class VectorService {
  constructor() {
    this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy_key');
    // Using text-embedding-004 which is the latest standard, or gemini-embedding-001
    this.embeddingModel = this.gemini.getGenerativeModel({ model: 'text-embedding-004' });
    this.store = [];
  }

  // Calculate Cosine Similarity between two vectors
  _cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async _getEmbedding(text) {
    try {
      const result = await this.embeddingModel.embedContent(text);
      return result.embedding.values;
    } catch (error) {
      // Fallback to older model if text-embedding-004 throws 404
      try {
        const fallbackModel = this.gemini.getGenerativeModel({ model: 'gemini-embedding-001' });
        const result = await fallbackModel.embedContent(text);
        return result.embedding.values;
      } catch (fallbackError) {
        console.error('Embedding Error:', fallbackError);
        return null;
      }
    }
  }

  // Index a document into the in-memory store
  async indexDocument(id, text, metadata = {}) {
    const vector = await this._getEmbedding(text);
    if (vector) {
      this.store.push({ id, text, vector, metadata });
      return true;
    }
    return false;
  }

  // Search the vector store
  async search(queryText, topK = 3) {
    if (this.store.length === 0) return [];
    
    const queryVector = await this._getEmbedding(queryText);
    if (!queryVector) return [];

    const results = this.store.map(doc => {
      const score = this._cosineSimilarity(queryVector, doc.vector);
      return { ...doc, score };
    });

    // Sort by descending score
    results.sort((a, b) => b.score - a.score);

    // Return top K results without the vector arrays to save memory
    return results.slice(0, topK).map(res => ({
      id: res.id,
      text: res.text,
      metadata: res.metadata,
      score: res.score
    }));
  }
}

module.exports = new VectorService();
