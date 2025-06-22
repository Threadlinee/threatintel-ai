import React, { useState, useEffect, useRef } from 'react';
import { Filter } from 'bad-words';
import './LandingPage.css';
import { allExamplePrompts } from '../data/prompts';

const filter = new Filter();const LandingPage = () => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showAppearance, setShowAppearance] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');

  const textareaRef = useRef(null);

  // --- State for multi-chat management ---
  const [chatHistory, setChatHistory] = useState([]);
  const [allMessages, setAllMessages] = useState({});
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [displayedPrompts, setDisplayedPrompts] = useState([]);

  const messagesEndRef = useRef(null);
  
  const [animatedBotText, setAnimatedBotText] = useState("");
  const [isAnimating, setIsAnimating] = useState(false);
  const animationSpeed = 50; // ms per character (fast)
  
  const [attachedFile, setAttachedFile] = useState(null);
  const fileInputRef = useRef(null);

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

  // Set random prompts on initial load
  useEffect(() => {
    const shuffled = allExamplePrompts.sort(() => 0.5 - Math.random());
    setDisplayedPrompts(shuffled.slice(0, 4));
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
      if (!response.ok) {
        throw new Error('Connection failed: Could not start a new chat. Please ensure the backend server is running correctly.');
      }
      const data = await response.json();
      
      const newChat = { id: data.conversationId, title: 'New Chat' };
      
      setChatHistory(prev => [newChat, ...prev]);
      setAllMessages(prev => ({ ...prev, [data.conversationId]: [{ sender: 'bot', text: data.greeting }] }));
      setActiveConversationId(data.conversationId);
    } catch (error) {
      console.error('Error starting new chat:', error);
      const errorId = `error_${Date.now()}`;
      const errorMessage = `Failed to start a new chat. Please ensure the backend server is running.`;
      const newChat = { id: errorId, title: 'Connection Error' };
      setChatHistory(prev => [newChat, ...prev]);
      setAllMessages(prev => ({ ...prev, [errorId]: [{ sender: 'bot', text: errorMessage }] }));
      setActiveConversationId(errorId);
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

    setWarningMessage(''); // Clear previous warnings
    let messageForDisplay = userMessage;
    let isProfane = false;

    if (filter.isProfane(userMessage)) {
      messageForDisplay = filter.clean(userMessage);
      setWarningMessage('Inappropriate language detected and censored. Please be respectful.');
      isProfane = true;
    }

    const currentMessages = allMessages[activeConversationId] || [];
    const newMessages = [...currentMessages, { sender: 'user', text: messageForDisplay }];
    setAllMessages(prev => ({ ...prev, [activeConversationId]: newMessages }));

    // Show 'Thinking...' bot message instantly before POST request
    setAllMessages(prev => ({
      ...prev,
      [activeConversationId]: [...newMessages, { sender: 'bot', text: 'Thinking...' }]
    }));

    if (!messageToSend) setInput('');
    setIsLoading(true);

    if (currentMessages.filter(m => m.sender === 'user').length === 0) {
      const newTitle = messageForDisplay.split(' ').slice(0, 5).join(' ');
      setChatHistory(prev => prev.map(chat => 
        chat.id === activeConversationId ? { ...chat, title: newTitle } : chat
      ));
    }
    
    const formData = new FormData();
    formData.append('message', messageForDisplay);
    formData.append('conversationId', activeConversationId);
    formData.append('profanityDetected', isProfane);
    if (attachedFile) {
      formData.append('file', attachedFile);
    }

    try {
      const response = await fetch(`${process.env.REACT_APP_BASE_URL}/api/chat`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();

      if (response.ok) {
        // Replace the 'Thinking...' message with the real response and animate immediately
        setAllMessages(prev => {
          const msgs = prev[activeConversationId] || [];
          // Replace last bot message
          return {
            ...prev,
            [activeConversationId]: [
              ...msgs.slice(0, -1),
              { sender: 'bot', text: data.response }
            ]
          };
        });
        setIsAnimating(true);
        setAnimatedBotText("");
        setAttachedFile(null); // clear after send
      } else {
        throw new Error(data.error || 'Failed to get response from server.');
      }
    } catch (error) {
       let friendlyMessage = error.message;
      if (error.message.toLowerCase().includes('authentication failure')) {
        friendlyMessage = 'Authentication Error: The APIsss key is invalid or missing. Please check the .env file in the backend directory.';
      } else if (error.message.toLowerCase().includes('failed to fetch')) {
        friendlyMessage = 'Connection Error: Unable to connect to the backend server. Please make sure it is running.';
      }
      
      setAllMessages(prev => ({
        ...prev,
        [activeConversationId]: [...newMessages, { sender: 'bot', text: `Error: ${friendlyMessage}` }]
      }));
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const maxHeight = 200; // Max height in pixels
      const scrollHeight = textarea.scrollHeight;

      if (scrollHeight > maxHeight) {
        textarea.style.height = `${maxHeight}px`;
        textarea.style.overflowY = 'auto';
      } else {
        textarea.style.height = `${scrollHeight}px`;
        textarea.style.overflowY = 'hidden';
      }
    }
  }, [input]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages, activeConversationId]);

  const handleCopy = (code, buttonId) => {
    navigator.clipboard.writeText(code).then(() => {
      const button = document.getElementById(buttonId);
      if (button) {
        button.classList.add('copied');
        setTimeout(() => {
          button.classList.remove('copied');
        }, 2000);
      }
    }, (err) => {
      console.error('Failed to copy code: ', err);
    });
  };

  // Animate the latest bot message
  useEffect(() => {
    const messages = allMessages[activeConversationId] || [];
    if (!messages.length) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.sender === "bot") {
      setAnimatedBotText("");
      setIsAnimating(true);
      let i = 0;
      const reveal = () => {
        setAnimatedBotText(lastMsg.text.slice(0, i));
        if (i < lastMsg.text.length) {
          i += Math.max(2, Math.floor(lastMsg.text.length / 60)); // reveal in chunks for speed
          setTimeout(reveal, animationSpeed);
        } else {
          setAnimatedBotText(lastMsg.text);
          setIsAnimating(false);
        }
      };
      reveal();
    } else {
      setAnimatedBotText("");
      setIsAnimating(false);
    }
    // Only run when a new bot message is added
    // eslint-disable-next-line
  }, [allMessages, activeConversationId]);

  // Remove the 3-dot typing indicator and scroll during animation
  useEffect(() => {
    if (isAnimating && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [animatedBotText, isAnimating]);

  const renderMessage = (text, animate = false) => {
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
        const buttonId = `copy-btn-${Date.now()}-${index}`;
        return (
          <div key={index} className="code-block-container">
            <div className="code-block-header">
              <span>{part.language}</span>
              <button id={buttonId} className="copy-code-button" onClick={() => handleCopy(part.content, buttonId)}>
                <span className="copy-icon">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M10.75 4.75H4.25C3.83579 4.75 3.5 5.08579 3.5 5.5V12.5C3.5 12.9142 3.83579 13.25 4.25 13.25H10.75C11.1642 13.25 11.5 12.9142 11.5 12.5V5.5C11.5 5.08579 11.1642 4.75 10.75 4.75Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M7.5 4.75V3.75C7.5 3.19772 7.94772 2.75 8.5 2.75H12.5C13.0523 2.75 13.5 3.19772 13.5 3.75V10.25C13.5 10.8023 13.0523 11.25 12.5 11.25H11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
                <span className="copy-text">Copied!</span>
              </button>
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
            className={`message-text-content${animate ? ' bot-typing-anim' : ''}`}
            dangerouslySetInnerHTML={{ __html: formattedText }}
          />
        );
      }
    });
  };

  const setTheme = (theme) => {
    const root = document.documentElement;
    // Reset to default Phind-like theme first
    root.style.setProperty('--primary-slate', '#2E3A59');
    root.style.setProperty('--accent-cyan', '#00FFFF');
    root.style.setProperty('--background-light', '#F8F9FA');
    root.style.setProperty('--background-white', '#FFFFFF');
    root.style.setProperty('--text', '#2E3A59');
    root.style.setProperty('--text-light', '#F8F9FA');
    root.style.setProperty('--border', '#E5E7EB');
    root.style.setProperty('--code-bg-container', '#F0F2F5');
    root.style.setProperty('--code-bg-header', '#E8EBF0');
    root.style.setProperty('--code-text-header', '#6c757d');
    root.style.setProperty('--scrollbar-thumb', '#00FFFF');
    root.style.setProperty('--scrollbar-track', '#2E3A59');

    switch (theme) {
      case 'indigo-mint':
        root.style.setProperty('--primary-slate', '#4B0082'); // indigo
        root.style.setProperty('--accent-cyan', '#98FF98'); // mint
        root.style.setProperty('--background-light', '#1C1C1C'); // charcoal
        root.style.setProperty('--background-white', '#2A2A2A');
        root.style.setProperty('--text', '#E0E0E0');
        root.style.setProperty('--text-light', '#FFFFFF');
        root.style.setProperty('--border', '#444444');
        root.style.setProperty('--code-bg-container', '#252525');
        root.style.setProperty('--code-bg-header', '#333333');
        root.style.setProperty('--code-text-header', '#AAAAAA');
        root.style.setProperty('--scrollbar-thumb', '#98FF98'); // mint
        root.style.setProperty('--scrollbar-track', '#4B0082'); // indigo
        break;
      case 'teal-gold':
        root.style.setProperty('--primary-slate', '#008080'); // teal
        root.style.setProperty('--accent-cyan', '#FFD700'); // gold
        root.style.setProperty('--background-light', '#191970'); // midnight blue
        root.style.setProperty('--background-white', '#242482');
        root.style.setProperty('--text', '#E0E0E0');
        root.style.setProperty('--text-light', '#FFFFFF');
        root.style.setProperty('--border', '#3A3A9A');
        root.style.setProperty('--code-bg-container', '#1F1F7A');
        root.style.setProperty('--code-bg-header', '#2A2A9A');
        root.style.setProperty('--code-text-header', '#AABBDD');
        root.style.setProperty('--scrollbar-thumb', '#FFD700'); // gold
        root.style.setProperty('--scrollbar-track', '#008080'); // teal
        break;
      case 'slate-cyan': // This is the default theme
        // Already reset above, so no need to do anything here
        break;
      case 'purple-sky':
        root.style.setProperty('--primary-slate', '#6A0DAD'); // purple
        root.style.setProperty('--accent-cyan', '#87CEEB'); // sky blue
        root.style.setProperty('--background-light', '#F0F0F0'); // silver-ish light
        root.style.setProperty('--background-white', '#FFFFFF');
        root.style.setProperty('--text', '#333333');
        root.style.setProperty('--text-light', '#FFFFFF');
        root.style.setProperty('--border', '#DCDCDC');
        root.style.setProperty('--code-bg-container', '#EAEAEA');
        root.style.setProperty('--code-bg-header', '#DDDDDD');
        root.style.setProperty('--code-text-header', '#555555');
        root.style.setProperty('--scrollbar-thumb', '#87CEEB'); // sky blue
        root.style.setProperty('--scrollbar-track', '#6A0DAD'); // purple
        break;
      case 'dark-green-ivory':
        root.style.setProperty('--primary-slate', '#014421'); // dark green
        root.style.setProperty('--accent-cyan', '#FFFFF0'); // ivory
        root.style.setProperty('--background-light', '#B87333'); // copper
        root.style.setProperty('--background-white', '#C88343');
        root.style.setProperty('--text', '#FFFFFF');
        root.style.setProperty('--text-light', '#FFFFFF');
        root.style.setProperty('--border', '#A86323');
        root.style.setProperty('--code-bg-container', '#A06529');
        root.style.setProperty('--code-bg-header', '#805020');
        root.style.setProperty('--code-text-header', '#EEDDCC');
        root.style.setProperty('--scrollbar-thumb', '#FFFFF0'); // ivory
        root.style.setProperty('--scrollbar-track', '#014421'); // dark green
        break;
      default:
        break;
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setAttachedFile(file);
    if (file) {
      console.log('Selected file:', file);
    }
  };

  const handleAttachClick = () => {
    fileInputRef.current.click();
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
        <div className="sidebar-section">
          <div className="appearance-toggle" onClick={() => setShowAppearance(!showAppearance)}>
            <span role="img" aria-label="appearance">🎨</span> Appearance
          </div>
        </div>
        {showAppearance && (
          <div className="appearance-modal">
            <div className="appearance-modal-header">Choose a theme:</div>
            <button className="theme-button" onClick={() => setTheme('indigo-mint')}>Charcoal</button>
            <button className="theme-button" onClick={() => setTheme('teal-gold')}>Midnight Blue</button>
            <button className="theme-button" onClick={() => setTheme('slate-cyan')}>Default Light</button>
            <button className="theme-button" onClick={() => setTheme('purple-sky')}>Purple</button>
            <button className="theme-button" onClick={() => setTheme('dark-green-ivory')}>Copper</button>
          </div>
        )}
      </div>

      <div className="main-content">
        <div className="chat-container">
          <div className="messages-container">
            {(allMessages[activeConversationId] || []).map((msg, i, arr) => {
              const isLatestBot =
                msg.sender === "bot" &&
                i === arr.length - 1 &&
                isAnimating;
              return (
                <div key={i} className={`message-wrapper ${msg.sender}`}>
                  <div className="message-content">
                    <div className="message-text">
                      {msg.sender === "bot" && isLatestBot
                        ? renderMessage(animatedBotText, true)
                        : renderMessage(msg.text)}
                    </div>
                  </div>
                </div>
              );
            })}
            {allMessages[activeConversationId] && allMessages[activeConversationId].length < 2 && !isLoading && (
              <div className="welcome-enhancements">
                <div className="example-prompts">
                  {displayedPrompts.map((prompt, i) => (
                    <div key={i} className="prompt-card" onClick={() => handleSend(prompt)}>
                      <h4>{prompt}</h4>
                      <p>Click to send this prompt</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {isLoading && false /* removed typing indicator */}
            <div ref={messagesEndRef} />
          </div>

          <div className="input-container">
            {attachedFile && (
              <div className="file-preview">
                {attachedFile.type.startsWith('image/') ? (
                  <img
                    src={URL.createObjectURL(attachedFile)}
                    alt="preview"
                    style={{ maxWidth: 120, maxHeight: 120, borderRadius: 8, marginBottom: 8 }}
                  />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span role="img" aria-label="file" style={{ fontSize: 32 }}>
                      {attachedFile.type === 'application/pdf' ? '📄' : attachedFile.type.includes('presentation') ? '📊' : '📎'}
                    </span>
                    <span>{attachedFile.name}</span>
                  </div>
                )}
                <button
                  className="remove-file-btn"
                  onClick={() => setAttachedFile(null)}
                  style={{ marginTop: 4 }}
                >
                  Remove
                </button>
              </div>
            )}
            <form onSubmit={e => {
              e.preventDefault();
              handleSend();
            }}>
              <div className="input-wrapper">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything about cybersecurity..."
                  className="message-input"
                  disabled={isLoading}
                  rows={1}
                />
                {/* File attachment button */}
                <button
                  type="button"
                  className="attach-button"
                  onClick={handleAttachClick}
                  tabIndex={-1}
                  style={{ marginRight: 8 }}
                  aria-label="Attach file"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a5 5 0 0 1-7.07-7.07l9.19-9.19a3 3 0 0 1 4.24 4.24l-9.2 9.19a1 1 0 0 1-1.41-1.41l9.19-9.19"/></svg>
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
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
              {warningMessage && <p className="warning-message">{warningMessage}</p>}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;