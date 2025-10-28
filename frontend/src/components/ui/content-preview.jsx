"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import { MarkdownStyles } from "@/components/Markdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, Copy, Check, Edit, Save, X, ExternalLink, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import 'katex/dist/katex.min.css';
import { generateDOCX, generateMarkdown } from "@/lib/pdf-utils";
import VideoPreview from "@/components/ui/video-preview";

export default function ContentPreview({
  content,
  metadata,
  contentType,
  onGenerateSlides,
  isGeneratingSlides,
  onEditContent, 
  isEditable = true 
}) {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState('docx');
  const [isDownloading, setIsDownloading] = useState(false);

  // Handle different content structures
  const getContentData = () => {
    // If content is a string, use it directly
    if (typeof content === 'string') {
      return {
        content: content,
        metadata: metadata || {},
        contentType: contentType || metadata?.contentType || 'content',
        language: metadata?.language || 'English',
        topic: metadata?.topic || metadata?.title || 'Unknown'
      };
    }

    // If content is an object, extract the appropriate field
    if (typeof content === 'object' && content !== null) {
      const contentText = content.generatedContent || 
                         content.content || 
                         content.instruction || 
                         content.topic || 
                         content.title || 
                         '';
      
      return {
        content: contentText,
        metadata: metadata || content || {},
        contentType: contentType || content.resourceType || content.type || metadata?.contentType || 'content',
        language: metadata?.language || content.language || 'English',
        topic: metadata?.topic || content.topic || content.title || 'Unknown'
      };
    }
    
    // Fallback for web-search
    if (contentType === 'web-search') {
      return {
        content: content?.searchQuery || '',
        metadata: content?.metadata || {},
        contentType: content?.contentType || 'web-search',
        language: content?.language || 'English',
        topic: content?.topic || 'Unknown'
      };
    }
    
    // Default fallback
    return {
      content: content || '',
      metadata: metadata || {},
      contentType: contentType || 'content',
      language: 'English',
      topic: 'Unknown'
    };
  };

  const contentData = getContentData();

  // Handle video content type - use VideoPreview component
  if (contentData.contentType === 'video' || contentType === 'video') {
    return (
      <VideoPreview
        videoUrl={content?.videoUrl || content?.url || metadata?.videoUrl}
        title={content?.title || metadata?.title || contentData.topic}
        slidesCount={content?.slidesCount || metadata?.slidesCount}
        status="completed"
        voiceName={content?.voiceName || metadata?.voiceName}
        avatarName={content?.talkingPhotoName || metadata?.talkingPhotoName}
        videoId={content?.videoId || metadata?.videoId}
        isEditable={false}
      />
    );
  }

  // Check if content contains video URLs (for cases where video content comes as text)
  const hasVideoUrl = content?.videoUrl || content?.url || metadata?.videoUrl;
  if (hasVideoUrl && (contentData.contentType === 'content' || !contentData.contentType)) {
    return (
      <VideoPreview
        videoUrl={hasVideoUrl}
        title={content?.title || metadata?.title || contentData.topic}
        slidesCount={content?.slidesCount || metadata?.slidesCount}
        status="completed"
        voiceName={content?.voiceName || metadata?.voiceName}
        avatarName={content?.talkingPhotoName || metadata?.talkingPhotoName}
        videoId={content?.videoId || metadata?.videoId}
        isEditable={false}
      />
    );
  }

  // Helper function to detect if content contains HTML tags
  const containsHtml = (text) => {
    if (typeof text !== 'string') return false;
    return /<[^>]*>/g.test(text);
  };

  // Helper function to process content for proper rendering
  const processContent = (content) => {
    if (!content) return content;
    
    let processedContent = content;
    
    // Debug logging (temporary)
    console.log('🔍 processContent - Raw content:', processedContent.substring(0, 200) + '...');
    console.log('🔍 processContent - Contains HTML:', containsHtml(processedContent));
    
    // CLEANUP: Remove rogue "[object Object]" strings from previous render errors
    processedContent = processedContent.replace(/\[object Object\]/g, '');

    // Handle LaTeX fractions for Arabic content
    if (/[\u0600-\u06FF\u0750-\u077F]/.test(processedContent)) {
      console.log('🧹 processContent - Processing Arabic LaTeX fractions...');
      
      // Convert \frac{numerator}{denominator} to numerator/denominator
      processedContent = processedContent.replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, (match, numerator, denominator) => {
        return `${numerator}/${denominator}`;
      });
      
      // Remove other LaTeX commands
      processedContent = processedContent.replace(/\\[a-zA-Z]+/g, '');
      
      // Remove curly braces
      processedContent = processedContent.replace(/[{}]/g, '');
      
      // Remove dollar signs
      processedContent = processedContent.replace(/\$\$?([^$]+)\$\$?/g, '$1');
    }

    // Handle HTML tags for RTL/LTR support - but prefer pure Markdown
    if (containsHtml(processedContent)) {
      console.log('🧹 processContent - Removing HTML tags...');
      
      // Remove HTML wrapper tags more aggressively
      processedContent = processedContent
        .replace(/<div dir="rtl">\s*/gi, '')
        .replace(/<div dir="ltr">\s*/gi, '')
        .replace(/<\/div>\s*/gi, '')
        .replace(/<div[^>]*>\s*/gi, '')
        .replace(/<\/div>\s*/gi, '');
      
      // Clean up excessive blank lines (more than 2 consecutive newlines)
      processedContent = processedContent.replace(/\n{3,}/g, '\n\n');
      
      // Trim leading/trailing whitespace
      processedContent = processedContent.trim();
      
      console.log('✅ processContent - After cleanup:', processedContent.substring(0, 200) + '...');
    }
    
    return processedContent;
  };

  const handleCopyContent = async () => {
    try {
      // For copying, we want the raw content without LaTeX processing
      await navigator.clipboard.writeText(contentData.content);
      setCopied(true);
      toast.success("Content copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy content");
    }
  };

  const handleDownloadContent = async () => {
    if (!downloadFormat) {
      toast.error("Please select a download format");
      return;
    }

    setIsDownloading(true);
    const filename = metadata?.topic || 'content';
    const contentData = {
      content: editedContent || content, // Use raw content for download
      metadata: metadata || {}
    };

    const options = {
      title: metadata?.topic || 'Content',
      subject: metadata?.subject || '',
      grade: metadata?.grade || '',
      language: metadata?.language || 'english'
    };

    try {
      switch (downloadFormat) {
        case 'md':
          generateMarkdown(contentData.content, filename);
          break;
          
        case 'docx':
          await generateDOCX(contentData.content, filename, options);
          break;
          
        default:
          throw new Error('Unsupported format');
      }
      
      toast.success(`${downloadFormat.toUpperCase()} downloaded successfully!`);
    } catch (error) {
      console.error('Download failed:', error);
      toast.error(`Download failed: ${error.message}`);
    } finally {
      setIsDownloading(false);
      setShowDownloadDialog(false);
    }
  };

  const handleStartEdit = () => {
    setEditedContent(contentData.content);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditedContent(contentData.content);
    setIsEditing(false);
    toast.info("Edit cancelled");
  };

  const handleSaveEdit = () => {
    if (onEditContent) {
      onEditContent(editedContent);
      setIsEditing(false);
      toast.success("Content updated!");
    }
  };

  // Render web search specific content
  const renderWebSearchContent = () => {
    if (contentType !== 'web-search') return null;

    return (
      <div className="space-y-6">
        {/* Search Query */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-semibold text-blue-900 mb-2">Search Query:</h4>
          <p className="text-blue-800 text-sm">{content.searchQuery}</p>
        </div>

        {/* Search Results */}
        <div>
          <h4 className="font-semibold text-gray-900 mb-3">
            Search Results ({content.searchResults?.length || 0} found):
          </h4>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {content.searchResults?.map((result, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h5 className="font-medium text-gray-900 text-sm mb-1 line-clamp-1">
                      {result.title}
                    </h5>
                    <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                      {result.snippet}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span><strong>Source:</strong> {result.source}</span>
                      <span><strong>Relevance:</strong> {(result.relevanceScore * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                  {result.url !== '#' && (
                    <a
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <style jsx>{`
        .katex-error {
          color: #ef4444;
          background-color: #fef2f2;
          padding: 2px 4px;
          border-radius: 4px;
          font-family: monospace;
          font-size: 0.875rem;
        }
        .katex-block {
          margin: 1rem 0;
          text-align: center;
        }
        .katex-inline {
          display: inline;
        }
      `}</style>
      <Card className="w-full dark:bg-secondary">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center gap-2">
                {contentType === 'web-search' ? (
                  <ExternalLink className="h-5 w-5" />
                ) : (
                  <FileText className="h-5 w-5" />
                )}
                {contentType === 'web-search' ? 'Web Search Results' : 'Generated Content'}
              </CardTitle>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="outline">{contentData.contentType}</Badge>
                <Badge variant="secondary">{contentData.language}</Badge>
                {contentData.metadata.instructionDepth && (
                  <Badge variant="outline">{contentData.metadata.instructionDepth}</Badge>
                )}
                {contentData.metadata.contentVersion && (
                  <Badge variant="outline">{contentData.metadata.contentVersion}</Badge>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelEdit}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleSaveEdit}
                  >
                    <Save className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  {isEditable && contentType !== 'web-search' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleStartEdit}
                      title="Edit Content"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyContent}
                    disabled={copied}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDownloadDialog(true)}
                    className="flex items-center gap-1"
                    disabled={!contentData.content || contentData.content.trim() === ''}
                  >
                    <Download className="h-4 w-4" />
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                  {contentData.metadata.contentType === "presentation" && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => onGenerateSlides(contentData.metadata)}
                      disabled={isGeneratingSlides}
                    >
                      {isGeneratingSlides ? "Generating..." : "Generate Slides"}
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {contentType === 'web-search' ? (
            renderWebSearchContent()
          ) : isEditing ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="contentEditor">Edit Content</Label>
                <Textarea
                  id="contentEditor"
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  rows={20}
                  className="font-mono text-sm"
                  placeholder="Edit your content here..."
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={handleCancelEdit}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveEdit}
                  className="min-w-[100px]"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            </div>
          ) : (
            <ScrollArea className="h-[600px] w-full">
              <div className="prose prose-gray max-w-none markdown-content">
                {contentData.content ? (
                  <div 
                    dir={/[\u0600-\u06FF\u0750-\u077F]/.test(contentData.content) ? 'rtl' : 'ltr'}
                    style={/[\u0600-\u06FF\u0750-\u077F]/.test(contentData.content) ? { 
                      direction: 'rtl', 
                      textAlign: 'right', 
                      unicodeBidi: 'embed',
                      fontFamily: 'Arial, sans-serif',
                      fontSize: '16px',
                      lineHeight: '1.6'
                    } : {
                      fontFamily: 'Arial, sans-serif',
                      fontSize: '16px',
                      lineHeight: '1.6'
                    }}
                  >
                    <ReactMarkdown
                      remarkPlugins={/[\u0600-\u06FF\u0750-\u077F]/.test(contentData.content) ? [remarkGfm] : [remarkGfm, remarkMath]}
                      rehypePlugins={/[\u0600-\u06FF\u0750-\u077F]/.test(contentData.content) ? [rehypeRaw] : [rehypeKatex, rehypeRaw]}
                      components={MarkdownStyles}
                    >
                      {processContent(contentData.content)}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                    <p className="text-sm">No content available</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Download Format Selection Dialog */}
      <Dialog open={showDownloadDialog} onOpenChange={setShowDownloadDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Download Content</DialogTitle>
            <DialogDescription>
              Choose the format for downloading your content.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="format">Download Format</Label>
              <Select value={downloadFormat} onValueChange={setDownloadFormat}>
                <SelectTrigger>
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="md">Markdown (.md)</SelectItem>
                  <SelectItem value="docx">Word Document (.docx)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm text-muted-foreground">
              <p><strong>Markdown:</strong> Plain text with formatting markers</p>
              <p><strong>Word:</strong> Editable document with formatting</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDownloadDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleDownloadContent} 
              disabled={isDownloading || !downloadFormat || !contentData.content}
            >
              {isDownloading ? "Downloading..." : "Download"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}