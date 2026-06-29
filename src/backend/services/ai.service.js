const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');

class AIService {
  constructor() {
    const geminiKey = process.env.GEMINI_API_KEY || process.env.Gemini_API_key || 'dummy_key';
    this.gemini = new GoogleGenerativeAI(geminiKey);
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'dummy_key' });
  }

  /**
   * Generates a response using the appropriate model based on the mode.
   * Modes: fusion (Gemini + GPT), reasoning (GPT-5/4o), fast (Gemini Flash), ca (Specialized Prompt)
   */
  async generateResponse(messages, mode = 'fusion', systemInstruction = '') {
    try {
      if (mode === 'fast') {
        return await this._callGemini(messages, 'gemini-2.5-flash', systemInstruction);
      } else if (mode === 'reasoning') {
        // Fallback to Gemini 2.5 Flash since OpenAI quota is exhausted
        return await this._callGemini(messages, 'gemini-2.5-flash', systemInstruction);
      } else if (mode === 'ca') {
        const vectorService = require('./vector.service');
        const userQuery = messages[messages.length - 1].content;
        const relevantDocs = await vectorService.search(userQuery, 2);
        
        let retrievedContext = '';
        if (relevantDocs.length > 0) {
          retrievedContext = '\n\nVerified Reference Material:\n' + relevantDocs.map(d => `- [${d.metadata.source}]: ${d.text}`).join('\n');
        }

        const caInstruction = "You are an expert in the Chartered Accountant (CA) syllabus. Use the provided Verified Reference Material to answer the user's question accurately. " + systemInstruction + retrievedContext;
        return await this._callGemini(messages, 'gemini-2.5-flash', caInstruction);
      } else {
        // Fusion mode
        return await this._callGemini(messages, 'gemini-2.5-flash', systemInstruction);
      }
    } catch (error) {
      console.error('AI Service Detailed Error:', error.message, error.stack);
      throw error;
    }
  }

  async _callGemini(messages, modelName, systemInstruction) {
    const model = this.gemini.getGenerativeModel({ model: modelName, systemInstruction });
    
    // Convert history format to Gemini format
    const history = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));
    
    // Extract the latest user message
    const latestMessage = history.pop().parts[0].text;
    
    const chat = model.startChat({ history });
    const result = await chat.sendMessage(latestMessage);
    return result.response.text();
  }

  async _callOpenAI(messages, modelName, systemInstruction) {
    const apiMessages = [];
    if (systemInstruction) {
      apiMessages.push({ role: 'system', content: systemInstruction });
    }
    apiMessages.push(...messages.map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    })));

    const response = await this.openai.chat.completions.create({
      model: modelName,
      messages: apiMessages,
    });
    return response.choices[0].message.content;
  }
}

module.exports = new AIService();
