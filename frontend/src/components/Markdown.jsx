"use client";

import React from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

// Arabic text detection utility
const detectArabic = (text) => {
  if (!text || typeof text !== 'string') return false;
  // Check for Arabic Unicode ranges: \u0600-\u06FF (Arabic), \u0750-\u077F (Arabic Supplement)
  return /[\u0600-\u06FF\u0750-\u077F]/.test(text);
};

// Enhanced text processing to detect and render mathematical equations
const processTextForMath = (text) => {
  if (!text) return text;
  
  // Split text by math delimiters and process each part
  const parts = text.split(/(\\?\([^)]+\)|\\?\[[^\]]+\])/g);
  
  return parts.map((part, index) => {
    // Check for inline math: \( ... \)
    if (part.match(/^\\?\(([^)]+)\)$/)) {
      const mathContent = part.replace(/^\\?\(/, '').replace(/\)$/, '');
      return (
        <InlineMath key={index} math={mathContent} />
      );
    }
    
    // Check for display math: \[ ... \]
    if (part.match(/^\\?\[([^\]]+)\]$/)) {
      const mathContent = part.replace(/^\\?\[/, '').replace(/\]$/, '');
      return (
        <BlockMath key={index} math={mathContent} />
      );
    }
    
    // Regular text
    return part;
  });
};

// Helpers to embed video links
function getYouTubeEmbed(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) {
      const id = u.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.slice(1);
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
  } catch {}
  return null;
}

function getVimeoEmbed(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch {}
  return null;
}

function isDirectVideo(url) {
  return /\.(mp4|webm|ogg)(\?.*)?$/i.test(url || "");
}

// Enhanced helper to detect if URL is an image (including more formats)
function isImageUrl(url) {
  return /\.(jpg|jpeg|png|gif|bmp|webp|svg|tiff|ico)(\?.*)?$/i.test(url || "");
}

// Enhanced Image component with Shadcn typography styling
const EnhancedImage = ({ src, alt, ...props }) => {
  const [imageError, setImageError] = React.useState(false);
  const [imageLoading, setImageLoading] = React.useState(true);
  const [imageSrc, setImageSrc] = React.useState(src);

  // Handle different image formats and URLs
  React.useEffect(() => {
    if (src) {
      // Reset states when src changes
      setImageLoading(true);
      setImageError(false);
      
      // Handle data URLs (base64 images)
      if (src.startsWith('data:')) {
        setImageSrc(src);
        return;
      }
      
      // Handle relative URLs
      if (src.startsWith('/') || src.startsWith('./')) {
        setImageSrc(src);
        return;
      }
      
      // Handle absolute URLs
      if (src.startsWith('http://') || src.startsWith('https://')) {
        setImageSrc(src);
        return;
      }
      
      // Handle other cases
      setImageSrc(src);
    }
  }, [src]);

  const handleImageLoad = () => {
    setImageLoading(false);
    setImageError(false);
  };

  const handleImageError = () => {
    setImageLoading(false);
    setImageError(true);
  };

  if (imageError) {
    return (
      <div className="my-6 p-4 border border-red-200 rounded-lg bg-red-50 dark:bg-red-900/20 dark:border-red-800">
        <p className="text-red-600 dark:text-red-400 text-sm font-medium">
          Failed to load image: {alt || src}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          URL: {imageSrc}
        </p>
      </div>
    );
  }

  return (
    <div className="relative my-6 w-full">
      {imageLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted rounded-lg min-h-[200px]">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
            <p className="text-sm text-muted-foreground">Loading image...</p>
          </div>
        </div>
      )}
      <div className="relative overflow-hidden rounded-lg border bg-muted/50">
        <img
          src={imageSrc}
          alt={alt || ""}
          className={`w-full h-auto transition-opacity duration-300 ${
            imageLoading ? 'opacity-0' : 'opacity-100'
          }`}
          loading="lazy"
          onLoad={handleImageLoad}
          onError={handleImageError}
          style={{ 
            maxHeight: '500px',
            objectFit: 'contain'
          }}
          {...props}
        />
        {alt && (
          <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white p-2 text-sm">
            {alt}
          </div>
        )}
      </div>
    </div>
  );
};

// Enhanced text processing to detect and render images from URLs
const processTextForImages = (text) => {
  if (!text) return text;
  
  // Find all URLs in the text
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = text.match(urlRegex) || [];
  
  let processedText = text;
  
  // Process each URL
  urls.forEach(url => {
    if (isImageUrl(url)) {
      // Replace the URL with markdown image syntax
      const imageMarkdown = `![Image](${url})`;
      processedText = processedText.replace(url, imageMarkdown);
    }
  });
  
  return processedText;
};

export const MarkdownStyles = {
  // Headings (shadcn typography)
  h1: ({ node, ...props }) => (
    <h1
      className="scroll-m-20 text-4xl font-extrabold tracking-tight text-balance lg:text-5xl mt-6 first:mt-0"
      {...props}
    />
  ),
  h2: ({ node, ...props }) => (
    <h2
      className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0 mt-10"
      {...props}
    />
  ),
  h3: ({ node, ...props }) => (
    <h3
      className="scroll-m-20 text-2xl font-semibold tracking-tight mt-8"
      {...props}
    />
  ),
  h4: ({ node, ...props }) => (
    <h4
      className="scroll-m-20 text-xl font-semibold tracking-tight mt-6"
      {...props}
    />
  ),
  h5: ({ node, ...props }) => (
    <h5 className="text-lg font-semibold tracking-tight mt-4" {...props} />
  ),
  h6: ({ node, ...props }) => (
    <h6 className="text-base font-semibold tracking-tight mt-3" {...props} />
  ),

  // Text with math processing and RTL support
  p: ({ node, children, ...props }) => {
    // Process text content to detect and convert image URLs and math
    const processedChildren = React.Children.map(children, (child) => {
      if (typeof child === 'string') {
        let processed = processTextForImages(child);
        return processTextForMath(processed);
      }
      return child;
    });
    
    // Check if content contains Arabic text
    const textContent = React.Children.toArray(children).join('');
    const hasArabic = detectArabic(textContent);
    
    return (
      <p 
        className={`leading-7 [&:not(:first-child)]:mt-6 ${hasArabic ? 'text-right' : ''}`}
        dir={hasArabic ? 'rtl' : 'ltr'}
        style={hasArabic ? { direction: 'rtl', textAlign: 'right', unicodeBidi: 'embed' } : {}}
        {...props}
      >
        {processedChildren}
      </p>
    );
  },
  strong: ({ node, ...props }) => <strong className="font-semibold" {...props} />,
  em: ({ node, ...props }) => <em className="italic" {...props} />,
  hr: () => <hr className="my-6 border-muted" />,

  // Lists with math processing
  ul: ({ node, ...props }) => (
    <ul className="my-6 ml-6 list-disc [&>li]:mt-2" {...props} />
  ),
  ol: ({ node, ...props }) => (
    <ol className="my-6 ml-decimal [&>li]:mt-2" {...props} />
  ),
  li: ({ node, ordered, children, ...props }) => {
    // Process list items for image URLs and math
    const processedChildren = React.Children.map(children, (child) => {
      if (typeof child === 'string') {
        let processed = processTextForImages(child);
        return processTextForMath(processed);
      }
      return child;
    });
    
    // Check if content contains Arabic text
    const textContent = React.Children.toArray(children).join('');
    const hasArabic = detectArabic(textContent);
    
    return (
      <li 
        className={hasArabic ? 'text-right' : ''}
        dir={hasArabic ? 'rtl' : 'ltr'}
        style={hasArabic ? { direction: 'rtl', textAlign: 'right', unicodeBidi: 'embed' } : {}}
        {...props}
      >
        {processedChildren}
      </li>
    );
  },

  // Blockquote with math processing and RTL support
  blockquote: ({ node, children, ...props }) => {
    const processedChildren = React.Children.map(children, (child) => {
      if (typeof child === 'string') {
        let processed = processTextForImages(child);
        return processTextForMath(processed);
      }
      return child;
    });
    
    // Check if content contains Arabic text
    const textContent = React.Children.toArray(children).join('');
    const hasArabic = detectArabic(textContent);
    
    return (
      <blockquote 
        className={`mt-6 border-l-2 pl-6 italic text-muted-foreground ${hasArabic ? 'text-right border-r-2 border-l-0 pr-6 pl-0' : ''}`}
        dir={hasArabic ? 'rtl' : 'ltr'}
        style={hasArabic ? { direction: 'rtl', textAlign: 'right', unicodeBidi: 'embed' } : {}}
        {...props}
      >
        {processedChildren}
      </blockquote>
    );
  },

  // Links (with video detection and image detection)
  a: ({ node, href, children, ...props }) => {
    const yt = getYouTubeEmbed(href);
    if (yt) {
      return (
        <div className="my-6 aspect-video w-full overflow-hidden rounded-lg border bg-muted">
          <iframe
            src={yt}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="YouTube embed"
          />
        </div>
      );
    }
    const vimeo = getVimeoEmbed(href);
    if (vimeo) {
      return (
        <div className="my-6 aspect-video w-full overflow-hidden rounded-lg border bg-muted">
          <iframe
            src={vimeo}
            className="h-full w-full"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            title="Vimeo embed"
          />
        </div>
      );
    }
    if (isDirectVideo(href)) {
      return (
        <div className="my-6 w-full overflow-hidden rounded-lg border bg-muted">
          <video controls className="w-full h-auto">
            <source src={href} />
          </video>
        </div>
      );
    }
    // Check if the link is an image URL
    if (isImageUrl(href)) {
      return <EnhancedImage src={href} alt={children?.toString() || ""} />;
    }
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="text-primary font-medium underline underline-offset-4 break-words"
        {...props}
      >
        {children}
      </a>
    );
  },

  // Enhanced Images with Shadcn typography styling
  img: ({ node, src, alt, ...props }) => (
    <EnhancedImage src={src} alt={alt} {...props} />
  ),

  // Code blocks and inline code
  code({ node, inline, className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || "");
    if (!inline && match) {
      return (
        <SyntaxHighlighter
          style={atomDark}
          language={match[1]}
          PreTag="div"
          className="rounded-md my-4"
          {...props}
        >
          {String(children).replace(/\n$/, "")}
        </SyntaxHighlighter>
      );
    }
    return (
      <code
        className={`bg-muted relative rounded px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold ${className || ""}`}
        {...props}
      >
        {children}
      </code>
    );
  },

  // Tables (shadcn-style)
  table: ({ node, ...props }) => (
    <div className="my-6 w-full overflow-x-auto">
      <table className="w-full text-sm" {...props} />
    </div>
  ),
  thead: ({ node, ...props }) => <thead {...props} />,
  tbody: ({ node, ...props }) => <tbody {...props} />,
  tr: ({ node, ...props }) => <tr className="even:bg-muted m-0 border-t p-0" {...props} />,
  th: ({ node, ...props }) => (
    <th className="border px-4 py-2 text-left font-bold" {...props} />
  ),
  td: ({ align, ...props }) => (
    <td
      className="border px-4 py-2 text-left"
      align={align}
      {...props}
    />
  ),
};