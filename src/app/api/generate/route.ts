import { NextRequest, NextResponse } from 'next/server';
import { InvestmentReport, IntermediateData, StartupIdea } from '@/lib/types';
import { fetchMetadata } from '@/lib/arxiv';
import { extractCoreInsight, craftStartupIdea, generateInvestmentReport } from '@/lib/gemini';
import { getDeepResearchResult, scrapeUrl } from '@/lib/firecrawl';
import { extractMarketData, extractCompetitorData, extractExecutionPlan, extractFundingPlan, ensureMarketNumbers, enrichCompetitorNumbers, ensureCompetitors } from '@/lib/gemini';

// export const runtime = 'edge'; // Removed edge runtime - incompatible with pdf-parse

export async function POST(req: NextRequest) {
  // 1. Rate Limiting
  // const rateLimitResponse = await checkRateLimit(req);
  // if (rateLimitResponse) {
  //   return rateLimitResponse;
  // }

  try {
    // 2. Parse Request Body
    const body = await req.json();
    const { arxivUrl: originalArxivUrl } = body;

    if (!originalArxivUrl || typeof originalArxivUrl !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid arxivUrl' }, { status: 400 });
    }

    console.log(`[PaperChase] Processing arXiv URL: ${originalArxivUrl}`);

    // 3a: Fetch Metadata (Title, Authors, ID)
    console.time('[PaperChase] Step 3a: fetchMetadata');
    const { title, authors, arxivId } = await fetchMetadata(originalArxivUrl);
    console.timeEnd('[PaperChase] Step 3a: fetchMetadata');

    if (!arxivId) {
        // If ID extraction failed in fetchMetadata, we can't proceed
        return NextResponse.json({ error: 'Could not extract valid arXiv ID from URL.', details: `URL: ${originalArxivUrl}` }, { status: 400 });
    }
    console.log(`[PaperChase] Fetched Metadata: ${title} by ${authors.join(', ') || 'N/A'} (ID: ${arxivId})`);

    // 3b: Fetch PDF Text via Firecrawl Scrape
    const pdfUrl = `https://arxiv.org/pdf/${arxivId}.pdf`; // Construct PDF URL
    console.time('[PaperChase] Step 3b: scrapeUrl (Firecrawl)');
    const pdfText = await scrapeUrl(pdfUrl);
    console.timeEnd('[PaperChase] Step 3b: scrapeUrl (Firecrawl)');
    console.log(`[PaperChase] Scraped PDF text (${pdfText.length} chars)`);

    // 4. Gemini Call 1: Extract Core Insight
    console.time('[PaperChase] Step 4: extractCoreInsight');
    const coreInsight = await extractCoreInsight(pdfText);
    console.timeEnd('[PaperChase] Step 4: extractCoreInsight');
    console.log('[PaperChase] Extracted Core Insight:', coreInsight);

    // 5. Fan-out: Market Research & Competitor Analysis
    console.time('[PaperChase] Step 5: Market/Competitor Fan-out');
    console.log('[PaperChase] Starting Deep Research (Firecrawl) & Competitor Analysis (Apify)...');
    const firecrawlRawMarket = await getDeepResearchResult(coreInsight.keywords);

    // Parse both market and competitor info from the same analysis text
    const analysisText = (firecrawlRawMarket as any).rawAnalysis || '';

    let marketData = await extractMarketData(analysisText);
    marketData = await ensureMarketNumbers(analysisText, marketData);

    let competitorData = await extractCompetitorData(analysisText);
    competitorData = await ensureCompetitors(analysisText, competitorData);
    competitorData.competitors = await enrichCompetitorNumbers(competitorData.competitors);

    const executionPlan = await extractExecutionPlan(analysisText);
    const fundingPlan = await extractFundingPlan(analysisText);

    console.timeEnd('[PaperChase] Step 5: Market/Competitor Fan-out');
    console.log('[PaperChase] Market Data (Firecrawl /deep-research):', marketData);
    console.log('[PaperChase] Competitor Data (Apify):', competitorData);

    // 6. Prepare Intermediate Data for next Gemini call
    let intermediateData: Omit<IntermediateData, 'startupIdea'> = {
      title,
      authors,
      arxivUrl: originalArxivUrl, // Use the URL provided by the user
      ...coreInsight,
      marketAnalysis: marketData,
      competitiveLandscape: competitorData,
    };

    // 7. Gemini Call 2: Craft Startup Idea
    console.time('[PaperChase] Step 7: craftStartupIdea');
    const generatedStartupIdea = await craftStartupIdea(intermediateData);
    console.timeEnd('[PaperChase] Step 7: craftStartupIdea');
    console.log('[PaperChase] Crafted Startup Idea:', generatedStartupIdea);

    if (!generatedStartupIdea?.solution) {
      console.error("[PaperChase] Failed to generate valid startup idea details.");
      throw new Error("Core startup idea generation failed.");
    }

    // Assign the validated startup idea to the intermediate data structure
    const fullContext: IntermediateData = {
      ...intermediateData,
      startupIdea: generatedStartupIdea, // Assign to the optional field
    };

    // Type guard to ensure startupIdea is now defined for subsequent steps
    if (!fullContext.startupIdea) {
        throw new Error("Startup idea missing after assignment - unexpected error.");
    }

    // 8. Gemini Call 3: Generate Investment Report (Thesis part)
    console.time('[PaperChase] Step 8: generateInvestmentReport');
    // Pass the complete context (now guaranteed to have startupIdea)
    const investmentThesis = await generateInvestmentReport(fullContext);
    console.timeEnd('[PaperChase] Step 8: generateInvestmentReport');
    console.log('[PaperChase] Generated Investment Thesis:', investmentThesis);

    // 9. Construct Final Report Object
    // Type assertion is safe here because fullContext includes a validated startupIdea
    const investmentReport: InvestmentReport = {
      ...fullContext,
      ...fullContext.startupIdea,
      investmentThesis,
      executionPlan,
      fundingPlan,
    };
    console.log('[PaperChase] Final Investment Report Constructed');

    // 10. Respond with the report
    return NextResponse.json(investmentReport);

  } catch (error) {
    console.error("[PaperChase] Error in /api/generate:", error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    // Provide more detail in the server log
    console.error(`[PaperChase] Failed processing: ${errorMessage}`, error);
    return NextResponse.json({ error: 'Failed to generate investment report.', details: errorMessage }, { status: 500 });
  }
} 