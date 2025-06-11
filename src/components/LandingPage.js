import React, { useState, useEffect, useRef } from 'react';
import './LandingPage.css';

const LandingPage = () => {
  const [messages, setMessages] = useState([
    { sender: 'bot', text: 'Welcome to ThreatIntel. How can I assist you today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input;
    setMessages(prev => [...prev, { sender: 'user', text: userMessage }]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMessage }),
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

  const startNewChat = () => {
    setMessages([{ sender: 'bot', text: 'Welcome to ThreatIntel. How can I assist you today?' }]);
    setInput('');
  };

  return (
    <div className="app-container">
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="logo-container">
            <img src="/logo.png" alt="ThreatIntel Logo" className="logo" />
          </div>
          <button className="new-chat-button" onClick={startNewChat}>
            <span className="plus-icon">+</span>
            New Chat
          </button>
        </div>
        <div className="chat-history">
          {/* Chat history items can be added here */}
        </div>
      </div>

      <div className="main-content">
        <div className="chat-container">
          <div className={`messages-container ${messages.length > 1 ? 'show-scrollbar' : ''}`}>
            {messages.map((msg, i) => (
              <div key={i} className={`message-wrapper ${msg.sender}`}>
                <div className="message-content">
                  <div className="message-text">{msg.text}</div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="message-wrapper bot">
                <div className="message-content">
                  <div className="message-text">Thinking...</div>
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
