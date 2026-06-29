class VectorService {
  constructor() {
    this.documents = [];
    this.seedDocuments();
  }

  seedDocuments() {
    try {
      const syllabus = require('../data/ca_syllabus_mock');
      syllabus.forEach((doc) => {
        this.documents.push({
          id: doc.id,
          text: doc.text,
          metadata: doc.metadata || {}
        });
      });
    } catch (error) {
      this.documents = [];
    }
  }

  tokenize(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 2);
  }

  async indexDocument(id, text, metadata = {}) {
    this.documents.push({ id: id, text: text, metadata: Object.assign({ id: id }, metadata) });
    return true;
  }

  async search(queryText, topK = 3) {
    const queryTokens = new Set(this.tokenize(queryText));
    if (!queryTokens.size) return this.documents.slice(0, topK);

    return this.documents
      .map((doc) => {
        const textTokens = this.tokenize(doc.text + ' ' + JSON.stringify(doc.metadata || {}));
        const score = textTokens.reduce((total, token) => total + (queryTokens.has(token) ? 1 : 0), 0);
        return {
          text: doc.text,
          metadata: doc.metadata,
          score: score
        };
      })
      .filter((doc) => doc.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}

module.exports = new VectorService();
