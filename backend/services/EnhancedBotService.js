const { createChatCompletion } = require('../config/openai');
const { query, queryOne } = require('../config/database');
const DocumentService = require('./DocumentService');

/**
 * Enhanced Bot Service with Advanced Features:
 * - Appointment suggestions
 * - Quick action buttons
 * - Document sharing
 * - Conversation memory
 */
class EnhancedBotService {
  /**
   * Analyze message and determine if bot should suggest an appointment
   */
  static analyzeForAppointmentSuggestion(message) {
    const appointmentKeywords = [
      'book', 'schedule', 'appointment', 'meet', 'speak with',
      'talk to', 'need help', 'assistance', 'advising', 'counseling',
      'career', 'visa', 'job', 'internship', 'study abroad',
      'need to see', 'want to discuss'
    ];

    const lowerMessage = message.toLowerCase();
    return appointmentKeywords.some(keyword => lowerMessage.includes(keyword));
  }

  /**
   * Generate quick action buttons based on message context
   */
  static generateQuickActions(message, serviceId, botContext) {
    const actions = [];
    const lowerMessage = message.toLowerCase();

    // Suggest appointment if relevant
    if (this.analyzeForAppointmentSuggestion(message)) {
      actions.push({
        type: 'appointment',
        label: '📅 Schedule Appointment',
        action: 'schedule_appointment',
        data: { service_id: serviceId }
      });
    }

    // Learn more about service
    if (lowerMessage.includes('how') || lowerMessage.includes('what') || lowerMessage.includes('tell me')) {
      actions.push({
        type: 'info',
        label: 'ℹ️ Learn More',
        action: 'learn_more',
        data: { service_id: serviceId }
      });
    }

    // View documents
    if (lowerMessage.includes('document') || lowerMessage.includes('form') || lowerMessage.includes('guide')) {
      actions.push({
        type: 'documents',
        label: '📄 View Documents',
        action: 'view_documents',
        data: { service_id: serviceId }
      });
    }

    // Contact staff
    if (lowerMessage.includes('contact') || lowerMessage.includes('email') || lowerMessage.includes('staff')) {
      actions.push({
        type: 'contact',
        label: '📧 Contact Staff',
        action: 'contact_staff',
        data: { service_id: serviceId }
      });
    }

    return actions;
  }

  /**
   * Get relevant documents for sharing
   */
  static async getRelevantDocuments(serviceId, message) {
    try {
      // Get all documents for this service
      const documents = await query(`
        SELECT f.id, f.file_name, f.original_name, f.file_type, f.file_path
        FROM files f
        WHERE f.course_id = ?
        ORDER BY f.created_at DESC
        LIMIT 5
      `, [serviceId]);

      if (documents.length === 0) return [];

      // Simple keyword matching for now
      const lowerMessage = message.toLowerCase();
      const relevantDocs = documents.filter(doc => {
        const fileName = doc.original_name.toLowerCase();
        
        // Check if message contains words from filename
        const fileWords = fileName.split(/[_\-\s.]+/);
        return fileWords.some(word => 
          word.length > 3 && lowerMessage.includes(word)
        );
      });

      return relevantDocs.slice(0, 3); // Return max 3 documents
    } catch (error) {
      console.error('Error fetching relevant documents:', error);
      return [];
    }
  }

  /**
   * Build conversation memory from recent messages
   */
  static async getConversationMemory(channelId, limit = 5) {
    try {
      const messages = await query(`
        SELECT 
          m.message_text,
          m.is_bot_message,
          m.created_at,
          u.full_name as sender_name
        FROM messages m
        LEFT JOIN users u ON m.sender_id = u.id
        WHERE m.channel_id = ?
        ORDER BY m.created_at DESC
        LIMIT ?
      `, [channelId, limit]);

      return messages.reverse(); // Return in chronological order
    } catch (error) {
      console.error('Error fetching conversation memory:', error);
      return [];
    }
  }

  /**
   * Build enhanced context for bot with memory and service info
   */
  static async buildEnhancedContext(serviceId, channelId, botConfig) {
    try {
      // Get service information
      const service = await queryOne(`
        SELECT 
          s.service_name,
          s.service_description,
          s.service_type
        FROM services s
        WHERE s.id = ?
      `, [serviceId]);

      // Get conversation memory
      const conversationHistory = await this.getConversationMemory(channelId, 5);

      // Build context string
      let context = `You are an AI assistant for ${service?.service_name || 'this service'} at Ashesi University.\n\n`;
      
      if (service?.service_description) {
        context += `Service Description: ${service.service_description}\n\n`;
      }

      // Add bot-specific instructions
      if (botConfig?.instructions) {
        context += `Special Instructions: ${botConfig.instructions}\n\n`;
      }

      // Add conversation memory
      if (conversationHistory.length > 0) {
        context += `Recent Conversation:\n`;
        conversationHistory.forEach(msg => {
          const speaker = msg.is_bot_message ? 'Bot' : (msg.sender_name || 'Student');
          context += `${speaker}: ${msg.message_text}\n`;
        });
        context += '\n';
      }

      context += `Guidelines:
- Be helpful, friendly, and professional
- Provide accurate information about Ashesi University services
- Suggest booking an appointment when appropriate
- If you don't know something, admit it and suggest contacting staff
- Keep responses concise but informative
- Reference previous conversation when relevant\n`;

      return context;
    } catch (error) {
      console.error('Error building enhanced context:', error);
      return 'You are a helpful AI assistant for Ashesi University student services.';
    }
  }

  /**
   * Generate enhanced bot response with all features
   */
  static async generateEnhancedResponse(message, serviceId, channelId, botConfig, userId) {
    try {
      // Build enhanced context with memory
      const systemContext = await this.buildEnhancedContext(serviceId, channelId, botConfig);

      // Get relevant documents
      const relevantDocs = await this.getRelevantDocuments(serviceId, message);

      // Add document context if available
      let documentContext = '';
      if (relevantDocs.length > 0) {
        documentContext = '\n\nAvailable Documents:\n';
        relevantDocs.forEach(doc => {
          documentContext += `- ${doc.original_name}\n`;
        });
      }

      // Create chat completion
      const messages = [
        {
          role: 'system',
          content: systemContext + documentContext
        },
        {
          role: 'user',
          content: message
        }
      ];

      const response = await createChatCompletion(messages, {
        max_tokens: 500,
        temperature: 0.7
      });

      const botResponse = response.choices[0]?.message?.content || 'I apologize, but I could not generate a response.';

      // Generate quick actions
      const quickActions = this.generateQuickActions(message, serviceId, botConfig);

      // Build enhanced response object
      return {
        text: botResponse,
        quickActions: quickActions,
        documents: relevantDocs.map(doc => ({
          id: doc.id,
          name: doc.original_name,
          type: doc.file_type,
          url: `/api/files/${doc.id}/download`
        })),
        suggestAppointment: this.analyzeForAppointmentSuggestion(message),
        metadata: {
          hasMemory: true,
          documentsShared: relevantDocs.length > 0,
          actionsAvailable: quickActions.length > 0
        }
      };

    } catch (error) {
      console.error('Enhanced bot response error:', error);
      
      return {
        text: 'I apologize, but I encountered an error. Please try again or contact our staff directly.',
        quickActions: [
          {
            type: 'contact',
            label: '📧 Contact Staff',
            action: 'contact_staff',
            data: { service_id: serviceId }
          }
        ],
        documents: [],
        suggestAppointment: false,
        metadata: {
          error: true
        }
      };
    }
  }

  /**
   * Process quick action
   */
  static async processQuickAction(action, data, userId) {
    try {
      switch (action) {
        case 'schedule_appointment':
          return {
            type: 'redirect',
            url: `/appointments.html?service=${data.service_id}`,
            message: 'Redirecting you to book an appointment...'
          };

        case 'learn_more':
          const service = await queryOne(`
            SELECT service_name, service_description, service_type
            FROM services
            WHERE id = ?
          `, [data.service_id]);

          return {
            type: 'info',
            data: service,
            message: `Here's more information about ${service?.service_name || 'this service'}`
          };

        case 'view_documents':
          const documents = await query(`
            SELECT id, original_name, file_type
            FROM files
            WHERE course_id = ?
            ORDER BY created_at DESC
          `, [data.service_id]);

          return {
            type: 'documents',
            data: documents,
            message: 'Here are the available documents:'
          };

        case 'contact_staff':
          const staff = await query(`
            SELECT u.full_name, u.email, ss.staff_role
            FROM service_staff ss
            JOIN users u ON ss.staff_id = u.id
            WHERE ss.service_id = ? AND ss.is_active = TRUE
          `, [data.service_id]);

          return {
            type: 'contact',
            data: staff,
            message: 'Here are our staff contacts:'
          };

        default:
          return {
            type: 'error',
            message: 'Unknown action'
          };
      }
    } catch (error) {
      console.error('Process quick action error:', error);
      return {
        type: 'error',
        message: 'Failed to process action'
      };
    }
  }
}

module.exports = EnhancedBotService;
