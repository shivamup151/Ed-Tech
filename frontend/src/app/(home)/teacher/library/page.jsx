"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  FileText, 
  Presentation, 
  Image as ImageIcon, 
  Video, 
  BookOpen, 
  Search, 
  FileCheck,
  Calendar,
  Eye,
  Download,
  Trash2,
  Search as SearchIcon,
  BookmarkPlus,
  Loader2,
  ChevronDown
} from "lucide-react";
import { toast } from "sonner";
import { getAllLibraryContent, deleteLibraryContent, addContentToLesson, getCurriculumData } from "./action";
import { authClient } from "@/lib/auth-client";
import LibraryDialog from "@/components/ui/library-dialog";
import LibraryLoading from "./loading";

// Dynamic imports for PDF and DOC generation
const generatePDF = async (content, filename) => {
  const { jsPDF } = await import('jspdf');
  
  const doc = new jsPDF();
  const pageHeight = doc.internal.pageSize.height;
  const pageWidth = doc.internal.pageSize.width;
  const margin = 20;
  const lineHeight = 7;
  const maxLineWidth = pageWidth - (margin * 2);
  
  // Convert markdown to plain text for PDF
  const plainText = content
    .replace(/#{1,6}\s/g, '') // Remove headers
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
    .replace(/\*(.*?)\*/g, '$1') // Remove italic
    .replace(/`(.*?)`/g, '$1') // Remove code
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links
    .replace(/^\s*[-*+]\s/gm, '• '); // Convert lists to bullets
  
  const lines = doc.splitTextToSize(plainText, maxLineWidth);
  let currentY = margin;
  
  doc.setFontSize(12);
  
  for (let i = 0; i < lines.length; i++) {
    if (currentY + lineHeight > pageHeight - margin) {
      doc.addPage();
      currentY = margin;
    }
    
    doc.text(lines[i], margin, currentY);
    currentY += lineHeight;
  }
  
  doc.save(`${filename}.pdf`);
};

const generateDOCX = async (content, filename) => {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');
  
  // Parse markdown content into structured elements
  const lines = content.split('\n');
  const docElements = [];
  
  for (const line of lines) {
    if (!line.trim()) {
      docElements.push(new Paragraph({ text: "" }));
      continue;
    }
    
    // Handle headers
    if (line.startsWith('# ')) {
      docElements.push(new Paragraph({
        text: line.replace('# ', ''),
        heading: HeadingLevel.HEADING_1
      }));
    } else if (line.startsWith('## ')) {
      docElements.push(new Paragraph({
        text: line.replace('## ', ''),
        heading: HeadingLevel.HEADING_2
      }));
    } else if (line.startsWith('### ')) {
      docElements.push(new Paragraph({
        text: line.replace('### ', ''),
        heading: HeadingLevel.HEADING_3
      }));
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      // Handle bullet points
      docElements.push(new Paragraph({
        text: line.replace(/^[-*]\s/, ''),
        bullet: { level: 0 }
      }));
    } else {
      // Handle regular text with basic formatting
      const textRuns = [];
      let currentText = line;
      
      // Handle bold text
      currentText = currentText.replace(/\*\*(.*?)\*\*/g, (match, text) => {
        textRuns.push(new TextRun({ text, bold: true }));
        return '\u0000'; // Placeholder
      });
      
      // Handle italic text
      currentText = currentText.replace(/\*(.*?)\*/g, (match, text) => {
        textRuns.push(new TextRun({ text, italics: true }));
        return '\u0000'; // Placeholder
      });
      
      // Split by placeholders and add regular text
      const parts = currentText.split('\u0000');
      const finalRuns = [];
      
      for (let i = 0; i < parts.length; i++) {
        if (parts[i]) {
          finalRuns.push(new TextRun({ text: parts[i] }));
        }
        if (i < textRuns.length) {
          finalRuns.push(textRuns[i]);
        }
      }
      
      docElements.push(new Paragraph({
        children: finalRuns.length > 0 ? finalRuns : [new TextRun({ text: line })]
      }));
    }
  }
  
  const doc = new Document({
    sections: [{
      properties: {},
      children: docElements
    }]
  });
  
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Content type configurations with placeholder images
const contentTypes = {
  all: { 
    label: "All", 
    icon: FileText, 
    color: "bg-gray-100",
    placeholderImage: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&h=300&fit=crop&crop=center"
  },
  content: { 
    label: "Content", 
    icon: FileText, 
    color: "bg-blue-100",
    placeholderImage: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400&h=300&fit=crop&crop=center"
  },
  slides: { 
    label: "Slides", 
    icon: Presentation, 
    color: "bg-purple-100",
    placeholderImage: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=300&fit=crop&crop=center"
  },
  comic: { 
    label: "Comics", 
    icon: BookOpen, 
    color: "bg-green-100",
    placeholderImage: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop&crop=center"
  },
  image: { 
    label: "Images", 
    icon: ImageIcon, 
    color: "bg-pink-100",
    placeholderImage: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=300&fit=crop&crop=center"
  },
  video: { 
    label: "Videos", 
    icon: Video, 
    color: "bg-red-100",
    placeholderImage: "https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=400&h=300&fit=crop&crop=center"
  },
  assessment: { 
    label: "Assessments", 
    icon: FileCheck, 
    color: "bg-yellow-100",
    placeholderImage: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400&h=300&fit=crop&crop=center"
  },
  websearch: { 
    label: "Web Search", 
    icon: Search, 
    color: "bg-indigo-100",
    placeholderImage: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=300&fit=crop&crop=center"
  }
};

export default function LibraryPage() {
  const [user, setUser] = useState(null);
  const [content, setContent] = useState([]);
  const [filteredContent, setFilteredContent] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [previewDialog, setPreviewDialog] = useState({ open: false, item: null });
  
  // Add lesson-related state
  const [addToLessonDialog, setAddToLessonDialog] = useState(false);
  const [selectedContentForLesson, setSelectedContentForLesson] = useState(null);
  const [isAddingToLesson, setIsAddingToLesson] = useState(false);
  const [lessonFormData, setLessonFormData] = useState({
    title: '',
    lessonDescription: '',
    learningObjectives: '',
    grade: '',
    isPublic: false
  });

  // NEW: Curriculum data state
  const [curriculumData, setCurriculumData] = useState({
    gradeSubjectPairs: [],
    grades: [],
    subjects: []
  });
  const [loadingCurriculum, setLoadingCurriculum] = useState(true);

  // Download dialog state
  const [downloadDialog, setDownloadDialog] = useState({ open: false, item: null });
  const [downloadFormat, setDownloadFormat] = useState('pdf');
  const [isDownloading, setIsDownloading] = useState(false);

  // Get user session
  useEffect(() => {
    const getUser = async () => {
      try {
        const { data } = await authClient.getSession();
        setUser(data?.user || null);
      } catch (error) {
        console.error("Error fetching user:", error);
      }
    };
    getUser();
  }, []);

  // Load library content and curriculum data
  useEffect(() => {
    if (user?.id) {
      loadLibraryContent();
      loadCurriculumData();
    }
  }, [user?.id]);

  // Load curriculum data
  const loadCurriculumData = async () => {
    try {
      setLoadingCurriculum(true);
      const result = await getCurriculumData();
      if (result.success) {
        setCurriculumData({
          gradeSubjectPairs: result.gradeSubjectPairs || [],
          grades: result.grades || [],
          subjects: result.subjects || []
        });
      } else {
        console.error("Failed to load curriculum data:", result.error);
        toast.error("Failed to load curriculum data");
      }
    } catch (error) {
      console.error("Error loading curriculum data:", error);
      toast.error("Failed to load curriculum data");
    } finally {
      setLoadingCurriculum(false);
    }
  };

  // Filter content based on search and active tab
  useEffect(() => {
    let filtered = content;

    // Filter by tab
    if (activeTab !== "all") {
      filtered = filtered.filter(item => item.type === activeTab);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.title?.toLowerCase().includes(query) ||
        item.instruction?.toLowerCase().includes(query) ||
        item.topic?.toLowerCase().includes(query) ||
        item.subject?.toLowerCase().includes(query) ||
        item.grade?.toLowerCase().includes(query)
      );
    }

    setFilteredContent(filtered);
  }, [content, activeTab, searchQuery]);

  const loadLibraryContent = async () => {
    setLoading(true);
    try {
      const result = await getAllLibraryContent();
      if (result.success) {
        setContent(result.content);
        setCounts(result.counts);
      } else {
        toast.error(result.error || "Failed to load library content");
      }
    } catch (error) {
      console.error("Error loading library content:", error);
      toast.error("Failed to load library content");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (contentId, contentType) => {
    try {
      const result = await deleteLibraryContent(contentId, contentType);
      if (result.success) {
        toast.success("Content deleted successfully");
        loadLibraryContent(); // Reload content
        setPreviewDialog({ open: false, item: null });
      } else {
        toast.error(result.error || "Failed to delete content");
      }
    } catch (error) {
      console.error("Error deleting content:", error);
      toast.error("Failed to delete content");
    }
  };

  const handleDownload = async (item, format = 'pdf') => {
    if (!format) {
      toast.error("Please select a download format");
      return;
    }

    setIsDownloading(true);
    const filename = item.title || item.instruction || 'content';

    try {
      switch (item.type) {
        case 'comic':
          await handleComicDownload(item, format, filename);
          break;
        case 'image':
          await handleImageDownload(item, format, filename);
          break;
        case 'content':
        case 'assessment':
          await handleTextDownload(item, format, filename);
          break;
        case 'slides':
          await handleSlidesDownload(item, format, filename);
          break;
        default:
          toast.info("Download functionality coming soon for this content type!");
      }
      
      toast.success(`Content downloaded as ${format.toUpperCase()}!`);
      setDownloadDialog({ open: false, item: null });
    } catch (error) {
      console.error('Download failed:', error);
      toast.error(`Failed to download as ${format.toUpperCase()}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleComicDownload = async (comic, format, filename) => {
    const comicImages = comic.panels?.map(panel => panel.imageUrl || panel.imageBase64) || 
                       comic.imageUrls || 
                       comic.images || [];

    if (comicImages.length === 0) {
      throw new Error('No comic images available for download');
    }

    // Support multiple formats for comics
    switch (format) {
      case 'doc':
        await downloadComicAsDOCX(comicImages, comic, filename);
        break;
      case 'image':
        await downloadComicAsImages(comicImages, filename);
        break;
      case 'pdf':
        await downloadComicAsPDF(comicImages, comic, filename);
        break;
      default:
        throw new Error(`Format ${format} is not supported for comics. Supported formats: DOCX, PDF, Images`);
    }
  };

  const handleImageDownload = async (image, format, filename) => {
    const imageUrl = image.imageUrl || (image.imageBase64 ? `data:image/png;base64,${image.imageBase64}` : null);
    
    if (!imageUrl) {
      throw new Error('No image available for download');
    }

    switch (format) {
      case 'pdf':
        await downloadImageAsPDF(imageUrl, filename);
        break;
      case 'doc':
        await downloadImageAsDOCX(imageUrl, image, filename);
        break;
      case 'pptx':
        await downloadImageAsPPTX(imageUrl, image, filename);
        break;
      case 'image':
        await downloadImageAsImage(imageUrl, filename);
        break;
      default:
        throw new Error('Unsupported format for images');
    }
  };

  const handleTextDownload = async (item, format, filename) => {
    const content = item.generatedContent || item.content || item.description || '';
    
    if (!content) {
      throw new Error('No content available for download');
    }

    switch (format) {
      case 'pdf':
        await generatePDF(content, filename);
        break;
      case 'doc':
        await generateDOCX(content, filename);
        break;
      case 'md':
        const blob = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        break;
      default:
        throw new Error('Unsupported format for text content');
    }
  };

  const handleSlidesDownload = async (slides, format, filename) => {
    switch (format) {
      case 'pptx':
        // Try multiple possible URL fields for slides
        const downloadUrl = slides.downloadUrl || slides.presentationUrl || slides.url;
        if (downloadUrl) {
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = `${filename}.pptx`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } else {
          throw new Error('No PPTX download URL available');
        }
        break;
      default:
        throw new Error('Only PPTX format is supported for slides');
    }
  };

  // Helper functions for different download types
  const downloadComicAsPDF = async (images, comic, filename) => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    
    // Extract panel texts
    let panelTexts = [];
    if (comic.panelTexts && Array.isArray(comic.panelTexts)) {
      panelTexts = comic.panelTexts.map((panelText, index) => {
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
    } else if (comic.panels && Array.isArray(comic.panels)) {
      panelTexts = comic.panels.map((panel, index) => {
        return panel.text || panel.content || panel.description || `Panel ${index + 1} text not available`;
      });
    }
    
    // Process images sequentially to ensure all are loaded
    for (let i = 0; i < images.length; i++) {
      if (i > 0) doc.addPage();
      
      try {
        // Wait for each image to load before proceeding
        await new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          
          img.onload = () => {
            try {
              const imgWidth = doc.internal.pageSize.getWidth();
              const pageHeight = doc.internal.pageSize.getHeight();
              const margin = 20;
              const availableWidth = imgWidth - (margin * 2);
              const availableHeight = pageHeight - (margin * 2);
              
              // Calculate image dimensions to fit on page
              let imgDisplayWidth = availableWidth;
              let imgDisplayHeight = (img.height * imgDisplayWidth) / img.width;
              
              // If image is too tall, scale it down
              if (imgDisplayHeight > availableHeight * 0.7) { // Reserve 30% for text
                imgDisplayHeight = availableHeight * 0.7;
                imgDisplayWidth = (img.width * imgDisplayHeight) / img.height;
              }
              
              // Center the image
              const imgX = (imgWidth - imgDisplayWidth) / 2;
              const imgY = margin;
              
              // Add the image
              doc.addImage(img, 'JPEG', imgX, imgY, imgDisplayWidth, imgDisplayHeight);
              
              // Add panel text below the image
              const textY = imgY + imgDisplayHeight + 10;
              const panelText = panelTexts[i] || `Panel ${i + 1}`;
              
              // Set font for text
              doc.setFontSize(12);
              doc.setFont('helvetica', 'normal');
              
              // Split text into multiple lines if it's too long
              const maxWidth = availableWidth;
              const textLines = doc.splitTextToSize(panelText, maxWidth);
              
              // Add text with proper spacing
              let currentY = textY;
              for (let line of textLines) {
                if (currentY + 10 > pageHeight - margin) {
                  // If text would go beyond page, add a new page
                  doc.addPage();
                  currentY = margin;
                }
                doc.text(line, margin, currentY);
                currentY += 6; // Line height
              }
              
              resolve();
            } catch (error) {
              reject(error);
            }
          };
          
          img.onerror = () => {
            console.error(`Error loading image ${i + 1}:`, images[i]);
            reject(new Error(`Failed to load image ${i + 1}`));
          };
          
          img.src = images[i];
        });
      } catch (error) {
        console.error(`Error processing image ${i + 1}:`, error);
        // Continue with next image even if one fails
      }
    }
    
    // Save the PDF after all images are processed
    doc.save(`${filename}.pdf`);
  };

  const downloadComicAsDOCX = async (images, comic, filename) => {
    try {
      const { Document, Packer, Paragraph, TextRun, ImageRun } = await import('docx');
      
      const docElements = [
        new Paragraph({
          children: [new TextRun({ text: comic.title || 'Comic', bold: true, size: 32 })]
        }),
        new Paragraph({ text: "" }),
        new Paragraph({
          children: [new TextRun({ text: `Topic: ${comic.topic || 'N/A'}` })]
        }),
        new Paragraph({ text: "" })
      ];

      // Extract panel texts
      let panelTexts = [];
      if (comic.panelTexts && Array.isArray(comic.panelTexts)) {
        panelTexts = comic.panelTexts.map((panelText, index) => {
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
      } else if (comic.panels && Array.isArray(comic.panels)) {
        panelTexts = comic.panels.map((panel, index) => {
          return panel.text || panel.content || panel.description || `Panel ${index + 1} text not available`;
        });
      }

      // Process each image and embed it in the document
      for (let i = 0; i < images.length; i++) {
        const imageUrl = images[i];
        
        try {
          // Fetch the image and convert to Uint8Array
          const response = await fetch(imageUrl);
          const blob = await response.blob();
          const arrayBuffer = await blob.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);

          // Add panel title
          docElements.push(
            new Paragraph({
              children: [new TextRun({ text: `Panel ${i + 1}`, bold: true, size: 24 })]
            })
          );

          // Create image run for DOCX
          const imageRun = new ImageRun({
            data: uint8Array,
            transformation: {
              width: 400,
              height: 300,
            },
          });

          // Add the image
          docElements.push(
            new Paragraph({
              children: [imageRun],
              alignment: 'center'
            })
          );

          // Add panel text if available
          if (panelTexts[i]) {
            docElements.push(
              new Paragraph({
                children: [new TextRun({ text: panelTexts[i] })]
              })
            );
          }

          // Add spacing between panels
          docElements.push(new Paragraph({ text: "" }));
          
        } catch (error) {
          console.error(`Error processing image ${i + 1}:`, error);
          // Fallback to URL if image processing fails
          docElements.push(
            new Paragraph({
              children: [new TextRun({ text: `Panel ${i + 1}: ${imageUrl}` })]
            })
          );
          docElements.push(
            new Paragraph({
              children: [new TextRun({ text: `Note: Image embedding failed. For best results, use the "Images" download format to get individual image files.`, italics: true })]
            })
          );
        }
      }

      const doc = new Document({
        sections: [{
          properties: {},
          children: docElements
        }]
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Error creating DOCX:', error);
      throw new Error('Failed to create DOCX document');
    }
  };

  const downloadComicAsPPTX = async (images, comic, filename) => {
    // Note: PPTX generation with embedded images is complex and requires additional libraries
    // For now, we'll create a DOCX file with embedded images as a workaround
    // This provides better image embedding than the original PPTX implementation
    await downloadComicAsDOCX(images, comic, filename);
  };

  const downloadComicAsImages = async (images, filename) => {
    for (let i = 0; i < images.length; i++) {
      try {
        const response = await fetch(images[i]);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}_panel_${i + 1}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error(`Error downloading image ${i}:`, error);
      }
    }
  };

  const downloadImageAsPDF = async (imageUrl, filename) => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const imgWidth = doc.internal.pageSize.getWidth();
      const imgHeight = (img.height * imgWidth) / img.width;
      const pageHeight = doc.internal.pageSize.getHeight();
      
      if (imgHeight > pageHeight) {
        const ratio = pageHeight / imgHeight;
        const newWidth = imgWidth * ratio;
        const newHeight = pageHeight;
        doc.addImage(img, 'JPEG', (imgWidth - newWidth) / 2, 0, newWidth, newHeight);
      } else {
        doc.addImage(img, 'JPEG', 0, (pageHeight - imgHeight) / 2, imgWidth, imgHeight);
      }
      
      doc.save(`${filename}.pdf`);
    };
    img.src = imageUrl;
  };

  const downloadImageAsDOCX = async (imageUrl, image, filename) => {
    const { Document, Packer, Paragraph, TextRun } = await import('docx');
    
    const docElements = [
      new Paragraph({
        children: [new TextRun({ text: image.title || 'Image', bold: true, size: 32 })]
      }),
      new Paragraph({ text: "" }),
      new Paragraph({
        children: [new TextRun({ text: `Topic: ${image.topic || 'N/A'}` })]
      }),
      new Paragraph({
        children: [new TextRun({ text: `Instructions: ${image.instructions || 'N/A'}` })]
      }),
      new Paragraph({ text: "" }),
      new Paragraph({
        children: [new TextRun({ text: `Image URL: ${imageUrl}` })]
      })
    ];

    const doc = new Document({
      sections: [{
        properties: {},
        children: docElements
      }]
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadImageAsPPTX = async (imageUrl, image, filename) => {
    const { Document, Packer, Paragraph, TextRun } = await import('docx');
    
    const docElements = [
      new Paragraph({
        children: [new TextRun({ text: image.title || 'Image', bold: true, size: 32 })]
      }),
      new Paragraph({ text: "" }),
      new Paragraph({
        children: [new TextRun({ text: `Topic: ${image.topic || 'N/A'}` })]
      }),
      new Paragraph({
        children: [new TextRun({ text: `Instructions: ${image.instructions || 'N/A'}` })]
      }),
      new Paragraph({ text: "" }),
      new Paragraph({
        children: [new TextRun({ text: `Image URL: ${imageUrl}` })]
      })
    ];

    const doc = new Document({
      sections: [{
        properties: {},
        children: docElements
      }]
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.pptx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadImageAsImage = async (imageUrl, filename) => {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePreview = (item) => {
    setPreviewDialog({ open: true, item });
  };

  const handleDownloadClick = (item) => {
    setDownloadDialog({ open: true, item });
  };

  // Add lesson handlers
  const handleAddToLesson = async (item) => {
    setSelectedContentForLesson(item);
    setLessonFormData({
      title: `${item.title || item.instruction || 'Untitled'} - Lesson`,
      lessonDescription: `Lesson based on ${item.type}: ${item.title || item.instruction || 'Untitled'}`,
      learningObjectives: item.objective || '',
      grade: item.grade || '', // Keep existing grade if available
      isPublic: false
    });
    setAddToLessonDialog(true);
  };

  const handleSubmitAddToLesson = async () => {
    if (!selectedContentForLesson) return;

    setIsAddingToLesson(true);
    try {
      const result = await addContentToLesson(
        selectedContentForLesson._id, 
        selectedContentForLesson.type, 
        lessonFormData
      );
      
      if (result.success) {
        toast.success('Content added to lesson successfully!');
        setAddToLessonDialog(false);
        setSelectedContentForLesson(null);
        setLessonFormData({
          title: '',
          lessonDescription: '',
          learningObjectives: '',
          grade: '',
          isPublic: false
        });
      } else {
        // Handle duplicate case
        if (result.error && result.error.includes('already been added')) {
          toast.warning('This content has already been added to a lesson!', {
            description: 'You cannot create duplicate lessons for the same content.',
            action: {
              label: 'View Lesson',
              onClick: () => {
                // You could add navigation to view the existing lesson here
                console.log('Existing lesson ID:', result.existingLessonId);
              }
            }
          });
        } else {
          toast.error(result.error || 'Failed to add content to lesson');
        }
      }
    } catch (error) {
      console.error('Error adding content to lesson:', error);
      toast.error('Failed to add content to lesson');
    } finally {
      setIsAddingToLesson(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Unknown";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  };

  const getContentIcon = (type) => {
    const IconComponent = contentTypes[type]?.icon || FileText;
    return <IconComponent className="h-5 w-5" />;
  };

  const getContentColor = (type) => {
    return contentTypes[type]?.color || "bg-gray-100";
  };

  // Get the appropriate image for each content type
  const getContentImage = (item) => {
    switch (item.type) {
      case 'comic':
        // For comics, use the first panel image if available
        if (item.imageUrls && item.imageUrls.length > 0) {
          return item.imageUrls[0];
        }
        if (item.images && item.images.length > 0) {
          return item.images[0];
        }
        return contentTypes.comic.placeholderImage;
      
      case 'image':
        // For images, use the actual image
        if (item.imageUrl) {
          return item.imageUrl;
        }
        if (item.images && item.images.length > 0) {
          return item.images[0];
        }
        return contentTypes.image.placeholderImage;
      
      case 'slides':
        // For slides, use the first slide image if available
        if (item.slideImages && item.slideImages.length > 0) {
          return item.slideImages[0];
        }
        if (item.images && item.images.length > 0) {
          return item.images[0];
        }
        return contentTypes.slides.placeholderImage;
      
      case 'video':
        // For videos, use thumbnail if available
        if (item.thumbnailUrl) {
          return item.thumbnailUrl;
        }
        if (item.thumbnail) {
          return item.thumbnail;
        }
        return contentTypes.video.placeholderImage;
      
      case 'websearch':
        // For web searches, use a web-related placeholder
        return contentTypes.websearch.placeholderImage;
      
      case 'content':
        // For content, use a document-related placeholder
        return contentTypes.content.placeholderImage;
      
      case 'assessment':
        // For assessments, use a quiz-related placeholder
        return contentTypes.assessment.placeholderImage;
      
      default:
        return contentTypes.all.placeholderImage;
    }
  };

  // Get available download formats for each content type
  const getAvailableFormats = (contentType) => {
    switch (contentType) {
      case 'comic':
        return [
          { value: 'image', label: 'Images (.jpg)', description: 'Download all comic panels as individual image files' },
          { value: 'pdf', label: 'PDF (.pdf)', description: 'Comic panels in PDF format with embedded images' },
          { value: 'doc', label: 'Word Document (.docx)', description: 'Comic panels in Word format with embedded images' }
        ];
      case 'image':
        return [
          { value: 'image', label: 'Image (.jpg)', description: 'Original image file' }
        ];
      case 'slides':
        return [
          { value: 'pptx', label: 'PowerPoint (.pptx)', description: 'Presentation format' }
        ];
      case 'content':
      case 'assessment':
        return [
          { value: 'pdf', label: 'PDF (.pdf)', description: 'Content in PDF format' },
          { value: 'doc', label: 'Word Document (.docx)', description: 'Content in Word format' }
        ];
      case 'video':
        return [
          { value: 'pdf', label: 'PDF (.pdf)', description: 'Video metadata as PDF' }
        ];
      case 'websearch':
        return [
          { value: 'pdf', label: 'PDF (.pdf)', description: 'Search results in PDF format' },
          { value: 'doc', label: 'Word Document (.docx)', description: 'Search results in Word format' }
        ];
      default:
        return [
          { value: 'pdf', label: 'PDF (.pdf)', description: 'Content in PDF format' }
        ];
    }
  };

  // Use the proper loading component
  if (loading) {
    return <LibraryLoading />;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">My Library</h1>
        <p className="text-muted-foreground">
          Manage and organize all your created content in one place
        </p>
      </div>

      {/* Search and Stats */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search your content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Total: {counts.all || 0} items</span>
          <span>•</span>
          <span>Last updated: {formatDate(new Date())}</span>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8">
          {Object.entries(contentTypes).map(([key, config]) => {
            const IconComponent = config.icon;
            const count = counts[key] || 0;
            return (
              <TabsTrigger key={key} value={key} className="flex items-center gap-2">
                <IconComponent className="h-4 w-4" />
                <span className="hidden sm:inline">{config.label}</span>
                <Badge variant="secondary" className="ml-1">
                  {count}
                </Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Content Grid */}
        <TabsContent value={activeTab} className="mt-6">
          {filteredContent.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4">
                {getContentIcon(activeTab)}
              </div>
              <h3 className="text-lg font-semibold mb-2">No content found</h3>
              <p className="text-muted-foreground">
                {searchQuery 
                  ? "No content matches your search criteria"
                  : `You haven't created any ${contentTypes[activeTab]?.label.toLowerCase() || 'content'} yet`
                }
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredContent.map((item) => (
                <Card key={`${item.type}-${item._id}`} className="group hover:shadow-lg transition-shadow overflow-hidden h-full flex flex-col p-0">
                  <div className="h-40 relative overflow-hidden">
                    <img
                      src={getContentImage(item)}
                      alt={item.title || item.instruction || "Content"}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      onError={(e) => {
                        e.target.src = contentTypes[item.type]?.placeholderImage || contentTypes.all.placeholderImage;
                      }}
                    />
                    <div className="absolute top-2 left-2">
                      <Badge variant="secondary" className="text-xs bg-black/70 text-white px-2 py-1">
                        {contentTypes[item.type]?.label || item.type}
                      </Badge>
                    </div>
                  </div>
                  <CardContent className="p-3 flex flex-col flex-1">
                    <div className="flex-1 space-y-2">
                      <CardTitle className="text-sm font-medium line-clamp-2 leading-tight">
                        {item.title || item.instruction || "Untitled"}
                      </CardTitle>
                      
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        {item.topic && (
                          <>
                            <span className="font-medium">Topic:</span>
                            <span className="line-clamp-1">{item.topic}</span>
                          </>
                        )}
                        {item.subject && (
                          <>
                            <span className="font-medium">Subject:</span>
                            <span className="line-clamp-1">{item.subject}</span>
                          </>
                        )}
                        {item.grade && (
                          <>
                            <span className="font-medium">Grade:</span>
                            <span className="line-clamp-1">{item.grade}</span>
                          </>
                        )}
                        <span className="font-medium">Date:</span>
                        <span className="line-clamp-1">{formatDate(item.createdAt)}</span>
                      </div>
                    </div>

                    {/* Action Buttons - Fixed at bottom */}
                    <div className="space-y-2 pt-3 mt-auto">
                      {/* Add to Lesson Button */}
                      <Button
                        onClick={() => handleAddToLesson(item)}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs h-8"
                        size="sm"
                      >
                        <BookmarkPlus className="h-3 w-3 mr-1" />
                        Add to Lesson
                      </Button>
                      
                      {/* Other Actions */}
                      <div className="grid grid-cols-3 gap-1 mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePreview(item)}
                          className="text-xs h-7 px-2"
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadClick(item)}
                          className="text-xs h-7 px-2 flex items-center gap-1"
                        >
                          <Download className="h-3 w-3" />
                          <ChevronDown className="h-2 w-2" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(item._id, item.type)}
                          className="text-xs h-7 px-2 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Library Dialog */}
      <LibraryDialog
        isOpen={previewDialog.open}
        onClose={() => setPreviewDialog({ open: false, item: null })}
        content={previewDialog.item}
        onDelete={handleDelete}
        onDownload={(item, format) => handleDownload(item, format)}
      />

      {/* Download Format Selection Dialog */}
      <Dialog open={downloadDialog.open} onOpenChange={(open) => setDownloadDialog({ open, item: open ? downloadDialog.item : null })}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Download Content</DialogTitle>
            <DialogDescription>
              Choose the format for downloading your {downloadDialog.item?.type || 'content'}.
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
                  {downloadDialog.item && getAvailableFormats(downloadDialog.item.type).map((format) => (
                    <SelectItem key={format.value} value={format.value}>
                      {format.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm text-muted-foreground">
              {downloadDialog.item && getAvailableFormats(downloadDialog.item.type).find(f => f.value === downloadFormat)?.description}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDownloadDialog({ open: false, item: null })}>
              Cancel
            </Button>
            <Button 
              onClick={() => handleDownload(downloadDialog.item, downloadFormat)} 
              disabled={isDownloading || !downloadFormat}
            >
              {isDownloading ? "Downloading..." : "Download"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add to Lesson Dialog - FIXED with proper grade-subject selection */}
      <Dialog open={addToLessonDialog} onOpenChange={setAddToLessonDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Content to Lesson</DialogTitle>
            <DialogDescription>
              Create a lesson from this content for your students.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="lessonTitle">Lesson Title</Label>
              <Input
                id="lessonTitle"
                value={lessonFormData.title}
                onChange={(e) => setLessonFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter lesson title"
              />
            </div>
            
            {/* FIXED: Grade selection for slides and videos using curriculum data */}
            {(selectedContentForLesson?.type === 'slides' || selectedContentForLesson?.type === 'video') && (
              <div className="space-y-2">
                <Label htmlFor="grade">Grade Level</Label>
                {loadingCurriculum ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    <span className="text-sm text-muted-foreground">Loading grade options...</span>
                  </div>
                ) : (
                  <Select 
                    value={lessonFormData.grade} 
                    onValueChange={(value) => setLessonFormData(prev => ({ ...prev, grade: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select grade level" />
                    </SelectTrigger>
                    <SelectContent>
                      {curriculumData.grades.map((grade) => (
                        <SelectItem key={grade.id} value={grade.name}>
                          {grade.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <p className="text-xs text-muted-foreground">
                  Select the grade level for this lesson
                </p>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="lessonDescription">Lesson Description</Label>
              <Textarea
                id="lessonDescription"
                value={lessonFormData.lessonDescription}
                onChange={(e) => setLessonFormData(prev => ({ ...prev, lessonDescription: e.target.value }))}
                placeholder="Describe what students will learn"
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="learningObjectives">Learning Objectives</Label>
              <Textarea
                id="learningObjectives"
                value={lessonFormData.learningObjectives}
                onChange={(e) => setLessonFormData(prev => ({ ...prev, learningObjectives: e.target.value }))}
                placeholder="What will students achieve?"
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddToLessonDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitAddToLesson} 
              disabled={isAddingToLesson || (selectedContentForLesson?.type === 'slides' || selectedContentForLesson?.type === 'video' ? !lessonFormData.grade : false)}
            >
              {isAddingToLesson ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <BookmarkPlus className="h-4 w-4 mr-2" />
                  Add to Lesson
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}