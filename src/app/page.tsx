'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { InvestmentReport } from '@/lib/types'; // Assuming types are defined here
import { motion, AnimatePresence } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';

// Define simple colors
const COLORS = ['#4f46e5', '#16a34a', '#f59e0b', '#ef4444', '#14b8a6'];

type TabKey = 'summary' | 'market' | 'competitors' | 'plan' | 'finance';

export default function HomePage() {
  const [arxivUrl, setArxivUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<InvestmentReport | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('summary');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setReport(null);

    console.log(`Submitting URL: ${arxivUrl}`);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ arxivUrl }),
      });

      console.log(`API Response Status: ${response.status}`);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API Error Data:', errorData);
        throw new Error(errorData.details || `Request failed with status ${response.status}`);
      }

      const data: InvestmentReport = await response.json();
      console.log('API Success Data:', data);
      setReport(data);

    } catch (err: any) {
      console.error('Form submission error:', err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!report) return;
    navigator.clipboard.writeText(JSON.stringify(report, null, 2))
      .then(() => {
        // Optional: Show a success message
        alert('Report JSON copied to clipboard!');
      })
      .catch(err => {
        console.error('Failed to copy:', err);
        alert('Failed to copy report JSON.');
      });
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-6 md:p-12 lg:p-24 bg-gradient-to-br from-zinc-50 to-zinc-200 dark:from-zinc-900 dark:to-zinc-950">
      <Card className="w-full max-w-3xl shadow-lg dark:bg-zinc-900">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center text-zinc-900 dark:text-zinc-100">📄 Paper Chase</CardTitle>
          <CardDescription className="text-center text-zinc-600 dark:text-zinc-400">
            Enter an arXiv paper URL to generate a VC investment report.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
            <Input
              type="url"
              placeholder="https://arxiv.org/abs/... or /pdf/..."
              value={arxivUrl}
              onChange={(e) => setArxivUrl(e.target.value)}
              required
              className="flex-grow dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700"
              disabled={isLoading}
            />
            <Button type="submit" disabled={isLoading} className="min-w-[100px]">
              {isLoading ? (
                <motion.div
                  animate={{
                    rotate: 360,
                    transition: { repeat: Infinity, duration: 1, ease: "linear" }
                  }}
                  style={{ display: 'inline-block' }}
                >
                  💨
                </motion.div>
              ) : (
                'Chase'
              )}
            </Button>
          </form>
          <AnimatePresence>
            {isLoading && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-center mt-4 text-zinc-600 dark:text-zinc-400 flex items-center justify-center gap-1"
              >
                <span>Chasing runaway papers</span>
                <motion.span
                  animate={{
                    opacity: [0.5, 1, 0.5],
                    transition: { repeat: Infinity, duration: 1.5 }
                  }}
                >
                  💨
                </motion.span>
                <motion.span
                  animate={{
                    y: [0, -2, 0],
                    transition: { repeat: Infinity, duration: 0.8, ease: "easeInOut"}
                  }}
                  style={{display: 'inline-block'}}
                >
                  📃
                 </motion.span>
              </motion.div>
            )}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 text-center text-red-600 dark:text-red-500 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-md p-3"
              >
                <strong>Error:</strong> {error}
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      <AnimatePresence>
        {report && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-3xl mt-6"
          >
            <Card className="shadow-lg dark:bg-zinc-900">
              <CardHeader className="flex flex-row justify-between items-start">
                <div>
                  <CardTitle className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Investment Report: {report.title}</CardTitle>
                  <CardDescription className="text-zinc-600 dark:text-zinc-400">Based on: {report.arxivUrl}</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={copyToClipboard}>Copy JSON</Button>
              </CardHeader>
              <CardContent>
                {/* Simple tab controls */}
                <div className="flex gap-2 mb-4">
                  {['summary','market','competitors','plan','finance'].map(k=> (
                    <Button key={k} variant={activeTab===k? 'default':'outline'} size="sm" onClick={()=>setActiveTab(k as TabKey)}>{k.charAt(0).toUpperCase()+k.slice(1)}</Button>
                  ))}
                </div>

                {activeTab==='summary' && (
                  <div className="space-y-4">
                    <ReportSection title="Executive Summary" content={report.investmentThesis.executiveSummary} />
                    <ReportSection title="Research Basis" content={`Problem: ${report.problem}\nInnovation: ${report.innovation}`} />
                    <ReportSection title="Solution" content={report.solution} />
                    <ReportSection title="Value Proposition" content={report.valueProposition} />
                  </div>
                )}

                {activeTab==='market' && (
                  <div className="space-y-4">
                    <ReportSection title="Market Overview" content={`TAM: ${report.marketAnalysis.tamEstimate || 'N/A'}\nTrends: ${report.marketAnalysis.trends.join(', ') || 'N/A'}`} />
                    {report.marketAnalysis.tamSegments && (
                      <ChartBlock title="TAM Breakdown">
                        <ResponsiveContainer width="100%" height={260}>
                          <PieChart>
                            <Pie data={report.marketAnalysis.tamSegments} dataKey="valueUSD" nameKey="segment" outerRadius={100} label>
                              {report.marketAnalysis.tamSegments.map((_,idx)=><Cell key={idx} fill={COLORS[idx%COLORS.length]}/>)}
                            </Pie>
                            <Tooltip formatter={(v:number)=>`$${v.toLocaleString()}`}/>
                          </PieChart>
                        </ResponsiveContainer>
                      </ChartBlock>
                    )}
                    {report.marketAnalysis.yearlyTAM && (
                      <ChartBlock title="TAM Growth (proj.)">
                        <ResponsiveContainer width="100%" height={260}>
                          <LineChart data={report.marketAnalysis.yearlyTAM}>
                            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2}/>
                            <XAxis dataKey="year"/>
                            <YAxis tickFormatter={v=>`$${(v/1e9).toFixed(0)}B`}/>
                            <Tooltip formatter={(v:number)=>`$${v.toLocaleString()}`}/>
                            <Line type="monotone" dataKey="valueUSD" stroke="#4f46e5" />
                          </LineChart>
                        </ResponsiveContainer>
                      </ChartBlock>
                    )}
                  </div>
                )}

                {activeTab==='competitors' && (
                  <div className="space-y-4">
                    <ReportSection title="Landscape Summary" content={report.competitiveLandscape.keyPlayersAnalysis} />
                    <ChartBlock title="Funding by Competitor">
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={report.competitiveLandscape.competitors.filter(c=>c.fundingUSD)} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2}/>
                          <XAxis type="number" tickFormatter={v=>`$${(v/1e6).toFixed(0)}M`}/>
                          <YAxis dataKey="name" type="category" width={120}/>
                          <Tooltip formatter={(v:number)=>`$${v.toLocaleString()}`}/>
                          <Bar dataKey="fundingUSD" fill="#16a34a" />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartBlock>
                  </div>
                )}

                {activeTab==='plan' && (
                  <div className="space-y-4">
                    <ReportSection title="Execution Plan" content={
                      report.executionPlan.roadmap.map(p=>`• ${p.phase} (${p.durationMonths}mo): ${p.keyGoals}`).join('\n')
                    } />
                  </div>
                )}

                {activeTab==='finance' && (
                  <div className="space-y-4">
                    <ReportSection title="Funding Plan" content={`Raise: $${report.fundingPlan.raiseAmountUSD?.toLocaleString()}\nBurn: $${report.fundingPlan.burnEstimateUSDPerMonth?.toLocaleString()}/mo\nRunway: ${report.fundingPlan.runwayMonths} mo`} />
                    {report.fundingPlan.costBreakdown && (
                      <ChartBlock title="Use of Funds">
                        <ResponsiveContainer width="100%" height={260}>
                          <PieChart>
                            <Pie data={report.fundingPlan.costBreakdown} dataKey="percent" nameKey="category" innerRadius={40} outerRadius={80} label>
                              {report.fundingPlan.costBreakdown.map((_,idx)=><Cell key={idx} fill={COLORS[idx%COLORS.length]}/>)}
                            </Pie>
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </ChartBlock>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

    </main>
  );
}

// Helper component to render report sections
interface ReportSectionProps {
  title: string;
  content: string | React.ReactNode;
  isLast?: boolean;
}

function ReportSection({ title, content, isLast = false }: ReportSectionProps) {
  return (
    <div className={`py-3 ${!isLast ? 'border-b border-zinc-200 dark:border-zinc-700' : ''}`}>
      <h3 className="text-md font-semibold mb-1 text-zinc-800 dark:text-zinc-200">{title}</h3>
      {typeof content === 'string' ? (
        <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">{content}</p>
      ) : (
        content
      )}
    </div>
  );
}

// Simple wrapper for charts with a title
function ChartBlock({title, children}:{title:string; children:React.ReactNode}){
  return (
    <div className="mb-6">
      <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">{title}</h4>
      {children}
    </div>
  );
}
