"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Eye, 
  X, 
  FileText, 
  Presentation, 
  Image, 
  Video, 
  BookOpen, 
  Search, 
  FileCheck,
  Download,
  Trash2,
  ChevronDown,
  FileImage,
  File,
  FileText as FileDoc,
  CheckCircle
} from "lucide-react";
import ContentPreview from "@/components/ui/content-preview";
import AssessmentPreview from "@/components/assessment-preview";
import PPTXViewer from "@/components/pptx-viewer";
import VideoPreview from "@/components/ui/video-preview";
import { CarouselWithControls } from "@/components/ui/carousel";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MarkdownStyles } from "../Markdown";

// Content type configurations - Updated to match teacher library
const contentTypes = {
  all: { label: "All", icon: FileText, color: "bg-gray-100" },
  content: { label: "Content", icon: FileText, color: "bg-blue-100" },
  'lesson plan': { label: "Lesson Plan", icon: FileText, color: "bg-blue-100" },
  slides: { label: "Slides", icon: Presentation, color: "bg-purple-100" },
  comic: { label: "Comics", icon: BookOpen, color: "bg-green-100" },
  image: { label: "Images", icon: Image, color: "bg-pink-100" },
  video: { label: "Videos", icon: Video, color: "bg-red-100" },
  assessment: { label: "Assessments", icon: FileCheck, color: "bg-yellow-100" },
  websearch: { label: "Web Search", icon: Search, color: "bg-indigo-100" }
};

// Download format configurations
const downloadFormats = {
  pdf: { label: "PDF", icon: File, extension: "pdf" },
  doc: { label: "DOC", icon: FileDoc, extension: "docx" },
  pptx: { label: "PPTX", icon: Presentation, extension: "pptx" },
  image: { label: "Image", icon: FileImage, extension: "png" }
};

export default function LibraryDialog({ 
  isOpen, 
  onClose, 
  content, 
  onDelete, 
  onDownload,
  isReviewMode = false,
  studentAnswers = {}, // Add student answers prop
  evaluationResults = {} // Add evaluation results prop
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  

  // Make sure the component always returns a consistent structure
  if (!content) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[80vw] md:max-w-[1024px] max-h-[90vh] p-2 overflow-y-auto">
          <DialogHeader className="p-6 pb-4 border-b flex-shrink-0">
            <DialogTitle>Content Preview</DialogTitle>
            <DialogDescription>No content available</DialogDescription>
          </DialogHeader>
          <div className="p-6 text-center text-muted-foreground">
            <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
            <p>No content available to preview</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const getContentIcon = (type) => {
    const IconComponent = contentTypes[type]?.icon || FileText;
    return <IconComponent className="h-4 w-4" />;
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(content._id, content.type);
    }
    setShowDeleteConfirm(false);
    onClose();
  };

  const handleDownload = (format = 'pdf') => {
    if (onDownload) {
      onDownload(content, format);
    }
  };

  const getAvailableFormats = (contentType) => {
    switch (contentType) {
      case 'comic':
      case 'image':
        return ['pdf', 'doc', 'pptx', 'image'];
      case 'content':
      case 'assessment':
        return ['pdf', 'doc'];
      case 'slides':
        return ['pptx']; // Only PPTX for slides
      case 'video':
        return ['pdf']; // Video metadata as PDF
      case 'websearch':
        return ['pdf', 'doc'];
      default:
        return ['pdf'];
    }
  };

  const renderDownloadButton = () => {
    const availableFormats = getAvailableFormats(content.type);
    
    if (availableFormats.length === 1) {
      const format = availableFormats[0];
      const formatConfig = downloadFormats[format];
      const IconComponent = formatConfig.icon;
      
      return (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleDownload(format)}
          className="h-8 px-3"
        >
          <IconComponent className="h-4 w-4 mr-1" />
          Download {formatConfig.label}
        </Button>
      );
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3"
          >
            <Download className="h-4 w-4 mr-1" />
            Download
            <ChevronDown className="h-3 w-3 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {availableFormats.map((format) => {
            const formatConfig = downloadFormats[format];
            const IconComponent = formatConfig.icon;
            
            return (
              <DropdownMenuItem
                key={format}
                onClick={() => handleDownload(format)}
                className="cursor-pointer"
              >
                <IconComponent className="h-4 w-4 mr-2" />
                Download as {formatConfig.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const renderContentPreview = () => {
    // Use both type and resourceType for compatibility with both teacher and student libraries
    const contentType = content?.type || content?.resourceType;
    
    // If no content type is found, try to render as content
    if (!contentType) {
      return (
        <div className="h-full overflow-hidden">
          <ContentPreview
            content={content?.content || content?.generatedContent || content?.instruction || content?.topic || ''}
            metadata={content}
            contentType="content"
            isEditable={false}
          />
        </div>
      );
    }
    
    switch (contentType) {
      case 'content':
      case 'lesson plan':
        return (
          <div className="h-full overflow-hidden">
            <ContentPreview
              content={content.content || content.generatedContent}
              metadata={content}
              contentType="content"
              isEditable={false}
            />
          </div>
        );
      
      case 'assessment':
        const assessmentData = {
          ...content,
          content: content.content || content.generatedContent || content.assessmentContent || content.instruction || '',
          assessmentContent: content.assessmentContent || content.content || content.generatedContent || content.instruction || ''
        };
        
        
        return (
          <div className="h-full overflow-hidden">
            <AssessmentPreview
              assessment={assessmentData}
              isEditable={false}
              isReviewMode={isReviewMode}
              studentAnswers={studentAnswers}
              evaluationResults={evaluationResults}
            />
          </div>
        );
      
      case 'worksheet':
      case 'quiz':
        // Check if this worksheet/quiz has assessment content and should be rendered as assessment
        const worksheetQuizContent = content.content || content.generatedContent || content.assessmentContent || content.instruction || '';
        
        // If it has assessment content and we're in review mode with student answers, treat as assessment
        if (isReviewMode && studentAnswers && Object.keys(studentAnswers).length > 0 && 
            (worksheetQuizContent.includes('**Questions**') || worksheetQuizContent.includes('**Solutions**') || 
             worksheetQuizContent.includes('Question') || worksheetQuizContent.includes('Answer'))) {
          
          
          const assessmentData = {
            ...content,
            content: worksheetQuizContent,
            assessmentContent: worksheetQuizContent
          };
          
          return (
            <div className="h-full overflow-hidden">
              <AssessmentPreview
                assessment={assessmentData}
                isEditable={false}
                isReviewMode={isReviewMode}
                studentAnswers={studentAnswers}
                evaluationResults={evaluationResults}
              />
            </div>
          );
        }
        
        // Otherwise render as traditional content
        return (
          <div className="h-full overflow-hidden">
            <div className="h-full overflow-auto p-4">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownStyles}>
                  {worksheetQuizContent}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        );
      
      case 'slides':
        return (
          <div className="h-full overflow-hidden">
            <PPTXViewer
              presentationUrl={content.presentationUrl}
              title={content.title}
              slideCount={content.slideCount}
              status="completed"
              isEditable={false}
            />
          </div>
        );
      
      case 'video':
        return (
          <div className="h-full overflow-hidden">
            <VideoPreview
              videoUrl={content.videoUrl}
              title={content.title}
              slidesCount={content.slidesCount}
              status="completed"
              voiceName={content.voiceName}
              avatarName={content.talkingPhotoName}
              videoId={content.videoId}
              isEditable={false}
            />
          </div>
        );
      
      case 'comic':
        // Enhanced comic image extraction with better error handling
        let comicImages = [];
        let comicTexts = [];
        
        // Extract comic texts from panelTexts array
        if (content.panelTexts && Array.isArray(content.panelTexts) && content.panelTexts.length > 0) {
          comicTexts = content.panelTexts.map((panelText, index) => {
            // Handle both string and object formats
            if (typeof panelText === 'string') {
              return panelText;
            } else if (panelText && panelText.text) {
              return panelText.text;
            } else if (panelText && panelText.content) {
              return panelText.content;
            } else if (panelText && panelText.description) {
              return panelText.description;
            }
            return `Panel ${index + 1} text not available`;
          });
        }
        
        // Priority order for comic images with better validation:
        // 1. Check for panels with imageUrl or imageBase64
        if (content.panels && Array.isArray(content.panels) && content.panels.length > 0) {
          comicImages = content.panels
            .map((panel, index) => {
              if (panel && panel.imageUrl) {
                return panel.imageUrl;
              }
              if (panel && panel.imageBase64) {
                return `data:image/png;base64,${panel.imageBase64}`;
              }
              return null;
            })
            .filter(Boolean);
        }
        
        // 2. Check for imageUrls array (Cloudinary URLs)
        if (comicImages.length === 0 && content.imageUrls && Array.isArray(content.imageUrls) && content.imageUrls.length > 0) {
          comicImages = content.imageUrls.filter(Boolean);
        }
        
        // 3. Check for images array
        if (comicImages.length === 0 && content.images && Array.isArray(content.images) && content.images.length > 0) {
          comicImages = content.images.filter(Boolean);
        }
        
        // 4. Check for cloudinary public IDs and construct URLs
        if (comicImages.length === 0 && content.cloudinaryPublicIds && Array.isArray(content.cloudinaryPublicIds) && content.cloudinaryPublicIds.length > 0) {
          comicImages = content.cloudinaryPublicIds
            .filter(Boolean)
            .map(id => {
              // Handle both full URLs and just public IDs
              if (id.startsWith('http')) {
                return id;
              }
              // Try different Cloudinary URL formats
              return `https://res.cloudinary.com/demo/image/upload/${id}`;
            });
        }
        
        // 5. Check if content itself contains base64 image data
        if (comicImages.length === 0 && content.content && typeof content.content === 'string' && content.content.includes('data:image')) {
          const base64Matches = content.content.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g);
          if (base64Matches) {
            comicImages = base64Matches;
          }
        }
        
        // 6. Check for single imageUrl field
        if (comicImages.length === 0 && content.imageUrl) {
          comicImages = [content.imageUrl];
        }
        
        return (
          <div className="h-full flex flex-col">
            <div className="text-center mb-4 flex-shrink-0">
              <h3 className="text-lg font-semibold">{content.title}</h3>
              <p className="text-sm text-muted-foreground">{content.topic || content.instruction || content.description}</p>
              {content.numPanels && (
                <p className="text-xs text-muted-foreground mt-1">
                  {content.numPanels} panel{content.numPanels !== 1 ? 's' : ''}
                </p>
              )}
              {content.comicType && (
                <Badge variant="outline" className="mt-2">
                  {content.comicType}
                </Badge>
              )}
            </div>
            <div className="flex-1 min-h-0">
              {comicImages.length > 0 ? (
                <div className="h-full">
                  <CarouselWithControls
                    items={comicImages.map((url, i) => ({ 
                      url, 
                      index: i + 1,
                      text: comicTexts[i] || `Panel ${i + 1} text not available`
                    }))}
                    className="h-full"
                    renderItem={(p) => (
                      <div className="rounded-lg border overflow-hidden bg-gradient-to-br from-background to-muted/10 flex flex-col h-full">
                        {/* Panel Image */}
                        <div className="flex-1 flex items-center justify-center p-4 min-h-0">
                          <img 
                            src={p.url} 
                            alt={`Panel ${p.index}`} 
                            className="max-h-full max-w-full object-contain rounded-lg shadow-sm" 
                            loading="lazy"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              const fallbackDiv = document.createElement('div');
                              fallbackDiv.className = 'text-center py-8 text-foreground';
                              fallbackDiv.innerHTML = `
                                <div>
                                  <svg class="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                  </svg>
                                  <p class="text-sm">Panel ${p.index} failed to load</p>
                                </div>
                              `;
                              e.target.parentNode.appendChild(fallbackDiv);
                            }}
                          />
                        </div>
                        
                        {/* Panel Text */}
                        <div className="bg-muted/50 border-t p-4 flex-shrink-0">
                          <div className="text-center mb-3">
                            <Badge variant="secondary" className="text-sm px-3 py-1">
                              Panel {p.index}
                            </Badge>
                          </div>
                          <p className="text-base text-foreground leading-relaxed text-center">
                            {p.text}
                          </p>
                        </div>
                      </div>
                    )}
                  />
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground h-full flex items-center justify-center">
                  <div className="max-w-md">
                    <BookOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                    <p className="text-sm font-medium">No comic panels available</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      This comic content may not have been generated yet or the images are not accessible.
                    </p>
                    
                    {/* Show comic metadata for debugging */}
                    <div className="mt-4 p-3 bg-muted/50 rounded-lg text-left text-xs">
                      <p className="font-medium text-muted-foreground mb-2">Comic Details:</p>
                      <div className="space-y-1">
                        <p><span className="font-medium">Title:</span> {content.title || 'N/A'}</p>
                        <p><span className="font-medium">Panels:</span> {content.numPanels || 0}</p>
                        <p><span className="font-medium">Type:</span> {content.comicType || 'N/A'}</p>
                        <p><span className="font-medium">Has panels array:</span> {content.panels ? 'Yes' : 'No'}</p>
                        <p><span className="font-medium">Has imageUrls:</span> {content.imageUrls ? 'Yes' : 'No'}</p>
                        <p><span className="font-medium">Has cloudinaryPublicIds:</span> {content.cloudinaryPublicIds ? 'Yes' : 'No'}</p>
                        <p><span className="font-medium">Has panelTexts:</span> {content.panelTexts ? 'Yes' : 'No'}</p>
                        <p><span className="font-medium">PanelTexts count:</span> {content.panelTexts ? content.panelTexts.length : 0}</p>
                      </div>
                    </div>
                    
                    {content.instruction && (
                      <div className="mt-4 p-3 bg-muted/50 rounded-lg text-left">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Instructions:</p>
                        <p className="text-xs text-muted-foreground">{content.instruction}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      
      case 'image':
        return (
          <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0 flex items-center justify-center">
              <div className="relative max-w-full max-h-full">
                {content.imageUrl ? (
                  <img 
                    src={content.imageUrl} 
                    alt={content.title}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
                    loading="lazy"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      const fallbackDiv = document.createElement('div');
                      fallbackDiv.className = 'text-center py-8 text-foreground';
                      fallbackDiv.innerHTML = `
                        <div>
                          <svg class="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                          </svg>
                          <p class="text-sm">Image failed to load</p>
                        </div>
                      `;
                      e.target.parentNode.appendChild(fallbackDiv);
                    }}
                  />
                ) : content.imageBase64 ? (
                  <img 
                    src={`data:image/png;base64,${content.imageBase64}`} 
                    alt={content.title}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
                    loading="lazy"
                  />
                ) : (
                  <div className="text-center py-8 text-foreground">
                    <Image className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                    <p className="text-sm">No image data available</p>
                  </div>
                )}
              </div>
            </div>
            {content.instructions && (
              <div className="p-4 bg-muted/50 border-t">
                <p className="text-sm text-muted-foreground">{content.instructions}</p>
              </div>
            )}
          </div>
        );
      
      case 'websearch':
        return (
          <div className="h-full flex flex-col">
            <div className="text-center mb-4 flex-shrink-0">
              <h3 className="text-lg font-semibold">{content.title}</h3>
              <p className="text-sm text-muted-foreground">{content.topic}</p>
            </div>
            <div className="flex-1 min-h-0 overflow-auto">
              <div className="prose prose-sm dark:prose-invert max-w-none pr-4">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownStyles}>
                  {content.searchResults || content.content || ''}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        );
      
      default:
        // For any unrecognized content type, try to render as content
        return (
          <div className="h-full overflow-hidden">
            <ContentPreview
              content={content?.content || content?.generatedContent || content?.instruction || content?.topic || ''}
              metadata={content}
              contentType="content"
              isEditable={false}
            />
          </div>
        );
    }
  };

  const renderMetadata = () => {
    return (
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-3">{content.title}</h3>
        <div className="grid grid-cols-2 gap-4">
          {content.topic && (
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-muted-foreground">Topic:</span>
              <span className="text-sm">{content.topic}</span>
            </div>
          )}
          {content.subject && (
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-muted-foreground">Subject:</span>
              <span className="text-sm">{content.subject}</span>
            </div>
          )}
          {content.grade && (
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-muted-foreground">Grade:</span>
              <span className="text-sm">{content.grade}</span>
            </div>
          )}
          {content.createdAt && (
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-muted-foreground">Date:</span>
              <span className="text-sm">
                {content.createdAt ? new Date(content.createdAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric"
                }) : 'Unknown'}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[80vw] md:max-w-[1024px] max-h-[90vh] p-2 overflow-y-auto">
          <DialogHeader className="p-6 pb-4 border-b flex-shrink-0">
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-green-600" />
                {isReviewMode ? 'Content Review' : 'Content Preview'}
                <Badge variant="outline" className="ml-2">
                  {contentTypes[content?.type || content?.resourceType]?.label || (content?.type || content?.resourceType || 'Unknown')}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                {isReviewMode && (
                  <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Completed
                  </Badge>
                )}
              </div>
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {isReviewMode 
                ? 'Review your completed content. You can view your work but cannot resubmit it.'
                : 'Preview and interact with the learning content.'
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 min-h-0 p-6">
            <div className="h-full flex flex-col">
              {renderMetadata()}
              {isReviewMode && (
                <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">This content has been completed</span>
                  </div>
                  <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                    You can review your work but cannot resubmit it.
                  </p>
                </div>
              )}
              <div className="flex-1 min-h-0">
                {renderContentPreview()}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog - only show if not in review mode */}
      {!isReviewMode && (
        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base">Delete Content</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to delete "{content.title}"? This action cannot be undone.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </Button>
              <Button variant="destructive" size="sm" onClick={handleDelete}>
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
