import axios from 'axios';
// @ts-ignore - Removing import and using require for CJS compatibility
// import PDFParser from "node-pdf-parser";
import { XMLParser } from 'fast-xml-parser'; // Restore XMLParser import

// No worker setup needed for node-pdf-parser

const ARXIV_API_URL = 'http://export.arxiv.org/api/query';

interface ArxivEntry {
  title: string;
  author: { name: string } | { name: string }[]; // Can be single author or array
  id: string;
  // Add other fields if needed
}

interface ArxivApiResponse {
  feed: {
    entry: ArxivEntry | ArxivEntry[]; // Can be single entry or array if multiple IDs requested
  };
}

/**
 * Extracts the arXiv ID from various arXiv URL formats.
 * Handles /abs/, /pdf/, and potentially other formats.
 * @param url - The arXiv URL string.
 * @returns The extracted arXiv ID or null if not found.
 */
function extractArxivId(url: string): string | null {
  try {
    const parsedUrl = new URL(url);
    const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);

    // Look for patterns like /abs/XXXX.YYYYY or /pdf/XXXX.YYYYY.pdf
    // Updated regex to better handle versions like v1, v2 etc.
    const idPattern = /(\d{4}\.\d{4,5})(v\d+)?/;

    for (const segment of pathSegments) {
      const match = segment.match(idPattern);
      // Return the base ID (e.g., 2303.12345) including version if present
      if (match && match[0]) {
        return match[0];
      }
    }

    // Fallback for query parameters like ?id=XXXX.YYYYY (less common)
    const idFromQuery = parsedUrl.searchParams.get('id');
    if (idFromQuery) {
       const match = idFromQuery.match(idPattern);
       if (match && match[0]) {
         return match[0];
       }
    }

    console.error(`Could not extract arXiv ID from URL: ${url}`);
    return null;
  } catch (error) {
    console.error(`Error parsing URL ${url}:`, error);
    return null;
  }
}

/**
 * Fetches metadata (title, authors) from an arXiv paper URL.
 * Text extraction is now handled by Firecrawl.
 * @param arxivUrl - URL to the arXiv paper
 * @returns An object containing title and authors, or throws an error.
 */
export async function fetchMetadata(arxivUrl: string): Promise<{ title: string; authors: string[]; arxivId: string | null }> {
  const arxivId = extractArxivId(arxivUrl);
  if (!arxivId) {
     // Return null ID but default title/authors if ID extraction fails
     console.error(`Could not extract valid arXiv ID from URL: ${arxivUrl}`);
     return {
        title: 'Title Extraction Failed',
        authors: [],
        arxivId: null,
     }
  }
  console.log(`Extracted arXiv ID: ${arxivId}`);

  // --- Fetch Metadata from arXiv API ---
  let title = 'Untitled Paper';
  let authors: string[] = [];
  try {
    console.log(`Fetching metadata for ${arxivId}...`);
    const apiResponse = await axios.get(ARXIV_API_URL, {
      params: { id_list: arxivId, max_results: 1 },
      responseType: 'text',
      timeout: 15000, // Timeout for metadata fetch
    });
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix : "@_" });
    const jsonObj: ArxivApiResponse | undefined = parser.parse(apiResponse.data);
    const entry = jsonObj?.feed?.entry ? (Array.isArray(jsonObj.feed.entry) ? jsonObj.feed.entry[0] : jsonObj.feed.entry) : undefined;

    if (entry) {
      title = typeof entry.title === 'string' ? entry.title.replace(/\s+/g, ' ').trim() : 'Title Not Found';
      if (Array.isArray(entry.author)) {
        authors = entry.author.map(a => a.name.trim());
      } else if (entry.author?.name) {
        authors = [entry.author.name.trim()];
      }
      console.log(`Metadata fetched: Title - ${title}`);
    } else {
      console.warn(`Could not parse title/authors from arXiv API response for ${arxivId}`);
    }
  } catch (error: any) {
    console.error(`Error fetching/parsing arXiv metadata for ${arxivId}:`, error.message);
    // Don't throw, return defaults, but keep the ID
    title = 'Metadata Fetch Failed';
    authors = [];
  }

  return {
    title,
    authors,
    arxivId, // Return the extracted ID along with metadata
  };
}

// --- PDF Parsing Removed --- //
