# Paper Chase 📄💨

Ingests an arXiv PDF URL and generates a VC-style investment report.

(Summary ➜ Market ➜ Competitors ➜ Startup Concept ➜ Investment Thesis)

## Tech Stack

*   **Framework:** Next.js (App Router)
*   **Language:** TypeScript
*   **Styling:** Tailwind CSS
*   **UI Components:** Shadcn UI
*   **Animations:** Framer Motion
*   **API Runtime:** Vercel Edge Functions

## External Services

*   **AI:** Google Gemini 2.5 Pro (via OpenAI SDK compatibility layer)
*   **Market Research:** Firecrawl (`/deep-research` endpoint)
*   **Competitor Analysis:** Apify (Crunchbase Actor: `curious_coder/crunchbase-scraper`)
*   **PDF Ingestion:** arXiv API + `pdf-parse` + guMCP

## Getting Started

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd paperchase
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up environment variables:**
    Create a `.env.local` file in the root directory by copying the example below. Obtain the necessary API keys and tokens:

    ```env
    # .env.local

    # Google AI Studio API Key for Gemini access (https://aistudio.google.com/app/apikey)
    GEMINI_API_KEY=

    # Firecrawl API Key (https://firecrawl.dev/)
    FIRECRAWL_API_KEY=

    # Apify API Token (https://console.apify.com/account/integrations)
    APIFY_TOKEN=
    ```

4.  **Run the development server:**
```bash
npm run dev
```

5.  Open [http://localhost:3000](http://localhost:3000) in your browser.

6.  Paste an arXiv URL (e.g., `https://arxiv.org/abs/2303.10130` or `https://arxiv.org/pdf/2401.08406.pdf`) and click "Chase".

## API Endpoint (`/api/generate`)

*   **Method:** POST
*   **Body:** `{ "arxivUrl": "<string>" }`
*   **Output:** JSON representing the `InvestmentReport` (see `src/lib/types.ts`).

## TODOs / Future Enhancements

*   Implement more robust parsing for Firecrawl markdown output.
*   Refine Apify Crunchbase Actor input/output mapping for better competitor data.
*   Consider adding a Gemini call to *analyze* the competitor list from Apify.
*   Add more sophisticated loading states (e.g., progress indicators for different steps).
*   Improve error handling and user feedback.
*   Add unit/integration tests.
*   Implement diagram generation using VizCom or similar (original idea).
*   Add authentication.
*   Deploy to Vercel.
