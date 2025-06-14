import React, { useState, useEffect, useRef } from 'react';
import './LandingPage.css';

const LandingPage = () => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showAppearance, setShowAppearance] = useState(false);

  // --- State for multi-chat management ---
  const [chatHistory, setChatHistory] = useState([]);
  const [allMessages, setAllMessages] = useState({});
  const [activeConversationId, setActiveConversationId] = useState(null);

  const messagesEndRef = useRef(null);
  
  const examplePrompts = [
    'What are the most common web application vulnerabilities?',
    'Explain the MITRE ATT&CK framework.',
    'Write a python script to scan for open ports on a host.',
    'How does a DDoS attack work and how can it be mitigated?'
  ];

  // Load from localStorage on initial render
  useEffect(() => {
    try {
      const savedHistory = JSON.parse(localStorage.getItem('chatHistory'));
      const savedMessages = JSON.parse(localStorage.getItem('allMessages'));

      if (savedHistory && savedMessages && savedHistory.length > 0) {
        setChatHistory(savedHistory);
        setAllMessages(savedMessages);
        setActiveConversationId(savedHistory[0].id);
      } else {
        startNewChat();
      }
    } catch (error) {
      console.error("Failed to load from localStorage", error);
      startNewChat();
    }
  }, []);

  // Save to localStorage whenever history or messages change
  useEffect(() => {
    if (chatHistory.length > 0 && Object.keys(allMessages).length > 0) {
      localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
      localStorage.setItem('allMessages', JSON.stringify(allMessages));
    }
  }, [chatHistory, allMessages]);
  
  const startNewChat = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_BASE_URL}/api/chat/new`, { method: 'POST' });
      const data = await response.json();
      
      const newChat = { id: data.conversationId, title: 'New Chat' };
      
      setChatHistory(prev => [newChat, ...prev]);
      setAllMessages(prev => ({ ...prev, [data.conversationId]: [{ sender: 'bot', text: data.greeting }] }));
      setActiveConversationId(data.conversationId);
    } catch (error) {
      console.error('Error starting new chat:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const selectChat = (id) => {
    setActiveConversationId(id);
  };
  
  const deleteChat = (idToDelete) => {
    const remainingChats = chatHistory.filter(chat => chat.id !== idToDelete);
    setChatHistory(remainingChats);
    
    setAllMessages(prev => {
      const newMessages = { ...prev };
      delete newMessages[idToDelete];
      return newMessages;
    });

    if (activeConversationId === idToDelete) {
      if (remainingChats.length > 0) {
        setActiveConversationId(remainingChats[0].id);
      } else {
        startNewChat();
      }
    }
  };

  const handleSend = async (messageToSend) => {
    const userMessage = messageToSend || input;
    if (!userMessage.trim() || !activeConversationId) return;

    const currentMessages = allMessages[activeConversationId] || [];
    const newMessages = [...currentMessages, { sender: 'user', text: userMessage }];
    setAllMessages(prev => ({ ...prev, [activeConversationId]: newMessages }));

    if (!messageToSend) setInput('');
    setIsLoading(true);

    if (currentMessages.filter(m => m.sender === 'user').length === 0) {
      const newTitle = userMessage.split(' ').slice(0, 5).join(' ');
      setChatHistory(prev => prev.map(chat => 
        chat.id === activeConversationId ? { ...chat, title: newTitle } : chat
      ));
    }
    
    try {
      const response = await fetch(`${process.env.REACT_APP_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, conversationId: activeConversationId }),
      });
      const data = await response.json();

      if (response.ok) {
        setAllMessages(prev => ({
          ...prev,
          [activeConversationId]: [...newMessages, { sender: 'bot', text: data.response }]
        }));
      } else {
        throw new Error(data.error || 'Failed to get response');
      }
    } catch (error) {
      setAllMessages(prev => ({
        ...prev,
        [activeConversationId]: [...newMessages, { sender: 'bot', text: 'Sorry, I encountered an error. Please try again.' }]
      }));
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages, activeConversationId]);

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
          <div key={index} className="code-block-container">
            <div className="code-block-header">
              <span>{part.language}</span>
            </div>
            <pre className="code-block">
              <code className={`language-${part.language}`}>
                {part.content}
              </code>
            </pre>
          </div>
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

  const setTheme = (theme) => {
    const root = document.documentElement;
    switch (theme) {
      case 'indigo-mint':
        root.style.setProperty('--primary-color', '#4B0082');
        root.style.setProperty('--accent-color', '#98FF98');
        root.style.setProperty('--background-color', '#1C1C1C');
        break;
      case 'teal-gold':
        root.style.setProperty('--primary-color', '#008080');
        root.style.setProperty('--accent-color', '#FFD700');
        root.style.setProperty('--background-color', '#191970');
        break;
      case 'slate-cyan':
        root.style.setProperty('--primary-color', '#2E3A59');
        root.style.setProperty('--accent-color', '#00FFFF');
        root.style.setProperty('--background-color', '#F8F9FA');
        break;
      case 'purple-sky':
        root.style.setProperty('--primary-color', '#6A0DAD');
        root.style.setProperty('--accent-color', '#87CEEB');
        root.style.setProperty('--background-color', '#C0C0C0');
        break;
      case 'dark-green-ivory':
        root.style.setProperty('--primary-color', '#014421');
        root.style.setProperty('--accent-color', '#FFFFF0');
        root.style.setProperty('--background-color', '#B87333');
        break;
      default:
        break;
    }
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
          {chatHistory.map(chat => (
            <div 
              key={chat.id} 
              className={`chat-history-item ${chat.id === activeConversationId ? 'active' : ''}`}
              onClick={() => selectChat(chat.id)}
            >
              <span className="chat-title">{chat.title}</span>
              <button className="delete-chat-button" onClick={(e) => {
                e.stopPropagation();
                deleteChat(chat.id);
              }}>
                &#x2715;
              </button>
            </div>
          ))}
        </div>
        <div className="sidebar-section" onClick={() => setShowAppearance(!showAppearance)} style={{ cursor: 'pointer', padding: '16px 0', textAlign: 'center' }}>
          <span role="img" aria-label="appearance">��</span> Appearance
        </div>
        {showAppearance && (
          <div className="sidebar-section" style={{ padding: '12px', background: 'rgba(255,255,255,0.07)', borderRadius: '10px', margin: '0 16px 16px 16px' }}>
            <div style={{ marginBottom: '8px' }}>Choose a theme:</div>
            <button className="theme-button" onClick={() => setTheme('indigo-mint')}>Indigo + Mint Green + Charcoal</button>
            <button className="theme-button" onClick={() => setTheme('teal-gold')}>Teal + Soft Gold + Midnight Blue</button>
            <button className="theme-button" onClick={() => setTheme('slate-cyan')}>Slate Gray + Neon Cyan + White</button>
            <button className="theme-button" onClick={() => setTheme('purple-sky')}>Purple + Sky Blue + Silver</button>
            <button className="theme-button" onClick={() => setTheme('dark-green-ivory')}>Dark Green + Ivory + Copper</button>
          </div>
        )}
      </div>

      <div className="main-content">
        <div className="chat-container">
          <div className="messages-container">
            {(allMessages[activeConversationId] || []).map((msg, i) => (
              <div key={i} className={`message-wrapper ${msg.sender}`}>
                <div className="message-content">
                  <div className="message-text">
                    {renderMessage(msg.text)}
                  </div>
                </div>
              </div>
            ))}
            {allMessages[activeConversationId] && allMessages[activeConversationId].length < 2 && !isLoading && (
              <div className="welcome-enhancements">
                <div className="example-prompts">
                  {examplePrompts.map((prompt, i) => (
                    <div key={i} className="prompt-card" onClick={() => handleSend(prompt)}>
                      <h4>{prompt}</h4>
                      <p>Click to send this prompt</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {isLoading && (
              <div className="message-wrapper bot">
                <div className="message-content">
                  <div className="typing-indicator-inline">
                    <span className="dot"></span>
                    <span className="dot"></span>
                    <span className="dot"></span>
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
                  placeholder="Ask anything about cybersecurity..."
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