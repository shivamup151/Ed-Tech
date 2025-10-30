import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from "docx";

export const generatePDF = async (content, filename, options = {}) => {
  throw new Error(
    "PDF generation has been removed. Please use DOCX or Markdown export instead."
  );
};

// Build inline runs supporting only bold markdown (**text**). We avoid
// spreading class instances to keep the document structure valid.
const buildInlineRuns = (text, { bold = false } = {}) => {
  const runs = [];
  const parts = text.split(/(\*\*.*?\*\*)/g);
  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith("**") && part.endsWith("**")) {
      const boldText = part.slice(2, -2);
      if (boldText.trim()) {
        runs.push(new TextRun({ text: boldText, bold: true }));
      }
    } else {
      if (part.trim()) {
        runs.push(new TextRun({ text: part, bold }));
      }
    }
  }
  return runs.length ? runs : [new TextRun({ text, bold })];
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
    const { title = "", subtitle = "", includeHeader = true } = options;
    const hasArabic = /[\u0600-\u06FF]/.test(content);
    const lines = content.split("\n");
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
      docElements.push(
        new Paragraph({
          text: title,
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 200 },
          ...(hasArabic && arabicParagraphOptions), // Apply RTL properties if Arabic
        })
      );

      if (subtitle) {
        docElements.push(
          new Paragraph({
            text: subtitle,
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 200 },
            ...(hasArabic && arabicParagraphOptions),
          })
        );
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
        ...(hasArabic && arabicParagraphOptions),
      };

      if (line.startsWith("# ")) {
        paragraph = new Paragraph({
          ...baseOptions,
          children: buildInlineRuns(line.replace("# ", "")),
          heading: HeadingLevel.HEADING_1,
        });
      } else if (line.startsWith("## ")) {
        paragraph = new Paragraph({
          ...baseOptions,
          children: buildInlineRuns(line.replace("## ", "")),
          heading: HeadingLevel.HEADING_2,
        });
      } else if (line.startsWith("### ")) {
        paragraph = new Paragraph({
          ...baseOptions,
          children: buildInlineRuns(line.replace("### ", "")),
          heading: HeadingLevel.HEADING_3,
        });
      } else if (line.match(/^\d+\./)) {
        // Simple numbered line — render the entire line bold to mimic emphasis
        paragraph = new Paragraph({
          ...baseOptions,
          children: buildInlineRuns(line, { bold: true }),
        });
      } else if (line.match(/^[A-D]\)/)) {
        // Multiple‑choice style option
        paragraph = new Paragraph({
          ...baseOptions,
          children: buildInlineRuns(line),
        });
      } else {
        // Regular text with inline bold support
        paragraph = new Paragraph({
          ...baseOptions,
          children: buildInlineRuns(line),
        });
      }

      docElements.push(paragraph);
    }

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: docElements,
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return { success: true };
  } catch (error) {
    console.error("DOCX generation failed:", error);
    throw new Error("Failed to generate DOCX: " + error.message);
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
    const blob = new Blob([content], { type: "text/markdown; charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return { success: true };
  } catch (error) {
    console.error("Markdown generation failed:", error);
    throw new Error("Failed to generate Markdown: " + error.message);
  }
};
