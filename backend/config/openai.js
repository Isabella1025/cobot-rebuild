const OpenAI = require('openai');
require('dotenv').config();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Validate API key on startup
const validateApiKey = async () => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.warn('⚠ Warning: OPENAI_API_KEY not set in environment variables');
      return false;
    }
    
    // Test API connection with a minimal request
    await openai.models.list();
    console.log('✓ OpenAI API connected successfully');
    return true;
  } catch (error) {
    console.error('✗ OpenAI API connection failed:', error.message);
    return false;
  }
};

// Helper function to create chat completion
const createChatCompletion = async (messages, options = {}) => {
  try {
    const response = await openai.chat.completions.create({
      model: options.model || process.env.OPENAI_MODEL || 'gpt-4',
      messages: messages,
      max_tokens: options.max_tokens || parseInt(process.env.OPENAI_MAX_TOKENS) || 1000,
      temperature: options.temperature || 0.7,
      stream: options.stream || false,
      ...options
    });
    
    return response;
  } catch (error) {
    console.error('OpenAI completion error:', error.message);
    throw error;
  }
};

// Helper function to create embeddings
const createEmbedding = async (text, model = 'text-embedding-ada-002') => {
  try {
    const response = await openai.embeddings.create({
      model: model,
      input: text
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error('OpenAI embedding error:', error.message);
    throw error;
  }
};

// Helper function to create embeddings for multiple texts
const createEmbeddings = async (texts, model = 'text-embedding-ada-002') => {
  try {
    const response = await openai.embeddings.create({
      model: model,
      input: texts
    });
    
    return response.data.map(item => item.embedding);
  } catch (error) {
    console.error('OpenAI embeddings error:', error.message);
    throw error;
  }
};

// Helper function for streaming responses
const createStreamingCompletion = async (messages, onChunk, options = {}) => {
  try {
    const stream = await openai.chat.completions.create({
      model: options.model || process.env.OPENAI_MODEL || 'gpt-4',
      messages: messages,
      max_tokens: options.max_tokens || parseInt(process.env.OPENAI_MAX_TOKENS) || 1000,
      temperature: options.temperature || 0.7,
      stream: true,
      ...options
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        onChunk(content);
      }
    }
  } catch (error) {
    console.error('OpenAI streaming error:', error.message);
    throw error;
  }
};

module.exports = {
  openai,
  validateApiKey,
  createChatCompletion,
  createEmbedding,
  createEmbeddings,
  createStreamingCompletion
};