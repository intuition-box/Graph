import React, { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import axios from "axios";

// Style défini en dehors du composant pour éviter des re-rendus inutiles
const chatButtonStyle = {
  position: 'fixed', // Utilisation de fixed au lieu de absolute
  bottom: '20px',
  left: '20px',
  width: '180px',
  height: '40px',
  padding: '0 12px',
  backgroundColor: '#ffd32a',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  cursor: 'pointer',
  borderRadius: '10px',
  color: '#18181b',
  border: 'none',
  boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
  fontWeight: 'bold',
  fontSize: '15px',
  textTransform: 'uppercase',
  zIndex: 1200 // Z-index plus élevé
};

const chatBoxStyle = {
  position: 'fixed', // Utilisation de fixed au lieu de absolute
  bottom: '20px',
  left: '20px',
  width: '380px',
  height: '500px',
  display: 'flex',
  flexDirection: 'column',
  borderRadius: '10px',
  overflow: 'hidden',
  backgroundColor: 'rgba(30, 30, 40, 0.85)',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  backdropFilter: 'blur(5px)',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
  zIndex: 1200 // Z-index plus élevé
};

const ChatBox = ({ walletAddress }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Ajouter une référence pour le div du chat minimisé
  const chatButtonRef = useRef(null);

  // Function to automatically scroll to the bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Function to send a message to the Intuition Systems API
  const sendMessage = async () => {
    if (!input.trim()) return;
    
    // Add the user message
    const userMessage = {
      id: Date.now(),
      text: input,
      sender: "user"
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    
    try {
      // Relative URL that will work with proxy configurations
      const API_URL = '/api/completion';
      
      const response = await axios.post(
        API_URL,
        {
          text: input,
          walletAddress: walletAddress || "0x25d5C9DbC1E12163B973261A08739927E4F72BA7"
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      const aiMessage = {
        id: Date.now() + 1,
        text: response.data.text || response.data,
        sender: "ai"
      };
      
      setMessages(prev => [...prev, aiMessage]);
      setIsLoading(false);
      
    } catch (error) {
      console.error("Detailed error when calling the API:", error);
      
      // More informative error message
      const errorMessage = {
        id: Date.now() + 1,
        text: "Unable to communicate with API. This feature requires a server proxy configured to handle CORS requests.",
        sender: "system"
      };
      
      setMessages(prev => [...prev, errorMessage]);
      setIsLoading(false);
    }
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage();
  };

  // Toggle to minimize/maximize
  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
    
    // Focus l'input lorsque le chat est maximisé
    if (isMinimized && inputRef.current) {
      setTimeout(() => {
        inputRef.current.focus();
      }, 100);
    }
  };

  // Créer un élément DOM séparé pour le chat
  if (isMinimized) {
    return (
      <div 
        ref={chatButtonRef}
        style={chatButtonStyle}
        onClick={toggleMinimize}
        onMouseEnter={(e) => {e.currentTarget.style.backgroundColor = "#ffe066"}}
        onMouseLeave={(e) => {e.currentTarget.style.backgroundColor = "#ffd32a"}}
      >
        <span style={{textAlign: 'center', flex: 1}}>INTUITION CHAT</span>
        <span style={{
          fontSize: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '20px',
          height: '20px'
        }}>+</span>
      </div>
    );
  }

  return (
    <div style={chatBoxStyle}>
      <button
        style={{
          padding: '0px 12px',
          width: '100%',
          height: '40px',
          backgroundColor: '#ffd32a',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          borderRadius: '10px 10px 0 0',
          color: '#18181b',
          border: 'none',
          boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
          fontWeight: 'bold',
          fontSize: '15px',
          textTransform: 'uppercase'
        }}
        onClick={toggleMinimize}
        onMouseEnter={(e) => {e.currentTarget.style.backgroundColor = "#ffe066"}}
        onMouseLeave={(e) => {e.currentTarget.style.backgroundColor = "#ffd32a"}}
      >
        <span style={{textAlign: 'center', flex: 1}}>INTUITION CHAT</span>
        <span style={{
          fontSize: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '20px',
          height: '20px'
        }}>−</span>
      </button>
      
      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        padding: '15px', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '10px' 
      }}>
        {messages.length === 0 ? (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '100%', 
            color: 'rgba(255, 255, 255, 0.6)', 
            fontSize: '14px', 
            textAlign: 'center' 
          }}>
            <p>Start a conversation with Intuition</p>
          </div>
        ) : (
          messages.map(message => (
            <div 
              key={message.id} 
              style={{ 
                maxWidth: '80%', 
                padding: '10px 15px', 
                borderRadius: '18px', 
                marginBottom: '5px', 
                wordBreak: 'break-word',
                alignSelf: message.sender === 'user' ? 'flex-end' : 'flex-start',
                backgroundColor: message.sender === 'user' ? '#ffd32a' : 
                                message.sender === 'ai' ? 'rgba(50, 50, 60, 0.9)' : 
                                'rgba(255, 70, 70, 0.8)',
                color: message.sender === 'user' ? '#18181b' : 'white',
                borderBottomRightRadius: message.sender === 'user' ? '4px' : '18px',
                borderBottomLeftRadius: message.sender === 'ai' ? '4px' : '18px'
              }}
            >
              {message.text}
            </div>
          ))
        )}
        
        {isLoading && (
          <div style={{ 
            maxWidth: '80%', 
            padding: '10px 15px', 
            borderRadius: '18px', 
            marginBottom: '5px',
            borderBottomLeftRadius: '4px',
            alignSelf: 'flex-start',
            backgroundColor: 'rgba(50, 50, 60, 0.9)',
            color: 'white'
          }}>
            <div style={{ display: 'flex', gap: '4px' }}>
              <span style={{ 
                display: 'inline-block',
                width: '8px', 
                height: '8px', 
                borderRadius: '50%', 
                backgroundColor: 'white',
                opacity: 0.6,
                animation: 'intuition-dot-pulse 1.5s infinite ease-in-out'
              }}></span>
              <span style={{ 
                display: 'inline-block',
                width: '8px', 
                height: '8px', 
                borderRadius: '50%', 
                backgroundColor: 'white',
                opacity: 0.6,
                animation: 'intuition-dot-pulse 1.5s infinite ease-in-out 0.2s'
              }}></span>
              <span style={{ 
                display: 'inline-block',
                width: '8px', 
                height: '8px', 
                borderRadius: '50%', 
                backgroundColor: 'white',
                opacity: 0.6,
                animation: 'intuition-dot-pulse 1.5s infinite ease-in-out 0.4s'
              }}></span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      <form 
        style={{ 
          display: 'flex', 
          padding: '10px', 
          backgroundColor: 'rgba(40, 40, 50, 0.7)', 
          borderTop: '1px solid rgba(255, 255, 255, 0.1)' 
        }} 
        onSubmit={handleSubmit}
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask your question..."
          disabled={isLoading}
          style={{ 
            flex: 1, 
            padding: '12px 15px', 
            borderRadius: '20px', 
            border: 'none', 
            backgroundColor: 'rgba(60, 60, 70, 0.7)', 
            color: 'white', 
            fontSize: '14px', 
            outline: 'none' 
          }}
        />
        <button 
          type="submit" 
          disabled={isLoading || !input.trim()}
          style={{ 
            width: '36px', 
            height: '36px', 
            marginLeft: '8px', 
            borderRadius: '50%', 
            backgroundColor: isLoading || !input.trim() ? 'rgba(255, 211, 42, 0.5)' : '#ffd32a',
            border: 'none', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer', 
            color: '#18181b'
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </form>
      
      <style>
        {`
          @keyframes intuition-dot-pulse {
            0%, 100% { transform: scale(1); opacity: 0.6; }
            50% { transform: scale(1.3); opacity: 1; }
          }
        `}
      </style>
    </div>
  );
};

export default ChatBox;