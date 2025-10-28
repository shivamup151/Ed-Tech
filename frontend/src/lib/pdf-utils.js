import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, MathRun, MathFraction, MathNumerator, MathDenominator, MathRadical, MathSubScript, MathSuperScript, MathBase, MathFunctionName, MathFunctionProperties } from 'docx';

/**
 * PDF generation has been removed. Please use DOCX or Markdown export instead.
 */
export const generatePDF = async (content, filename, options = {}) => {
  throw new Error('PDF generation has been removed. Please use DOCX or Markdown export instead.');
};

/**
 * Converts LaTeX equations to Word MathML format for proper equation rendering
 * @param {string} latex - LaTeX equation string
 * @returns {object} Word MathML object
 */
const convertLatexToMathML = (latex) => {
  try {
    // Remove LaTeX delimiters
    const cleanLatex = latex.replace(/^\$\$?|\$\$?$/g, '').trim();
    
    // Handle common LaTeX patterns
    if (cleanLatex.includes('\\frac{')) {
      // Handle fractions: \frac{numerator}{denominator}
      const fracMatch = cleanLatex.match(/\\frac\{([^}]+)\}\{([^}]+)\}/);
      if (fracMatch) {
        return new MathRun({
          children: [
            new MathFraction({
              numerator: new MathNumerator({
                children: [new MathBase({ children: [new TextRun({ text: fracMatch[1] })] })]
              }),
              denominator: new MathDenominator({
                children: [new MathBase({ children: [new TextRun({ text: fracMatch[2] })] })]
              })
            })
          ]
        });
      }
    }
    
    if (cleanLatex.includes('\\sqrt{')) {
      // Handle square roots: \sqrt{content}
      const sqrtMatch = cleanLatex.match(/\\sqrt\{([^}]+)\}/);
      if (sqrtMatch) {
        return new MathRun({
          children: [
            new MathRadical({
              children: [new MathBase({ children: [new TextRun({ text: sqrtMatch[1] })] })]
            })
          ]
        });
      }
    }
    
    if (cleanLatex.includes('^') || cleanLatex.includes('_')) {
      // Handle superscripts and subscripts
      const parts = cleanLatex.split(/(\^|_)/);
      const children = [];
      
      for (let i = 0; i < parts.length; i++) {
        if (parts[i] === '^') {
          // Superscript
          const superscript = parts[i + 1]?.replace(/[{}]/g, '') || '';
          if (superscript) {
            children.push(new MathSuperScript({
              children: [new MathBase({ children: [new TextRun({ text: superscript })] })]
            }));
            i++; // Skip the next part as we've processed it
          }
        } else if (parts[i] === '_') {
          // Subscript
          const subscript = parts[i + 1]?.replace(/[{}]/g, '') || '';
          if (subscript) {
            children.push(new MathSubScript({
              children: [new MathBase({ children: [new TextRun({ text: subscript })] })]
            }));
            i++; // Skip the next part as we've processed it
          }
        } else if (parts[i].trim()) {
          // Regular text
          children.push(new MathBase({ children: [new TextRun({ text: parts[i] })] }));
        }
      }
      
      if (children.length > 0) {
        return new MathRun({ children });
      }
    }
    
    // For simple equations without special formatting, return as MathRun
    return new MathRun({
      children: [new MathBase({ children: [new TextRun({ text: cleanLatex })] })]
    });
    
  } catch (error) {
    console.warn('Failed to convert LaTeX to MathML:', error);
    // Fallback to plain text
    return new TextRun({ text: latex });
  }
};

/**
 * Processes text content to identify and convert LaTeX equations
 * @param {string} text - Text content that may contain LaTeX equations
 * @returns {Array} Array of TextRun or MathRun objects
 */
const processTextWithEquations = (text) => {
  // Split text by LaTeX delimiters ($ and $$)
  const parts = text.split(/(\$\$?[^$]+\$\$?)/);
  const result = [];
  
  for (const part of parts) {
    if (!part.trim()) continue;
    
    if (part.match(/^\$\$?[^$]+\$\$?$/)) {
      // This is a LaTeX equation
      result.push(convertLatexToMathML(part));
    } else {
      // Regular text
      result.push(new TextRun({ text: part }));
    }
  }
  
  return result;
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
    const lines = content.split('\n');
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
        text: title,
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 200 },
        ...(hasArabic && arabicParagraphOptions) // Apply RTL properties if Arabic
      }));
      
      if (subtitle) {
        docElements.push(new Paragraph({
          text: subtitle,
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
        const equationParts = processTextWithEquations(line.replace('# ', ''));
        paragraph = new Paragraph({ 
          ...baseOptions, 
          children: equationParts,
          heading: HeadingLevel.HEADING_1 
        });
      } else if (line.startsWith('## ')) {
        const equationParts = processTextWithEquations(line.replace('## ', ''));
        paragraph = new Paragraph({ 
          ...baseOptions, 
          children: equationParts,
          heading: HeadingLevel.HEADING_2 
        });
      } else if (line.startsWith('### ')) {
        const equationParts = processTextWithEquations(line.replace('### ', ''));
        paragraph = new Paragraph({ 
          ...baseOptions, 
          children: equationParts,
          heading: HeadingLevel.HEADING_3 
        });
      } else if (line.match(/^\d+\./)) {
        // Handle numbered lists with bolding and equations
        const equationParts = processTextWithEquations(line);
        paragraph = new Paragraph({ 
          ...baseOptions, 
          children: equationParts.map(p => ({ ...p, bold: true }))
        });
      } else if (line.match(/^[A-D]\)/)) {
        // Handle options - process for equations
        const equationParts = processTextWithEquations(line);
        paragraph = new Paragraph({ 
          ...baseOptions, 
          children: equationParts
        });
      } else {
         // Handle regular text with bolding and equations
        const children = [];
        const boldParts = line.split(/(\*\*.*?\*\*)/g);
        
        for (const part of boldParts) {
          if (part.startsWith('**') && part.endsWith('**')) {
            // Bold text - process for equations too
            const boldText = part.slice(2, -2);
            const equationParts = processTextWithEquations(boldText);
            children.push(...equationParts.map(p => ({ ...p, bold: true })));
          } else if (part.trim()) {
            // Regular text - process for equations
            const equationParts = processTextWithEquations(part);
            children.push(...equationParts);
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
    // Using a Blob with UTF-8 encoding is the correct way to handle all characters.
    const blob = new Blob([content], { type: 'text/markdown; charset=utf-8' });
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
