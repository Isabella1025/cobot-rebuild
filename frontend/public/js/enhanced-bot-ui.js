/**
 * Enhanced Bot UI Handler
 * Handles quick actions, document sharing, and appointment suggestions
 */

const EnhancedBotUI = {
  currentServiceId: null,
  currentChannelId: null,

  init(serviceId, channelId) {
    this.currentServiceId = serviceId;
    this.currentChannelId = channelId;
  },

  /**
   * Render bot message with enhanced features
   */
  renderBotMessage(botResponse, messageId) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot-message enhanced';
    messageDiv.id = `msg-${messageId}`;

    let html = `
      <div class="message-content">
        <div class="message-avatar">🤖</div>
        <div class="message-bubble">
          <div class="message-text">${this.formatBotText(botResponse.text)}</div>
    `;

    // Add document attachments if available
    if (botResponse.documents && botResponse.documents.length > 0) {
      html += this.renderDocuments(botResponse.documents);
    }

    // Add quick action buttons
    if (botResponse.quickActions && botResponse.quickActions.length > 0) {
      html += this.renderQuickActions(botResponse.quickActions);
    }

    // Add appointment suggestion banner
    if (botResponse.suggestAppointment) {
      html += this.renderAppointmentSuggestion();
    }

    html += `
          <div class="message-time">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
        </div>
      </div>
    `;

    messageDiv.innerHTML = html;
    return messageDiv;
  },

  /**
   * Format bot text (add line breaks, links, etc.)
   */
  formatBotText(text) {
    return text
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');
  },

  /**
   * Render document attachments
   */
  renderDocuments(documents) {
    let html = '<div class="bot-documents">';
    html += '<div class="documents-header">📄 Relevant Documents:</div>';
    html += '<div class="documents-list">';

    documents.forEach(doc => {
      const icon = this.getFileIcon(doc.type);
      html += `
        <a href="${doc.url}" class="document-item" target="_blank" download>
          <span class="doc-icon">${icon}</span>
          <span class="doc-name">${doc.name}</span>
          <span class="doc-action">Download ↓</span>
        </a>
      `;
    });

    html += '</div></div>';
    return html;
  },

  /**
   * Render quick action buttons
   */
  renderQuickActions(actions) {
    let html = '<div class="quick-actions">';
    
    actions.forEach(action => {
      html += `
        <button 
          class="quick-action-btn quick-action-${action.type}" 
          onclick="EnhancedBotUI.handleQuickAction('${action.action}', ${JSON.stringify(action.data).replace(/"/g, '&quot;')})"
        >
          ${action.label}
        </button>
      `;
    });

    html += '</div>';
    return html;
  },

  /**
   * Render appointment suggestion banner
   */
  renderAppointmentSuggestion() {
    return `
      <div class="appointment-suggestion">
        <div class="suggestion-icon">💡</div>
        <div class="suggestion-text">
          Would you like to schedule an appointment to discuss this further?
        </div>
        <button 
          class="suggestion-btn" 
          onclick="EnhancedBotUI.handleQuickAction('schedule_appointment', {service_id: ${this.currentServiceId}})"
        >
          Book Appointment
        </button>
      </div>
    `;
  },

  /**
   * Handle quick action button click
   */
  async handleQuickAction(action, data) {
    try {
      console.log('Quick action:', action, data);

      // Show loading state
      this.showActionLoading(action);

      const response = await fetch('http://localhost:3000/api/bot/quick-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action, data })
      });

      const result = await response.json();

      if (result.success) {
        this.processActionResult(result.data);
      } else {
        this.showActionError(result.error);
      }

    } catch (error) {
      console.error('Quick action error:', error);
      this.showActionError('Failed to process action');
    }
  },

  /**
   * Process action result
   */
  processActionResult(result) {
    switch (result.type) {
      case 'redirect':
        window.location.href = result.url;
        break;

      case 'info':
        this.displayServiceInfo(result.data);
        break;

      case 'documents':
        this.displayDocumentsList(result.data);
        break;

      case 'contact':
        this.displayStaffContacts(result.data);
        break;

      default:
        console.log('Action result:', result);
    }
  },

  /**
   * Display service information modal
   */
  displayServiceInfo(serviceData) {
    // Add to chat as a bot message
    const infoMessage = `
      <strong>${serviceData.service_name}</strong><br><br>
      ${serviceData.service_description || 'No description available.'}
    `;
    
    // You can append this to the chat or show in a modal
    if (typeof appendBotMessage === 'function') {
      appendBotMessage(infoMessage);
    }
  },

  /**
   * Display documents list
   */
  displayDocumentsList(documents) {
    if (documents.length === 0) {
      if (typeof appendBotMessage === 'function') {
        appendBotMessage('No documents are currently available for this service.');
      }
      return;
    }

    let html = '<strong>Available Documents:</strong><br><br>';
    documents.forEach(doc => {
      const icon = this.getFileIcon(doc.file_type);
      html += `${icon} <a href="/api/files/${doc.id}/download" download>${doc.original_name}</a><br>`;
    });

    if (typeof appendBotMessage === 'function') {
      appendBotMessage(html);
    }
  },

  /**
   * Display staff contacts
   */
  displayStaffContacts(staff) {
    if (staff.length === 0) {
      if (typeof appendBotMessage === 'function') {
        appendBotMessage('No staff contacts are currently available.');
      }
      return;
    }

    let html = '<strong>Staff Contacts:</strong><br><br>';
    staff.forEach(member => {
      html += `📧 <strong>${member.full_name}</strong> (${member.staff_role})<br>`;
      html += `Email: <a href="mailto:${member.email}">${member.email}</a><br><br>`;
    });

    if (typeof appendBotMessage === 'function') {
      appendBotMessage(html);
    }
  },

  /**
   * Get file icon based on type
   */
  getFileIcon(fileType) {
    const icons = {
      'pdf': '📄',
      'doc': '📝',
      'docx': '📝',
      'xls': '📊',
      'xlsx': '📊',
      'ppt': '📊',
      'pptx': '📊',
      'txt': '📄',
      'jpg': '🖼️',
      'jpeg': '🖼️',
      'png': '🖼️',
      'gif': '🖼️'
    };

    const ext = fileType?.toLowerCase() || '';
    return icons[ext] || '📎';
  },

  /**
   * Show loading state for action
   */
  showActionLoading(action) {
    // Add visual feedback (you can customize this)
    console.log(`Processing ${action}...`);
  },

  /**
   * Show action error
   */
  showActionError(error) {
    console.error('Action error:', error);
    if (typeof appendBotMessage === 'function') {
      appendBotMessage(`❌ ${error}`);
    }
  }
};

// Make available globally
window.EnhancedBotUI = EnhancedBotUI;
