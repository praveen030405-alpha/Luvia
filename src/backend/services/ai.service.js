const { Gemini, ChatMemoryBuffer, SimpleChatEngine, Settings, ChatMessage } = require('llamaindex');

class AIService {
  constructor() {
    let geminiKey = process.env.GEMINI_API_KEY || process.env.Gemini_API_key;
    if (!geminiKey) {
      try {
        const keys = require('../luvia-keys.json');
        geminiKey = keys.GEMINI_API_KEY;
      } catch(e) {}
    }
    geminiKey = (geminiKey || 'dummy_key').trim();
    
    // Set global LLM in LlamaIndex to use Gemini
    Settings.llm = new Gemini({
      apiKey: geminiKey,
      model: 'models/gemini-2.5-flash',
    });
    this.apiKey = geminiKey;
  }

  /**
   * Generates a response using the appropriate model based on the mode.
   * Modes: fusion, reasoning, fast, ca (Specialized Prompt)
   */
  async generateResponse(messages, mode = 'fusion', systemInstruction = '') {
    try {
      // Map basic messages to LlamaIndex format
      const chatHistory = messages.map(msg => ({
        content: msg.content,
        role: msg.role === 'assistant' ? 'assistant' : 'user'
      }));

      // Pop the latest query
      const userQuery = chatHistory.pop().content;

      // Keep token count tightly constrained for memory stability
      const memory = new ChatMemoryBuffer({
        tokenLimit: 4000,
        chatHistory: chatHistory
      });

      if (mode === 'ca') {
        const vectorService = require('./vector.service');
        const relevantDocs = await vectorService.search(userQuery, 2);
        
        let retrievedContext = '';
        if (relevantDocs.length > 0) {
          retrievedContext = '\n\nVerified Reference Material:\n' + relevantDocs.map(d => `- [${d.metadata.source || 'Doc'}]: ${d.text}`).join('\n');
        }

        const caInstruction = "You are an expert in the Chartered Accountant (CA) syllabus. Use the provided Verified Reference Material to answer the user's question accurately. " + systemInstruction + retrievedContext;
        
        // Pass instruction dynamically
        const caEngine = new SimpleChatEngine({
          memory,
          llm: new Gemini({ apiKey: this.apiKey, model: 'models/gemini-2.5-flash' })
        });
        
        // Provide the instruction as context
        const response = await caEngine.chat({ message: caInstruction + "\n\nUser Question: " + userQuery });
        return response.message.content;
      } else {
        // Standard chat engine using LlamaIndex
        const chatEngine = new SimpleChatEngine({ memory });
        const response = await chatEngine.chat({ message: userQuery });
        return response.message.content;
      }
    } catch (error) {
      console.error('AI Service Detailed Error:', error.message, error.stack);
      throw error;
    }
  }

  async generateStream(messages, mode = 'fusion', systemInstruction = '') {
    try {
      const chatHistory = messages.map(msg => ({
        content: msg.content,
        role: msg.role === 'assistant' ? 'assistant' : 'user'
      }));
      const userQuery = chatHistory.pop().content;
      const memory = new ChatMemoryBuffer({ tokenLimit: 4000, chatHistory });

      if (mode === 'ca') {
        const vectorService = require('./vector.service');
        const relevantDocs = await vectorService.search(userQuery, 2);
        let retrievedContext = '';
        if (relevantDocs.length > 0) {
          retrievedContext = '\n\nVerified Reference Material:\n' + relevantDocs.map(d => `- [${d.metadata.source || 'Doc'}]: ${d.text}`).join('\n');
        }
        const caInstruction = "You are an expert in the Chartered Accountant (CA) syllabus. Use the provided Verified Reference Material to answer the user's question accurately. " + systemInstruction + retrievedContext;
        
        const caEngine = new SimpleChatEngine({
          memory,
          llm: new Gemini({ apiKey: this.apiKey, model: 'models/gemini-2.5-flash' })
        });
        
        return await caEngine.chat({ message: caInstruction + "\n\nUser Question: " + userQuery, stream: true });
      } else {
        const chatEngine = new SimpleChatEngine({ memory });
        let finalQuery = userQuery;
        if (systemInstruction) {
           finalQuery = "System Instruction for this conversation: " + systemInstruction + "\n\nUser Question: " + userQuery;
        }
        return await chatEngine.chat({ message: finalQuery, stream: true });
      }
    } catch (error) {
      console.error('AI Stream Error:', error);
      throw error;
    }
  }
}

module.exports = new AIService();
