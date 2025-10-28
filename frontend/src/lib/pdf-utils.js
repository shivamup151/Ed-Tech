import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';

/**
 * PDF generation has been removed. Please use DOCX or Markdown export instead.
 */
export const generatePDF = async (content, filename, options = {}) => {
  throw new Error('PDF generation has been removed. Please use DOCX or Markdown export instead.');
};

/**
 * Generates a DOCX file from markdown-like content with proper Arabic support.
 * @param {string} content - The content to be included in the DOCX.
 * @param {string} filename - The desired filename without extension.
 * @param {object} options - Additional options like title.
 * @returns {Promise<{success: boolean}>}
 */
export const generateDOCX = async (content, filename, options = {}) => {
  try {
    const { title = '', subtitle = '', includeHeader = true } = options;
    const hasArabic = /[\u0600-\u06FF]/.test(content);
    
    // Clean up LaTeX fractions and artifacts for Arabic content
    let cleanedContent = content;
    if (hasArabic) {
      // Convert \frac{numerator}{denominator} to numerator/denominator
      cleanedContent = cleanedContent.replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, (match, numerator, denominator) => {
        return `${numerator}/${denominator}`;
      });
      
      // Remove other LaTeX commands
      cleanedContent = cleanedContent.replace(/\\[a-zA-Z]+/g, '');
      
      // Remove curly braces
      cleanedContent = cleanedContent.replace(/[{}]/g, '');
      
      // Remove dollar signs
      cleanedContent = cleanedContent.replace(/\$\$?([^$]+)\$\$?/g, '$1');
      
      // Clean up any remaining LaTeX artifacts
      cleanedContent = cleanedContent.replace(/\{[^}]*\}/g, '');
    }
    
    const lines = cleanedContent.split('\n');
    const docElements = [];

    // --- Common paragraph properties for Arabic ---
    // This is the key fix: tell the docx library to handle the text as bidirectional (for RTL)
    // and align it to the right.
    const arabicParagraphOptions = {
      alignment: AlignmentType.RIGHT,
      bidirectional: true,
    };

    // --- Add title ---
    if (includeHeader && title) {
      docElements.push(new Paragraph({
        children: [new TextRun({ 
          text: title,
          ...(hasArabic && { font: 'Arial Unicode MS' })
        })],
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 200 },
        ...(hasArabic && arabicParagraphOptions) // Apply RTL properties if Arabic
      }));
      
      if (subtitle) {
        docElements.push(new Paragraph({
          children: [new TextRun({ 
            text: subtitle,
            ...(hasArabic && { font: 'Arial Unicode MS' })
          })],
          heading: HeadingLevel.HEADING_2,
          spacing: { after: 200 },
          ...(hasArabic && arabicParagraphOptions)
        }));
      }
    }

    // --- Process content line by line ---
    for (const line of lines) {
      if (!line.trim()) {
        docElements.push(new Paragraph({ text: "" }));
        continue;
      }
      
      let paragraph;
      const baseOptions = {
          spacing: { after: 100 },
          ...(hasArabic && arabicParagraphOptions)
      };

      if (line.startsWith('# ')) {
        paragraph = new Paragraph({ 
          ...baseOptions, 
          children: [new TextRun({ 
            text: line.replace('# ', ''), 
            ...(hasArabic && { font: 'Arial Unicode MS' })
          })],
          heading: HeadingLevel.HEADING_1 
        });
      } else if (line.startsWith('## ')) {
        paragraph = new Paragraph({ 
          ...baseOptions, 
          children: [new TextRun({ 
            text: line.replace('## ', ''), 
            ...(hasArabic && { font: 'Arial Unicode MS' })
          })],
          heading: HeadingLevel.HEADING_2 
        });
      } else if (line.startsWith('### ')) {
        paragraph = new Paragraph({ 
          ...baseOptions, 
          children: [new TextRun({ 
            text: line.replace('### ', ''), 
            ...(hasArabic && { font: 'Arial Unicode MS' })
          })],
          heading: HeadingLevel.HEADING_3 
        });
      } else if (line.match(/^\d+\./)) {
        // Handle numbered lists with bolding
        paragraph = new Paragraph({ 
          ...baseOptions, 
          children: [new TextRun({ 
            text: line, 
            bold: true,
            ...(hasArabic && { font: 'Arial Unicode MS' })
          })] 
        });
      } else if (line.match(/^[A-D]\)/)) {
        // Handle options
        paragraph = new Paragraph({ 
          ...baseOptions, 
          children: [new TextRun({ 
            text: line,
            ...(hasArabic && { font: 'Arial Unicode MS' })
          })] 
        });
      } else {
         // Handle regular text with bolding and other formatting
        const children = [];
        
        // Split by bold markers and process each part
        const boldParts = line.split(/(\*\*.*?\*\*)/g);
        
        for (const part of boldParts) {
          if (part.startsWith('**') && part.endsWith('**')) {
            // Bold text
            const boldText = part.slice(2, -2);
            children.push(new TextRun({ 
              text: boldText, 
              bold: true,
              ...(hasArabic && { font: 'Arial Unicode MS' }) // Use Unicode font for Arabic
            }));
          } else if (part.trim()) {
            // Regular text
            children.push(new TextRun({ 
              text: part,
              ...(hasArabic && { font: 'Arial Unicode MS' }) // Use Unicode font for Arabic
            }));
          }
        }
        
        paragraph = new Paragraph({ ...baseOptions, children });
      }
      
      docElements.push(paragraph);
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

    return { success: true };
  } catch (error) {
    console.error('DOCX generation failed:', error);
    throw new Error('Failed to generate DOCX: ' + error.message);
  }
};

/**
 * Generates and downloads a markdown file.
 * This function works correctly for all languages including Arabic.
 * @param {string} content - The markdown content.
 * @param {string} filename - The filename without extension.
 * @returns {{success: boolean}}
 */
export const generateMarkdown = (content, filename) => {
  try {
    // Clean up LaTeX fractions and artifacts for Arabic content (same as DOCX)
    let cleanedContent = content;
    const hasArabic = /[\u0600-\u06FF]/.test(content);
    
    if (hasArabic) {
      // Convert \frac{numerator}{denominator} to numerator/denominator
      cleanedContent = cleanedContent.replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, (match, numerator, denominator) => {
        return `${numerator}/${denominator}`;
      });
      
      // Remove other LaTeX commands
      cleanedContent = cleanedContent.replace(/\\[a-zA-Z]+/g, '');
      
      // Remove curly braces
      cleanedContent = cleanedContent.replace(/[{}]/g, '');
      
      // Remove dollar signs
      cleanedContent = cleanedContent.replace(/\$\$?([^$]+)\$\$?/g, '$1');
      
      // Clean up any remaining LaTeX artifacts
      cleanedContent = cleanedContent.replace(/\{[^}]*\}/g, '');
    }
    
    // Using a Blob with UTF-8 encoding is the correct way to handle all characters.
    const blob = new Blob([cleanedContent], { type: 'text/markdown; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return { success: true };
  } catch (error) {
    console.error('Markdown generation failed:', error);
    throw new Error('Failed to generate Markdown: ' + error.message);
  }
};
