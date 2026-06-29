const { VectorStoreIndex, Document, Settings, GeminiEmbedding } = require('llamaindex');

class VectorService {
  constructor() {
    let geminiKey = process.env.GEMINI_API_KEY || 'dummy_key';
    
    // Set the global embedding model to Gemini
    Settings.embedModel = new GeminiEmbedding({
      model: 'models/text-embedding-004',
      apiKey: geminiKey
    });

    this.index = null;
    this.documents = [];
  }

  // Index a document into the in-memory store
  async indexDocument(id, text, metadata = {}) {
    const doc = new Document({ text, metadata: { id, ...metadata } });
    this.documents.push(doc);
    
    // Rebuild index (for a small dataset, this is fast enough)
    this.index = await VectorStoreIndex.fromDocuments(this.documents);
    return true;
  }

  // Search the vector store
  async search(queryText, topK = 3) {
    if (!this.index) return [];
    
    const retriever = this.index.asRetriever({ similarityTopK: topK });
    const results = await retriever.retrieve({ query: queryText });

    return results.map(nodeWithScore => ({
      text: nodeWithScore.node.text,
      metadata: nodeWithScore.node.metadata,
      score: nodeWithScore.score
    }));
  }
}

module.exports = new VectorService();
