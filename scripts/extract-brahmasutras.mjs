/**
 * Reads data/Brahma_Sutra.pdf with pdf-parse, splits by sutra refs (I.1.1, II.3.4, …),
 * writes data/brahmasutras.json.
 *
 * Uses each (chapter,pada,sutra)'s first occurrence in the PDF as the canonical block;
 * later mentions are cross-references and are skipped for slicing (still deduped keys).
 *
 * Commentary boundary: this PDF extracts without paragraph breaks; we scan for phrases
 * that typically open Swami Sivananda's exposition after pada gloss / translation.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PDFParse } from "pdf-parse";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PDF_PATH = path.join(ROOT, "data", "Brahma_Sutra.pdf");
const OUT_PATH = path.join(ROOT, "data", "brahmasutras.json");

/** Brahma Sūtras use adhyāya I–IV only — longest Roman numerals first for alternation. */
const SUTRA_REF_RE = /\b(IV|III|II|I)\.(\d+)\.(\d+)\b/g;

const ROMAN_CHAPTER = { I: 1, II: 2, III: 3, IV: 4 };

function romanChapterToNum(r) {
  return ROMAN_CHAPTER[r] ?? null;
}

/** Remove page footer markers like "-- 44 of 575 --". */
function stripPageMarkers(text) {
  return text.replace(/^[\t ]*--\s*\d+\s+of\s+\d+\s+--[\t ]*$/gm, "\n");
}

function normalizeWhitespace(s) {
  return s
    .replace(/\r\n/g, "\n")
    /** Join hyphenated hard line-breaks from PDF extraction */
    .replace(/-\n(?=[a-z])/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const COMMENTARY_START_MARKERS = [
  "\nYou must know",
  "\nAnswer to the enquiry",
  "\nThe question now arises",
  "\nHere is the answer",
  "\nHere is the answer of the Siddhantin",
  "\nAn objection",
  "\nThe Sankhya says",
  "\nThe Sankhya comes",
  "\nKnowledge of Brahman destroys",
  "\nCharvakas or",
  "\nJust as in the case",
  "\nWhen one realises",
  "\nWhen a man sleeps",
  "\nAll the Vedanta texts uniformly",
  "\nAll the Vedanta-texts have",
  "\nThe scriptures never",
  "\nThe Omniscience of Brahman follows",
  "\nThe argument in support of Sutra",
  "\nThe argument to prove",
  "\nThe argument to prove that",
  "\nThe second Sutra does not",
  "\nFurther reason is given",
  "\nAnother reason is given",
  "\nHence Pradhana cannot",
  "\nTherefore it is quite clear",
  "\nTherefore the word",
  "\nNow the author",
  "\nNow the Sankhya",
  "\nThe next Sutra refutes",
  "\nThe passage in Chh",
  "\nThe non-intelligent Pradhana",
  "\nIn the ascertainment of Truth",
  "\nSrutis furnish",
];

function stripTrailingPageLine(s) {
  return s.replace(/\n\d{1,4}\s*$/u, "").trim();
}

function splitSutraAndCommentary(bodyRaw) {
  const body = bodyRaw.trim();
  let cut = -1;
  for (const m of COMMENTARY_START_MARKERS) {
    const idx = body.indexOf(m);
    if (idx >= 0 && (cut < 0 || idx < cut)) cut = idx;
  }
  if (cut < 0) {
    return { sutra_text: stripTrailingPageLine(body), commentary: "" };
  }
  const sutra_text = stripTrailingPageLine(body.slice(0, cut));
  const commentary = body.slice(cut + 1).trim();
  return { sutra_text, commentary };
}

async function extractPdfText(buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text ?? "";
  } finally {
    await parser.destroy();
  }
}

function parseSutras(fullText) {
  const text = normalizeWhitespace(stripPageMarkers(fullText));
  const matches = [...text.matchAll(SUTRA_REF_RE)];

  const firstMatchByKey = new Map();
  for (const m of matches) {
    const [, roman, padaStr, sutraStr] = m;
    const chapter = romanChapterToNum(roman);
    const pada = parseInt(padaStr, 10);
    const sutra_num = parseInt(sutraStr, 10);
    if (chapter == null || !Number.isFinite(pada) || !Number.isFinite(sutra_num)) continue;
    const key = `${chapter}-${pada}-${sutra_num}`;
    if (!firstMatchByKey.has(key)) firstMatchByKey.set(key, m);
  }

  const canonical = [...firstMatchByKey.values()].sort((a, b) => a.index - b.index);
  const out = [];

  for (let k = 0; k < canonical.length; k++) {
    const m = canonical[k];
    const [, roman, padaStr, sutraStr] = m;
    const chapter = romanChapterToNum(roman);
    const pada = parseInt(padaStr, 10);
    const sutra_num = parseInt(sutraStr, 10);

    const startContent = m.index + m[0].length;
    const endContent = k + 1 < canonical.length ? canonical[k + 1].index : text.length;
    const bodyRaw = text.slice(startContent, endContent);

    const { sutra_text, commentary } = splitSutraAndCommentary(bodyRaw);

    out.push({
      id: `bs-${chapter}-${pada}-${sutra_num}`,
      source: "Brahma Sutras",
      chapter,
      pada,
      sutra_num,
      sutra_text,
      commentary,
    });
  }

  return out;
}

async function main() {
  if (!fs.existsSync(PDF_PATH)) {
    console.error(`PDF not found: ${PDF_PATH}`);
    process.exit(1);
  }

  const buffer = fs.readFileSync(PDF_PATH);
  const fullText = await extractPdfText(buffer);
  const sutras = parseSutras(fullText);

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(sutras, null, 2), "utf8");

  console.log(`Wrote ${OUT_PATH}`);
  console.log(`Total sutras found: ${sutras.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
