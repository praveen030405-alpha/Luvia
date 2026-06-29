const { GoogleGenerativeAI } = require('@google/generative-ai');

const MODELS = {
  fast: process.env.GEMINI_FAST_MODEL || 'gemini-3.1-flash-lite',
  fusion: process.env.GEMINI_FUSION_MODEL || 'gemini-3.5-flash',
  reasoning: process.env.GEMINI_REASONING_MODEL || 'gemini-2.5-pro',
  max: process.env.GEMINI_MAX_MODEL || 'gemini-2.5-pro',
  ca: process.env.GEMINI_CA_MODEL || 'gemini-3.5-flash'
};

class AIService {
  constructor() {
    this.apiKey = this.resolveApiKey();
    this.client = this.apiKey ? new GoogleGenerativeAI(this.apiKey) : null;
  }

  resolveApiKey() {
    return String(
      process.env.GEMINI_API_KEY ||
      process.env.Gemini_API_key ||
      process.env.GOOGLE_API_KEY ||
      ''
    ).trim();
  }

  ensureClient() {
    if (!this.apiKey || !this.client) {
      throw new Error('Gemini API key is not configured. Set GEMINI_API_KEY in your environment.');
    }
    return this.client;
  }

  modelForMode(mode) {
    return MODELS[mode] || MODELS.fusion;
  }

  async getModel(mode, systemInstruction = '') {
    return this.ensureClient().getGenerativeModel({
      model: this.modelForMode(mode),
      systemInstruction: this.buildSystemInstruction(mode, systemInstruction)
    });
  }

  buildSystemInstruction(mode, systemInstruction = '') {
    const base = [
      'You are Luvia, a polished AI workspace assistant.',
      'Answer clearly, use markdown when useful, and keep the tone focused and practical.',
      'When solving CA, tax, audit, accounting, finance, math, or code questions, show the reasoning structure without fabricating citations.'
    ];

    if (mode === 'fast') base.push('Prioritize concise answers and quick next steps.');
    if (mode === 'reasoning' || mode === 'max') base.push('Use deeper analysis and check assumptions before final recommendations.');
    if (mode === 'ca') base.push('Act as a careful Chartered Accountant study tutor. Use the supplied reference material when present.');
    if (systemInstruction) base.push('User custom instruction: ' + systemInstruction);

    return base.join('\n');
  }

  async buildPrompt(messages, mode) {
    const safeMessages = Array.isArray(messages) ? messages : [];
    const transcript = safeMessages
      .filter((message) => message && message.content)
      .map((message) => (message.role === 'assistant' ? 'Assistant' : 'User') + ': ' + message.content)
      .join('\n\n');

    if (mode !== 'ca') return transcript;

    const latest = safeMessages.length ? safeMessages[safeMessages.length - 1].content : '';
    const vectorService = require('./vector.service');
    const relevantDocs = await vectorService.search(latest, 3);
    if (!relevantDocs.length) return transcript;

    const referenceBlock = relevantDocs
      .map((doc, index) => {
        const source = (doc.metadata && (doc.metadata.source || doc.metadata.chapter)) || 'Reference ' + (index + 1);
        return '- ' + source + ': ' + doc.text;
      })
      .join('\n');

    return 'Verified reference material:\n' + referenceBlock + '\n\nConversation:\n' + transcript;
  }

  extractText(response) {
    if (!response) return '';
    if (typeof response.text === 'function') return response.text();
    if (response.response && typeof response.response.text === 'function') return response.response.text();
    return String(response.text || response.content || '').trim();
  }

  async generateResponse(messages, mode = 'fusion', systemInstruction = '') {
    try {
      const model = await this.getModel(mode, systemInstruction);
      const prompt = await this.buildPrompt(messages, mode);
      const result = await model.generateContent(prompt);
      return this.extractText(result.response) || 'I could not produce a response for that request.';
    } catch (error) {
      console.error('AI Service Error:', error.message);
      throw error;
    }
  }

  async *generateStream(messages, mode = 'fusion', systemInstruction = '') {
    try {
      const model = await this.getModel(mode, systemInstruction);
      const prompt = await this.buildPrompt(messages, mode);
      const result = await model.generateContentStream(prompt);

      for await (const chunk of result.stream) {
        const text = this.extractText(chunk);
        if (text) yield text;
      }
    } catch (error) {
      console.error('AI Stream Error:', error.message);
      throw error;
    }
  }
}

module.exports = new AIService();
