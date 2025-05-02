// Define core data structures for the application

// Output from the first Gemini call
export interface CoreInsight {
  problem: string;        // The core problem the research addresses
  innovation: string;     // The key innovation or finding
  keywords: string[];     // Keywords for market/competitor search
}

// Output from Firecrawl deep research
export interface MarketData {
  tamEstimate: string | null; // Total Addressable Market estimate (e.g., "$10B")
  tamSegments?: TAMSegment[]; // Optional breakdown (e.g., by geography or vertical)
  yearlyTAM?: TAMYear[];      // Yearly TAM estimates for growth chart
  cagrPercent?: number | null;// 5-year CAGR percentage
  trends: string[];          // Key market trends
  // citations?: any[];      // We might not use citations directly in the report
}

// Output from Apify Crunchbase Actor
export interface Competitor {
  name: string;
  description: string | null; // Company description
  fundingUSD?: number | null; // Disclosed funding amount
  employeeCount?: number | null; // Team size estimate
  // Add other relevant fields like website, funding, etc. if needed
}

export interface CompetitorData {
  competitors: Competitor[];
  totalFundingUSD: number | null; // Total funding for listed competitors
  keyPlayersAnalysis: string;     // Gemini's summary/analysis of key players
}

// Output from the second Gemini call
export interface StartupIdea {
  solution: string;           // Proposed product/service based on the innovation
  businessModel: string;      // How the startup makes money
  valueProposition: string;   // Unique value offered to customers
  go_to_market: string; // GTM strategy
}

// Output from the third Gemini call (Investment Thesis part)
export interface InvestmentThesis {
  executiveSummary: string;  // High-level overview for the investor
  teamAssessment: string;    // Analysis of the founding team (based on authors)
  marketOpportunity: string; // Analysis of TAM and trends
  productStrategy: string;   // Evaluation of the proposed solution
  competitiveAdvantages: string; // What makes this idea stand out
  risks: string[];           // Potential risks and challenges
  fundingRecommendation: string; // Recommendation (e.g., "Seed stage investment recommended")
}

// Combined data structure passed between steps and for the final report
export interface IntermediateData extends CoreInsight {
  title: string;
  authors: string[];
  arxivUrl: string;
  marketAnalysis: MarketData;
  competitiveLandscape: CompetitorData;
  startupIdea?: StartupIdea; // Optional until step 4 completes
}

// --- New richer planning sections --- //

export interface ExecutionPlanPhase {
  phase: string;          // e.g. "MVP", "Early Adopters", "Scale"
  durationMonths: number; // estimated length
  keyGoals: string;       // high-level goals/KPIs
}

export interface ExecutionPlan {
  targetCustomers: string;      // Primary ICP / personas
  pricingModel: string;         // Suggested pricing / revenue model
  keyChannels: string;          // Main GTM channels
  roadmap: ExecutionPlanPhase[];// phased roadmap
}

export interface FundingPlan {
  raiseAmountUSD: number | null;      // Suggested amount to raise
  runwayMonths: number | null;        // Runway target
  burnEstimateUSDPerMonth: number | null; // Estimated burn
  teamHiringPlan: string;             // Key hires
  useOfFunds: string;                 // Allocation summary
  costBreakdown?: CostAllocation[];   // Percent allocation for pie chart
}

// Final structure for the API response and UI rendering
export interface InvestmentReport extends IntermediateData, StartupIdea {
  investmentThesis: InvestmentThesis;
  executionPlan: ExecutionPlan;
  fundingPlan: FundingPlan;
  // diagramUrl?: string; // Optional: field for diagram if we add it later
}

export interface TAMSegment {
  segment: string;       // Name of the segment (e.g., "North America", "Healthcare")
  valueUSD: number;      // Size of the segment in USD
}

export interface TAMYear {
  year: number;    // e.g., 2024
  valueUSD: number;// TAM size that year
}

export interface CostAllocation {
  category: string; // R&D, GTM, Ops, etc.
  percent: number;  // 0-100
} 