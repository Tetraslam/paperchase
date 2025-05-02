import axios from 'axios';
import { MarketData } from './types';

const firecrawlApiKey = process.env.FIRECRAWL_API_KEY;
const firecrawlApiBaseUrl = 'https://api.firecrawl.dev/v1'; // Base URL

// --- Market Search using /search endpoint --- //

// Assuming response format is similar enough for now, might need dedicated interface
interface FirecrawlSearchResponse {
  success: boolean;
  data?: string; // Expecting markdown or structured data
  error?: string;
}

// TODO: Verify and adjust parsing based on actual /search response format
function parseFirecrawlSearchResponse(responseData: string): MarketData {
  console.log("Parsing Firecrawl /search response (Placeholder):", responseData.substring(0, 300));
  let tamEstimate: string | null = null;
  // Try extracting from potential markdown structure
  const tamMatch = responseData.match(/Total Addressable Market.*?[\\$€£](\d+(?:[.,]\d+)*\s*(?:Billion|Million|Trillion|B|M|T)?)/i);
  if (tamMatch && tamMatch[1]) {
    tamEstimate = `$${tamMatch[1].trim()} (Extracted)`;
  }

  const trends: string[] = [];
  const trendsSectionMatch = responseData.match(/(?:Key Market Trends|Market Trends)[:]?[\s\S]*?(?=\n\n|##|$)/i);
  if (trendsSectionMatch) {
    const trendMatches = trendsSectionMatch[0].match(/^[\*\-•]\s+(.*)/gm);
    if (trendMatches) {
      trends.push(...trendMatches.map(t => t.replace(/^[\*\-•]\s+/, '').trim() + ' (Extracted)'));
    }
  }

  if (!tamEstimate && trends.length === 0) {
    console.warn("Could not extract TAM or Trends from Firecrawl /search response.");
    tamEstimate = "Parsing Failed";
    trends.push("Parsing Failed");
  }
  return { tamEstimate, trends };
}

// Renamed from deepResearch to searchMarket
export async function searchMarket(keywords: string[]): Promise<MarketData> {
  if (!firecrawlApiKey) {
    console.warn('FIRECRAWL_API_KEY not set. Skipping Firecrawl market search.');
    return { tamEstimate: "Not Available (No API Key)", trends: [] };
  }
  // Construct a search query
  const query = `Market size, TAM, and key trends for technology related to: ${keywords.join(', ')}`;
  const searchUrl = `${firecrawlApiBaseUrl}/search`; // Use /search endpoint
  console.log(`Calling Firecrawl Search (${searchUrl}) with query: ${query}`);

  try {
    const response = await axios.post<FirecrawlSearchResponse>(
      searchUrl,
      {
        query: query,
        searchOptions: { limit: 5 } // Optional: Limit SERP results considered
      },
      {
        headers: {
          Authorization: `Bearer ${firecrawlApiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000, // Timeout for search
      }
    );

    if (response.data.success && response.data.data) {
      console.log("Firecrawl search successful.");
      // Assuming response.data.data is the string content/markdown for now
      return parseFirecrawlSearchResponse(response.data.data);
    } else {
      console.error('Firecrawl /search API call failed:', response.data?.error || response.statusText);
      throw new Error(`Firecrawl search failed: ${response.data?.error || 'Unknown error'}`);
    }
  } catch (error: any) {
    console.error('Error calling Firecrawl /search API:', error.message);
    if (axios.isAxiosError(error)) {
      console.error('Axios Error Details:', { status: error.response?.status, data: error.response?.data });
    }
    throw new Error(`Failed to fetch data from Firecrawl /search: ${error.message}`);
  }
}

// --- Deep Research (Async) --- //

interface FirecrawlStartResearchResponse {
  success: boolean;
  jobId?: string; // ID to track the async job
  error?: string;
}

interface FirecrawlCheckStatusResponse {
  success: boolean;
  status: 'processing' | 'completed' | 'failed' | 'queued';
  data?: {
    // Based on docs, the final result structure when completed
    finalAnalysis: string;
    activities: any[]; // Define more specifically if needed
    sources: { url: string; title: string; description: string }[];
  };
  message?: string; // Might contain error message on failure
  currentDepth?: number;
  maxDepth?: number;
  expiresAt?: string;
}

// TODO: Verify and adjust parsing based on actual /deep-research response format
function parseFirecrawlDeepResearch(responseData: FirecrawlCheckStatusResponse['data']): MarketData {
  if (!responseData) {
    console.warn("No data received from completed Firecrawl /deep-research job.");
    return { tamEstimate: "No Data", trends: [] };
  }
  console.log("Parsing Firecrawl /deep-research response:", responseData.finalAnalysis?.substring(0, 300));
  let tamEstimate: string | null = null;
  // Attempt to extract TAM from the finalAnalysis text
  const analysisText = responseData.finalAnalysis || '';
  const tamMatch = analysisText.match(/Total Addressable Market.*?([\\$€£][\\d.,]+\\s*(?:Billion|Million|Trillion|B|M|T)?)/i);
  if (tamMatch && tamMatch[1]) {
    tamEstimate = `${tamMatch[1].trim()} (Extracted from Analysis)`;
  }

  // Attempt to extract trends from the finalAnalysis or maybe activities/sources if structured
  // This part is highly speculative without seeing actual output
  const trends: string[] = [];
  const trendMatches = analysisText.match(/Key trends include:.*?([\\n\\*\\-•][\\s\\S]*)+/i);
  if (trendMatches && trendMatches[0]) {
    const listItems = trendMatches[0].match(/^[\\*\\-•]\\s+(.*)/gm);
    if (listItems) {
        trends.push(...listItems.map(t => t.replace(/^[\\*\\-•]\\s+/, '').trim() + ' (Extracted from Analysis)'));
    }
  } else {
      // Fallback: Maybe trends are listed in bullet points anywhere?
      const genericListItems = analysisText.match(/^[\*\-•]\s+(.*)/gm);
      if (genericListItems) {
          // Be cautious with generic lists
          // trends.push(...genericListItems.map(t => t.replace(/^[\*\-•]\s+/, '').trim() + ' (Extracted Generic)'));
      }
  }


  if (!tamEstimate && trends.length === 0) {
    console.warn("Could not extract TAM or Trends from Firecrawl /deep-research response.");
    tamEstimate = "Parsing Failed";
    trends.push("Parsing Failed");
  }
  return { tamEstimate, trends };
}

// Starts the deep research job
export async function startDeepResearch(keywords: string[]): Promise<string> { // Returns jobId
  if (!firecrawlApiKey) {
    throw new Error('FIRECRAWL_API_KEY not set. Cannot start deep research.');
  }
  const query = `Market analysis and trends for technology related to: ${keywords.join(', ')}`;
  const researchUrl = `${firecrawlApiBaseUrl}/deep-research`;
  console.log(`Starting Firecrawl Deep Research (${researchUrl}) with query: ${query}`);

  try {
    const response = await axios.post<FirecrawlStartResearchResponse>(
      researchUrl,
      {
        query: query,
        // Firecrawl expects these options at the **root** level – not nested – per the v1 Deep Research API docs.
        maxDepth: 7,          // optional – default is 7, override if you need fewer/greater iterations
        timeLimit: 270,       // optional – seconds (30-300)
        maxUrls: 20           // optional – default is 20
      },
      {
        headers: {
          Authorization: `Bearer ${firecrawlApiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000, // Timeout for starting the job
      }
    );

    // Firecrawl API (v1 alpha) sometimes returns the job identifier as `id` instead of `jobId`.
    const jobId = (response.data as any).jobId || (response.data as any).id;

    if (response.data.success && jobId) {
      console.log(`Firecrawl deep research job started successfully. Job ID: ${jobId}`);
      return jobId;
    }

    // If success is true but the identifier field is unexpectedly nested (e.g. response.data.data.id)
    if ((response.data as any).data?.id) {
      const nestedId = (response.data as any).data.id;
      console.log(`Firecrawl deep research job started – found nested id: ${nestedId}`);
      return nestedId;
    }

    console.error('Failed to start Firecrawl /deep-research job – unexpected response shape:', response.data);
    throw new Error(`Failed to start Firecrawl deep research: ${response.data?.error || 'Unknown error'}`);
  } catch (error: any) {
    console.error('Error starting Firecrawl /deep-research job:', error.message);
    if (axios.isAxiosError(error)) {
      console.error('Axios Error Details:', { status: error.response?.status, data: error.response?.data });
    }
    throw new Error(`Failed to start Firecrawl /deep-research job: ${error.message}`);
  }
}

// Checks the status of a deep research job
export async function checkDeepResearchStatus(jobId: string): Promise<FirecrawlCheckStatusResponse> {
    if (!firecrawlApiKey) {
        throw new Error('FIRECRAWL_API_KEY not set. Cannot check deep research status.');
    }
    const statusUrl = `${firecrawlApiBaseUrl}/deep-research/${jobId}`;
    // console.log(`Checking Firecrawl Deep Research status (${statusUrl})`); // Reduce log noise

    try {
        const response = await axios.get<FirecrawlCheckStatusResponse>(statusUrl, {
            headers: {
                Authorization: `Bearer ${firecrawlApiKey}`,
                'Content-Type': 'application/json',
            },
            timeout: 15000, // Timeout for status check
        });

        // Return the full response including status and data if present
        return response.data;

    } catch (error: any) {
        console.error(`Error checking Firecrawl job status for ${jobId}:`, error.message);
        if (axios.isAxiosError(error)) {
            console.error('Axios Error Details:', { status: error.response?.status, data: error.response?.data });
            // Handle specific errors like 404 if the job ID is invalid or expired
            if (error.response?.status === 404) {
                return { success: false, status: 'failed', message: 'Job not found or expired.' };
            }
        }
        // Return a generic failure status for other errors
        return { success: false, status: 'failed', message: `Failed to check job status: ${error.message}` };
    }
}

// Renamed from searchMarket to getDeepResearchResult (internal helper for API route)
export async function getDeepResearchResult(keywords: string[], pollIntervalMs = 5000, maxWaitMs = 180000): Promise<MarketData> {
    const jobId = await startDeepResearch(keywords);
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
        console.log(`Polling Firecrawl job ${jobId}...`);
        const statusResponse = await checkDeepResearchStatus(jobId);

        if (statusResponse.success) {
            if (statusResponse.status === 'completed') {
                console.log(`Firecrawl job ${jobId} completed.`);
                // Return the raw final analysis; higher level will parse via Gemini for structured data
                return {
                    tamEstimate: null,
                    trends: [],
                    // @ts-ignore – include raw text for downstream processing
                    rawAnalysis: statusResponse.data?.finalAnalysis ?? ''
                } as any;
            } else if (statusResponse.status === 'failed') {
                console.error(`Firecrawl job ${jobId} failed:`, statusResponse.message);
                throw new Error(`Firecrawl deep research job failed: ${statusResponse.message || 'Unknown reason'}`);
            } else {
                // Status is 'processing' or 'queued', wait and poll again
                console.log(`Job status: ${statusResponse.status}. Waiting ${pollIntervalMs}ms...`);
            }
        } else {
            // checkDeepResearchStatus itself failed
            console.error(`Failed to get status for Firecrawl job ${jobId}:`, statusResponse.message);
            throw new Error(`Failed to get status for Firecrawl job ${jobId}: ${statusResponse.message || 'Network or API error'}`);
        }

        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    // Timeout exceeded
    console.error(`Timeout waiting for Firecrawl job ${jobId} to complete.`);
    throw new Error(`Timeout waiting for Firecrawl deep research job ${jobId}`);
}

// --- URL Scraping (for PDF text) --- //

interface FirecrawlScrapeResponse {
  success: boolean;
  data?: {
    content: string; // The main content scraped from the page (can be markdown or text)
    markdown?: string;
    metadata?: Record<string, any>;
  };
  error?: string;
}

export async function scrapeUrl(url: string): Promise<string> {
  if (!firecrawlApiKey) {
    console.warn('FIRECRAWL_API_KEY not set. Skipping Firecrawl URL scrape.');
    return "PDF Text Not Available (No API Key)";
  }

  const scrapeUrl = `${firecrawlApiBaseUrl}/scrape`;
  console.log(`Calling Firecrawl Scrape (${scrapeUrl}) for URL: ${url}`);

  try {
    const response = await axios.post<FirecrawlScrapeResponse>(
      scrapeUrl,
      {
        url: url,
        // Explicitly request markdown format only (default) and extend Firecrawl timeout to 60s
        timeout: 60000,
      },
      {
        headers: {
          Authorization: `Bearer ${firecrawlApiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 120000, // allow big PDFs
      }
    );

    // Check for markdown field instead of content for v1 scrape success
    if (response.data.success && response.data.data?.markdown) {
      console.log("Firecrawl scrape successful (using markdown).");
      // Return the markdown content
      return response.data.data.markdown;
    } else {
      // Log the actual response if the expected data isn't found
      console.error('Firecrawl /scrape API call failed or missing markdown:', response.data);
      throw new Error(`Firecrawl scrape failed: ${response.data.error || 'No markdown content returned'}`);
    }
  } catch (error: any) {
    console.error('Error calling Firecrawl /scrape API:', error.message);
    throw new Error(`Failed to fetch data from Firecrawl /scrape: ${error.message}`);
  }
} 