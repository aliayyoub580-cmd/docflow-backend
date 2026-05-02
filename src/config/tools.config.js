/**
 * Backend tool configuration - mirrors frontend tools
 */

export const TOOLS = [
  {
    id: "pdf-to-word",
    name: "PDF to Word",
    inputFormats: [".pdf"],
    outputFormat: ".docx",
    maxFileSizeMB: 50
  },
  {
    id: "word-to-pdf",
    name: "Word to PDF",
    inputFormats: [".doc", ".docx"],
    outputFormat: ".pdf",
    maxFileSizeMB: 50
  },
  {
    id: "pdf-to-excel",
    name: "PDF to Excel",
    inputFormats: [".pdf"],
    outputFormat: ".xlsx",
    maxFileSizeMB: 50
  },
  {
    id: "excel-to-pdf",
    name: "Excel to PDF",
    inputFormats: [".xls", ".xlsx"],
    outputFormat: ".pdf",
    maxFileSizeMB: 50
  },
  {
    id: "image-to-pdf",
    name: "Image to PDF",
    inputFormats: [".jpg", ".jpeg", ".png", ".gif", ".webp"],
    outputFormat: ".pdf",
    maxFileSizeMB: 20
  },
  {
    id: "pdf-to-jpg",
    name: "PDF to JPG",
    inputFormats: [".pdf"],
    outputFormat: ".jpg",
    maxFileSizeMB: 50
  },
  {
    id: "pdf-to-png",
    name: "PDF to PNG",
    inputFormats: [".pdf"],
    outputFormat: ".png",
    maxFileSizeMB: 50
  },
  {
    id: "pdf-to-txt",
    name: "PDF to TXT",
    inputFormats: [".pdf"],
    outputFormat: ".txt",
    maxFileSizeMB: 50
  },
  {
    id: "txt-to-pdf",
    name: "TXT to PDF",
    inputFormats: [".txt"],
    outputFormat: ".pdf",
    maxFileSizeMB: 10
  },
  {
    id: "excel-to-csv",
    name: "Excel to CSV",
    inputFormats: [".xls", ".xlsx"],
    outputFormat: ".csv",
    maxFileSizeMB: 50
  },
  {
    id: "csv-to-excel",
    name: "CSV to Excel",
    inputFormats: [".csv"],
    outputFormat: ".xlsx",
    maxFileSizeMB: 25
  },
  {
    id: "txt-to-docx",
    name: "TXT to DOCX",
    inputFormats: [".txt"],
    outputFormat: ".docx",
    maxFileSizeMB: 10
  },
  {
    id: "docx-to-txt",
    name: "DOCX to TXT",
    inputFormats: [".docx"],
    outputFormat: ".txt",
    maxFileSizeMB: 50
  },
  {
    id: "jpg-to-png",
    name: "JPG to PNG",
    inputFormats: [".jpg", ".jpeg"],
    outputFormat: ".png",
    maxFileSizeMB: 20
  },
  {
    id: "png-to-jpg",
    name: "PNG to JPG",
    inputFormats: [".png"],
    outputFormat: ".jpg",
    maxFileSizeMB: 20
  },
  {
    id: "svg-to-png",
    name: "SVG to PNG",
    inputFormats: [".svg"],
    outputFormat: ".png",
    maxFileSizeMB: 20
  }
];

export default TOOLS;
