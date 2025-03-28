import React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import './MarkdownRenderer.css';

const MarkdownRenderer = ({ content, className = '' }) => {
  if (!content) return null;
  
  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown 
        rehypePlugins={[rehypeSanitize]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;