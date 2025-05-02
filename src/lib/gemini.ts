import OpenAI from 'openai';
import {
  CoreInsight,
  IntermediateData,
  InvestmentThesis,
  StartupIdea,
  MarketData
} from './types';

const geminiApiKey = process.env.GEMINI_API_KEY;

if (!geminiApiKey) {
  console.warn('GEMINI_API_KEY is not set. Gemini calls will fail.');
  // You might want to throw an error here in production
  // throw new Error('Missing GEMINI_API_KEY environment variable');
}

// Configure the OpenAI client to point to the OpenRouter endpoint
const gemini = new OpenAI({
  apiKey: geminiApiKey,
  baseURL: 'https://openrouter.ai/api/v1', // OpenRouter endpoint
  defaultHeaders: {
    'HTTP-Referer': 'https://paperchase.local', // comply with OpenRouter policy (dummy)
    'X-Title': 'PaperChase',
  },
});

// Use OpenRouter ticker for Gemini 2.5 preview
const MODEL_NAME = 'google/gemini-2.5-pro-preview-03-25';

// --- Function Call Definitions (using OpenAI format for Gemini Tool/Function Calling) ---

const extractCoreInsightTool = {
  type: 'function' as const, // Add 'as const' for stricter typing
  function: {
    name: 'extractCoreInsight',
    description: 'Extracts the core problem, innovation, and keywords from a research paper abstract or text.',
    parameters: {
      type: 'object' as const,
      properties: {
        problem: {
          type: 'string' as const,
          description: 'A concise description of the core problem the research addresses.'
        },
        innovation: {
          type: 'string' as const,
          description: 'A concise description of the key innovation, finding, or method proposed.'
        },
        keywords: {
          type: 'array' as const,
          items: { type: 'string' as const },
          description: 'A list of 3-5 keywords relevant for market research and competitor analysis.'
        },
      },
      required: ['problem', 'innovation', 'keywords'],
    },
  },
};

const craftStartupIdeaTool = {
  type: 'function' as const,
  function: {
    name: 'craftStartupIdea',
    description: 'Develops a potential startup concept based on research insights, market data, and competitor analysis.',
    parameters: {
      type: 'object' as const,
      properties: {
        solution: {
          type: 'string' as const,
          description: 'A description of the proposed product or service leveraging the research innovation.'
        },
        businessModel: {
          type: 'string' as const,
          description: 'How the potential startup plans to generate revenue.'
        },
        valueProposition: {
          type: 'string' as const,
          description: 'The unique value the startup offers to its target customers.'
        },
        go_to_market: {
          type: 'string' as const,
          description: 'A brief outline of the initial go-to-market strategy.'
        }
      },
      required: ['solution', 'businessModel', 'valueProposition', 'go_to_market'],
    },
  },
};

const generateInvestmentReportTool = {
  type: 'function' as const,
  function: {
    name: 'generateInvestmentReport',
    description: 'Generates the core sections of a VC-style investment thesis based on the provided context.',
    parameters: {
      type: 'object' as const,
      properties: {
        executiveSummary: { type: 'string' as const, description: 'A high-level overview for the investor (2-3 sentences).' },
        teamAssessment: { type: 'string' as const, description: 'Brief assessment of the founding team (based on paper authors). Assume potential, highlight expertise area.' },
        marketOpportunity: { type: 'string' as const, description: 'Analysis of TAM and market trends.' },
        productStrategy: { type: 'string' as const, description: 'Evaluation of the proposed solution and its fit.' },
        competitiveAdvantages: { type: 'string' as const, description: 'Analysis of what makes this idea stand out against competitors.' },
        risks: { type: 'array' as const, items: { type: 'string' as const }, description: 'List of potential key risks (market, technical, execution).' },
        fundingRecommendation: { type: 'string' as const, description: 'A concluding sentence with a recommendation (e.g., \"Seed stage investment recommended\", \"Further validation needed\").' }
      },
      required: ['executiveSummary', 'teamAssessment', 'marketOpportunity', 'productStrategy', 'competitiveAdvantages', 'risks', 'fundingRecommendation']
    }
  }
};

// --- API Call Functions ---

async function callGeminiWithRetry<T>(options: OpenAI.ChatCompletionCreateParamsNonStreaming, maxRetries = 3): Promise<T> {
  if (!geminiApiKey) {
    throw new Error("Gemini API key not configured. Cannot make API calls.");
  }

  let attempts = 0;
  while (attempts < maxRetries) {
    try {
      console.log(`Attempt ${attempts + 1}: Calling Gemini model ${options.model}...`);
      const completion = await gemini.chat.completions.create({
        ...options,
        // Ensure top_p is set if required by your logic, otherwise use defaults
        // top_p: 1, // Example: setting top_p if needed
        // temperature: 0.7, // Example: setting temperature if needed
      });

      const toolCalls = completion.choices[0]?.message?.tool_calls;
      if (!toolCalls || toolCalls.length === 0 || !toolCalls[0].function.arguments) {
        console.error('Gemini response missing tool calls or arguments:', completion.choices[0]?.message);
        throw new Error('Invalid response format from Gemini: Missing tool call arguments.');
      }

      // Assuming only one tool call is expected per request based on our design
      const functionArgs = toolCalls[0].function.arguments;
      console.log("Gemini Raw Arguments:", functionArgs);

      try {
        // Attempt to parse potentially malformed JSON
        const correctedJsonString = functionArgs
          .replace(/\n/g, "\\n") // Escape newlines within strings
          .replace(/\t/g, "\\t"); // Escape tabs within strings

        const parsedArgs = JSON.parse(correctedJsonString) as T;
        console.log("Gemini Parsed Arguments:", parsedArgs);
        return parsedArgs;
      } catch (parseError) {
        console.error("Failed to parse Gemini function arguments JSON:", parseError);
        console.error("Raw arguments string:", functionArgs);
        throw new Error(`Failed to parse JSON arguments from Gemini: ${parseError}`);
      }

    } catch (error: any) {
      attempts++;
      console.error(`Gemini API call failed (Attempt ${attempts}/${maxRetries}):`, error.message);
      // If 429, apply exponential backoff up to 5 seconds per attempt
      const isRateLimit = (error as any)?.status === 429;
      const delay = isRateLimit ? Math.min(5000, 500 * 2 ** attempts) : 1000 * attempts;
      if (attempts >= maxRetries) {
        console.error("Max retries reached. Giving up.");
        throw error;
      }
      await new Promise(res => setTimeout(res, delay));
    }
  }
  // Should not be reachable if maxRetries > 0, but satisfies TypeScript
  throw new Error("Gemini call failed after multiple retries.");
}


export async function extractCoreInsight(pdfText: string): Promise<CoreInsight> {
  console.log("Calling Gemini (extractCoreInsight)... First 500 chars:", pdfText.substring(0, 500));
  const systemPrompt = `You are a PhD-level research analyst specializing in identifying the core essence of scientific papers. 
  Analyze the following research paper text and extract the fundamental problem it addresses, its key innovation/finding, and relevant keywords for market analysis. 
  Focus on the most critical aspects suitable for evaluating startup potential.`;

  return callGeminiWithRetry<CoreInsight>({
    model: MODEL_NAME,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Paper Text: ${pdfText}` },
    ],
    tools: [extractCoreInsightTool],
    tool_choice: { type: 'function', function: { name: 'extractCoreInsight' } }, // Force the specific tool
  });
}

export async function craftStartupIdea(context: Partial<IntermediateData>): Promise<StartupIdea> {
  console.log("Calling Gemini (craftStartupIdea) with context:", context);
  const systemPrompt = `You are a Venture Capital (VC) analyst with deep expertise in identifying and formulating startup ideas from raw research and market data. 
  Based on the provided research summary (problem, innovation), market analysis (TAM, trends), and competitive landscape, devise a viable startup concept. 
  Define the core solution, a plausible business model, a clear value proposition, and an initial go-to-market strategy. Focus on practical and potentially fundable ideas.`;

  return callGeminiWithRetry<StartupIdea>({
    model: MODEL_NAME,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Context: ${JSON.stringify(context, null, 2)}` }, // Send the full context
    ],
    tools: [craftStartupIdeaTool],
    tool_choice: { type: 'function', function: { name: 'craftStartupIdea' } },
  });
}

export async function generateInvestmentReport(context: IntermediateData): Promise<InvestmentThesis> {
  console.log("Calling Gemini (generateInvestmentReport) with context:", context);
  const systemPrompt = `You are a seasoned VC Principal writing an internal investment memo (thesis section). 
  Synthesize all the provided information (research basis, market data, competitive landscape, startup idea) into a concise and compelling investment thesis. 
  Cover the executive summary, team (use authors as proxy), market opportunity, product strategy, competitive advantages, risks, and a funding recommendation. 
  Adopt a critical but constructive tone suitable for an investment committee.`;

  return callGeminiWithRetry<InvestmentThesis>({
    model: MODEL_NAME,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Full Context: ${JSON.stringify(context, null, 2)}` },
    ],
    tools: [generateInvestmentReportTool],
    tool_choice: { type: 'function', function: { name: 'generateInvestmentReport' } },
  });
}

// Function: extract_market_data
// Returns TAM estimate and market trends extracted from a block of analysis text.
export async function extractMarketData(researchAnalysis: string): Promise<MarketData> {
  if (!gemini) throw new Error('Gemini client not initialized');

  if (!researchAnalysis || researchAnalysis.trim().length === 0) {
    return { tamEstimate: null, trends: [] };
  }

  const functionSchema = {
    name: 'extract_market_data',
    description: 'Extract key market data such as TAM estimate and major trends from a research analysis text.',
    parameters: {
      type: 'object',
      properties: {
        tamEstimate: {
          type: 'string',
          nullable: true,
          description: 'Numeric TAM estimate including currency symbol and scale, e.g. "$10B". Return null if not found.',
        },
        tamSegments: {
          type: 'array',
          nullable: true,
          description: 'Optional breakdown of TAM by segments (geography, vertical, etc.).',
          items: {
            type: 'object',
            properties: {
              segment: { type: 'string' },
              valueUSD: { type: 'number' }
            },
            required: ['segment','valueUSD']
          }
        },
        trends: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of concise market trend statements.',
        },
        yearlyTAM: {
          type: 'array',
          nullable: true,
          description: 'Year-by-year TAM estimates for next 5 years',
          items: {
            type: 'object',
            properties: {
              year: { type: 'number' },
              valueUSD: { type: 'number' }
            },
            required: ['year','valueUSD']
          }
        },
        cagrPercent: { type: 'number', nullable: true, description: '5-year compound annual growth rate percentage' },
      },
      required: ['tamEstimate', 'trends'],
    },
  } as const;

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content:
        'You are an analyst extracting total addressable market (TAM) estimates and key market trends from research reports. When the information is missing, return null for tamEstimate or an empty array for trends.',
    },
    {
      role: 'user',
      content: researchAnalysis.slice(0, 20000), // Cap input length to avoid very large prompts
    },
  ];

  const completion = await callGeminiWithRetry<{ tamEstimate: string | null; trends: string[]; tamSegments?: {segment:string; valueUSD:number}[] }>({
    model: MODEL_NAME,
    temperature: 0,
    messages,
    tools: [{ type: 'function', function: functionSchema }],
    tool_choice: { type: 'function', function: { name: functionSchema.name } },
  });

  return {
    tamEstimate: (completion as any).tamEstimate ?? null,
    trends: (completion as any).trends ?? [],
    tamSegments: (completion as any).tamSegments ?? undefined,
    yearlyTAM: (completion as any).yearlyTAM ?? undefined,
    cagrPercent: (completion as any).cagrPercent ?? null,
  };
}

// Function: extract_competitor_data
export async function extractCompetitorData(researchAnalysis: string): Promise<import('./types').CompetitorData> {
  if (!gemini) throw new Error('Gemini client not initialized');

  if (!researchAnalysis || researchAnalysis.trim().length === 0) {
    return {
      competitors: [],
      totalFundingUSD: null,
      keyPlayersAnalysis: 'No competitor information found.'
    };
  }

  const functionSchema = {
    name: 'extract_competitor_data',
    description: 'Extract competitor list, total funding and a short analysis from research analysis text.',
    parameters: {
      type: 'object',
      properties: {
        competitors: {
          type: 'array',
          description: 'List of competing companies or projects.',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Competitor name' },
              description: { type: 'string', description: 'Brief description' },
              fundingUSD: { type: 'number', nullable: true, description: 'Funding amount in USD if available' },
              employeeCount: { type: 'number', nullable: true, description: 'Estimated employee count if mentioned' }
            },
            required: ['name', 'description']
          }
        },
        totalFundingUSD: {
          type: 'number',
          nullable: true,
          description: 'Sum of disclosed funding for the listed competitors in USD. Null if unavailable.'
        },
        keyPlayersAnalysis: {
          type: 'string',
          description: 'Concise analysis of the competitive landscape.'
        }
      },
      required: ['competitors', 'totalFundingUSD', 'keyPlayersAnalysis']
    }
  } as const;

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: 'Identify competing companies/projects mentioned or implied in the analysis. Provide a list and summarize the landscape.'
    },
    { role: 'user', content: researchAnalysis.slice(0, 20000) }
  ];

  const response = await gemini.chat.completions.create({
    model: MODEL_NAME,
    temperature: 0,
    messages,
    tools: [{ type: 'function', function: functionSchema }],
    tool_choice: { type: 'function', function: { name: functionSchema.name } },
  });

  const toolCall = response.choices[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error('Gemini did not return competitor tool call');

  const args = JSON.parse(toolCall.function.arguments) as {
    competitors: { name: string; description: string; fundingUSD?: number|null; employeeCount?: number|null }[];
    totalFundingUSD: number | null;
    keyPlayersAnalysis: string;
  };

  return {
    competitors: args.competitors.map(c => ({ name: c.name, description: c.description, fundingUSD: c.fundingUSD ?? null, employeeCount: c.employeeCount ?? null })),
    totalFundingUSD: args.totalFundingUSD,
    keyPlayersAnalysis: args.keyPlayersAnalysis
  };
}

export async function extractExecutionPlan(researchAnalysis: string): Promise<import('./types').ExecutionPlan> {
  const functionSchema = {
    name: 'extract_execution_plan',
    description: 'Generate a phased execution / GTM plan from analysis text',
    parameters: {
      type: 'object',
      properties: {
        targetCustomers: { type: 'string', description: 'Primary ICP / early customers' },
        pricingModel: { type: 'string', description: 'Suggested pricing / revenue model' },
        keyChannels: { type: 'string', description: 'Main GTM / acquisition channels' },
        roadmap: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              phase: { type: 'string' },
              durationMonths: { type: 'number' },
              keyGoals: { type: 'string' }
            },
            required: ['phase','durationMonths','keyGoals']
          }
        }
      },
      required: ['targetCustomers','pricingModel','keyChannels','roadmap']
    }
  } as const;

  const response = await gemini.chat.completions.create({
    model: MODEL_NAME,
    temperature: 0,
    messages:[
      {role:'system',content:'Produce a concise execution plan.'},
      {role:'user',content:researchAnalysis}
    ],
    tools:[{type:'function',function:functionSchema}],
    tool_choice:{type:'function',function:{name:functionSchema.name}}
  });
  const toolCall = response.choices[0]?.message?.tool_calls?.[0];
  if(!toolCall) throw new Error('Gemini exec plan tool call missing');
  return JSON.parse(toolCall.function.arguments);
}

export async function extractFundingPlan(researchAnalysis:string):Promise<import('./types').FundingPlan>{
  const functionSchema={
    name:'extract_funding_plan',
    description:'Create initial funding & hiring plan',
    parameters:{
      type:'object',
      properties:{
        raiseAmountUSD:{type:'number',nullable:true},
        runwayMonths:{type:'number',nullable:true},
        burnEstimateUSDPerMonth:{type:'number',nullable:true},
        teamHiringPlan:{type:'string'},
        useOfFunds:{type:'string'},
        costBreakdown:{type:'array',nullable:true,items:{type:'object',properties:{category:{type:'string'},percent:{type:'number'}},required:['category','percent']}}
      },
      required:['raiseAmountUSD','runwayMonths','burnEstimateUSDPerMonth','teamHiringPlan','useOfFunds']
    }
  } as const;
  const response=await gemini.chat.completions.create({
    model:MODEL_NAME,
    temperature:0,
    messages:[{role:'system',content:'Generate funding & team plan.'},{role:'user',content:researchAnalysis}],
    tools:[{type:'function',function:functionSchema}],
    tool_choice:{type:'function',function:{name:functionSchema.name}}
  });
  const toolCall=response.choices[0]?.message?.tool_calls?.[0];
  if(!toolCall) throw new Error('Funding plan missing');
  return JSON.parse(toolCall.function.arguments);
}

// === NUMERIC ENRICHMENT HELPERS === //

export async function ensureMarketNumbers(researchAnalysis:string, partial:Partial<MarketData>):Promise<MarketData>{
  // If we already have numbers, just return
  if(partial.tamSegments && partial.tamSegments.length>0 && partial.yearlyTAM && partial.yearlyTAM.length>0){
    return partial as MarketData;
  }

  const functionSchema={
    name:'generate_market_numbers',
    description:'Generate plausible numeric TAM breakdown and 5-year growth when real numbers are missing.',
    parameters:{
      type:'object',
      properties:{
        tamEstimate:{type:'string',description:'Overall TAM e.g. "$4B"'},
        tamSegments:{type:'array',items:{type:'object',properties:{segment:{type:'string'},valueUSD:{type:'number'}},required:['segment','valueUSD']},description:'3-5 segment breakdown'},
        yearlyTAM:{type:'array',items:{type:'object',properties:{year:{type:'number'},valueUSD:{type:'number'}},required:['year','valueUSD']},description:'Next 5 years TAM numbers'},
        cagrPercent:{type:'number',description:'5y CAGR'}
      },
      required:['tamEstimate','tamSegments','yearlyTAM','cagrPercent']
    }
  } as const;

  const completion = await callGeminiWithRetry<Omit<MarketData,'trends'>>({
    model: MODEL_NAME,
    temperature: 0.2,
    messages:[
      {role:'system',content:'You are an investment analyst. Provide reasonable estimates even if not available.'},
      {role:'user',content:researchAnalysis.slice(0,15000)}
    ],
    tools:[{type:'function',function:functionSchema}],
    tool_choice:{type:'function',function:{name:functionSchema.name}}
  });

  return {
    ...partial,
    tamEstimate: completion.tamEstimate ?? partial.tamEstimate ?? null,
    tamSegments: completion.tamSegments ?? partial.tamSegments,
    yearlyTAM: completion.yearlyTAM ?? partial.yearlyTAM,
    cagrPercent: completion.cagrPercent ?? partial.cagrPercent ?? null,
    trends: partial.trends ?? []
  } as MarketData;
}

export async function enrichCompetitorNumbers(competitors:import('./types').Competitor[]):Promise<import('./types').Competitor[]>{
  const names=competitors.map(c=>c.name);
  const functionSchema={
    name:'estimate_competitor_numbers',
    description:'Provide rough fundingUSD and employeeCount for given companies if missing',
    parameters:{
      type:'object',
      properties:{
        enriched:{type:'array',items:{type:'object',properties:{name:{type:'string'},fundingUSD:{type:'number'},employeeCount:{type:'number'}},required:['name','fundingUSD','employeeCount']}}
      },
      required:['enriched']
    }
  } as const;

  const completion=await callGeminiWithRetry<{enriched:{name:string;fundingUSD:number;employeeCount:number}[]}>(
    {
      model:MODEL_NAME,
      temperature:0.2,
      messages:[{role:'system',content:'Estimate funding and employee count numbers.'},{role:'user',content:`Companies:\n${names.join('\n')}`}],
      tools:[{type:'function',function:functionSchema}],
      tool_choice:{type:'function',function:{name:functionSchema.name}}
    }
  );

  return competitors.map(c=>{
    const found=completion.enriched.find(e=>e.name.toLowerCase()===c.name.toLowerCase());
    return {...c,fundingUSD:c.fundingUSD??found?.fundingUSD??null,employeeCount:c.employeeCount??found?.employeeCount??null};
  });
}

export async function ensureCompetitors(analysis:string, current:import('./types').CompetitorData, desiredCount=5):Promise<import('./types').CompetitorData>{
  if(current.competitors.length>=desiredCount){
    return current;
  }

  const functionSchema={
    name:'generate_competitor_list',
    description:`Propose ${desiredCount} plausible competing companies/startups for the described market with 1-sentence descriptions`,
    parameters:{
      type:'object',
      properties:{
        competitors:{type:'array',items:{type:'object',properties:{name:{type:'string'},description:{type:'string'}},required:['name','description']}}
      },
      required:['competitors']
    }
  } as const;

  const completion=await callGeminiWithRetry<{competitors:{name:string;description:string}[]}>(
    {
      model:MODEL_NAME,
      temperature:0.3,
      messages:[{role:'system',content:'Generate competitor list.'},{role:'user',content:analysis.slice(0,15000)}],
      tools:[{type:'function',function:functionSchema}],
      tool_choice:{type:'function',function:{name:functionSchema.name}}
    }
  );

  const additional=completion.competitors.slice(0,desiredCount-current.competitors.length).map(c=>({name:c.name,description:c.description,fundingUSD:null,employeeCount:null}));

  return {
    ...current,
    competitors:[...current.competitors,...additional]
  };
}
 