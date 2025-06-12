import React, { useState, useEffect, useRef } from 'react';
import './LandingPage.css';

const LandingPage = () => {
  const [messages, setMessages] = useState([
    { sender: 'bot', text: 'Welcome to ThreatIntel AI. How can I assist you today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    startNewChat();
  }, []);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input;
    setMessages(prev => [...prev, { sender: 'user', text: userMessage }]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch(`${process.env.REACT_APP_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          message: userMessage,
          conversationId: conversationId
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setMessages(prev => [...prev, { sender: 'bot', text: data.response }]);
      } else {
        throw new Error(data.error || 'Failed to get response');
      }
    } catch (error) {
      setMessages(prev => [...prev, { 
        sender: 'bot', 
        text: 'Sorry, I encountered an error. Please try again.' 
      }]);
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startNewChat = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BASE_URL}/api/chat/new`, {
        method: 'POST',
      });
      const data = await response.json();
      setConversationId(data.conversationId);
      setMessages([{ sender: 'bot', text: 'Welcome to ThreatIntel AI. How can I assist you today?' }]);
      setInput('');
    } catch (error) {
      console.error('Error starting new chat:', error);
    }
  };

  const renderMessage = (text) => {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: text.slice(lastIndex, match.index)
        });
      }
      
      parts.push({
        type: 'code',
        language: match[1] || 'text',
        content: match[2]
      });
      
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push({
        type: 'text',
        content: text.slice(lastIndex)
      });
    }

    if (parts.length === 0) {
      parts.push({ type: 'text', content: text });
    }

    return parts.map((part, index) => {
      if (part.type === 'code') {
        return (
          <pre key={index} className="code-block">
            <code className={`language-${part.language}`}>
              {part.content}
            </code>
          </pre>
        );
      } else {
        let formattedText = part.content
          .replace(/^### (.*)$/gm, '<strong>$1</strong>') // Convert ### headers to bold
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
          .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
          .replace(/`(.*?)`/g, '<code class="inline-code">$1</code>') // Inline code
          .replace(/\n/g, '<br />'); // Line breaks

        return (
          <div 
            key={index} 
            className="message-text-content"
            dangerouslySetInnerHTML={{ __html: formattedText }}
          />
        );
      }
    });
  };

  return (
    <div className="app-container">
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="logo-container">
            <div className="logo-icon">T</div>
            <div className="logo-text">
              ThreatIntel <span>AI</span>
            </div>
          </div>
          <button className="new-chat-button" onClick={startNewChat}>
            <span className="plus-icon">+</span>
            New Chat
          </button>
        </div>
        <div className="chat-history">
          {}
        </div>
      </div>

      <div className="main-content">
        <div className="chat-container">
          <div className="messages-container">
            {messages.map((msg, i) => (
              <div key={i} className={`message-wrapper ${msg.sender}`}>
                <div className="message-content">
                  <div className="message-text">
                    {renderMessage(msg.text)}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="message-wrapper bot">
                <div className="message-content loading">
                  <div className="message-text">
                    <span className="typing-dots">...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="input-container">
            <form onSubmit={e => {
              e.preventDefault();
              handleSend();
            }}>
              <div className="input-wrapper">
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Ask anything..."
                  className="message-input"
                  disabled={isLoading}
                />
                <button 
                  type="submit" 
                  className="send-button"
                  disabled={!input.trim() || isLoading}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;