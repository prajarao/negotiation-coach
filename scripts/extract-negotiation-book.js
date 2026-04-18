#!/usr/bin/env node
/**
 * Reads the Negotiation Made Simple PDF from the repo root and writes
 * api/_negotiation-book-knowledge.js for use in api/chat.js (prompt grounding).
 *
 * Usage: node scripts/extract-negotiation-book.js
 */

const fs = require("fs");
const path = require("path");
const pdf = require("pdf-parse");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "api", "_negotiation-book-knowledge.js");
const MAX_CHARS = 16_000;

/** Drop copyright / TOC / foreword when possible so the excerpt is mostly body text */
function trimFrontMatter(text) {
  const markers = [
    /\nINTRODUCTION\s*\n\s*Getting\s+Started/i,
    /\nPART\s+I[:\s]*\n?\s*Manage\s+Yourself/i,
    /\nChapter\s+One:\s*You\s+Are\s+a\s+Negotiator\s*\n/i,
  ];
  for (const re of markers) {
    const m = re.exec(text);
    if (m && m.index >= 0 && m.index < 40_000) return text.slice(m.index);
  }
  return text;
}

const CANDIDATES = [
  "Negotiation Made Simple - John Lowry.pdf",
  "Negotiation made easy.pdf",
  "Negotiation Made Easy.pdf",
];

function findPdf() {
  for (const name of CANDIDATES) {
    const p = path.join(ROOT, name);
    if (fs.existsSync(p)) return p;
  }
  const files = fs.readdirSync(ROOT).filter((f) => f.toLowerCase().endsWith(".pdf"));
  if (files.length === 1) return path.join(ROOT, files[0]);
  return null;
}

function escapeTemplateLiteral(s) {
  return s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

async function main() {
  const pdfPath = findPdf();
  if (!pdfPath) {
    console.error("No PDF found in project root. Expected one of:", CANDIDATES.join(", "));
    process.exit(1);
  }

  const buf = fs.readFileSync(pdfPath);
  const data = await pdf(buf);
  let text = (data.text || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  text = trimFrontMatter(text);

  if (!text || text.length < 200) {
    console.error("Extracted text is empty or too short — PDF may be image-only or protected.");
    process.exit(1);
  }

  const truncated = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) + "\n\n[… excerpt truncated for API context size …]" : text;

  const header = `/**
 * Grounding excerpts from: Negotiation Made Simple (John Lowry)
 * ----------------------------------------------------------------
 * AUTO-GENERATED — do not edit by hand. Regenerate with:
 *   node scripts/extract-negotiation-book.js
 * Source PDF: ${path.basename(pdfPath)}
 * Pages: ${data.numpages}
 */

`;

  const body = `export const NEGOTIATION_BOOK_REFERENCE = \`${escapeTemplateLiteral(truncated)}\`;

export const NEGOTIATION_BOOK_META = {
  title: "Negotiation Made Simple",
  author: "John Lowry",
  sourceFile: ${JSON.stringify(path.basename(pdfPath))},
  pages: ${data.numpages},
  excerptChars: ${truncated.length},
};
`;

  fs.writeFileSync(OUT, header + body, "utf8");
  console.log("Wrote", OUT, "—", truncated.length, "chars from", pdfPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
