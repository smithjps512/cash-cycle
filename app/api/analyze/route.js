export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "claude-sonnet-4-5";

function buildPrompt({ ticker, today, sellByDate, holdBusinessDays }) {
  return `Analyze the stock ticker ${ticker} for a SHORT-TERM HOLD strategy.

Context:
- Purchase date: ${today}
- Target sell date: ${sellByDate}
- Hold length: ${holdBusinessDays} business days
- Strategy: buy today, sell before ${sellByDate}

Use web search to find current information. Evaluate these criteria:

1. MARKET CAP: Must be >$10B (large cap reduces volatility)
2. BETA: Should be <1.3 (lower market sensitivity)
3. EARNINGS: The next earnings report MUST NOT fall between ${today} and ${sellByDate} — if it does, this is a FAIL
4. 52-WEEK POSITION: "middle" (mid-range) is ideal; "near-high" (chase risk) or "near-low" (value trap signal) are concerns
5. NEWS FLAGS: Any recent news about lawsuits, SEC investigations, guidance cuts, active M&A, executive departures, major product failures, or material uncertainty

Also note the company's basic fundamental health (profitability, debt level, cash position) in one short phrase.

Return ONLY valid JSON, no markdown code fences, no preamble:
{
  "ticker": "${ticker}",
  "companyName": "string",
  "marketCap": "string like $150B",
  "marketCapPass": boolean,
  "beta": number or null,
  "betaPass": boolean,
  "nextEarningsDate": "YYYY-MM-DD or 'outside window' or 'unknown'",
  "earningsPass": boolean,
  "fiftyTwoWeekPosition": "near-high" | "middle" | "near-low",
  "positionPass": boolean,
  "newsFlags": ["flag1", "flag2"] or [],
  "newsPass": boolean,
  "fundamentalsNote": "short phrase",
  "passedCount": integer 0-5,
  "recommendation": "BUY" | "CAUTION" | "AVOID",
  "reasoning": "2-3 sentence summary"
}`;
}

export async function POST(req) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Server is missing ANTHROPIC_API_KEY." },
      { status: 500 },
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { ticker, today, sellByDate, holdBusinessDays } = body || {};
  if (!ticker || !today || !sellByDate || typeof holdBusinessDays !== "number") {
    return Response.json(
      { error: "Missing ticker, today, sellByDate, or holdBusinessDays." },
      { status: 400 },
    );
  }

  const cleanTicker = String(ticker).trim().toUpperCase().slice(0, 6);
  if (!/^[A-Z.\-]{1,6}$/.test(cleanTicker)) {
    return Response.json({ error: "Invalid ticker." }, { status: 400 });
  }

  const prompt = buildPrompt({
    ticker: cleanTicker,
    today,
    sellByDate,
    holdBusinessDays,
  });

  let upstream;
  try {
    upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
        tools: [{ type: "web_search_20250305", name: "web_search" }],
      }),
    });
  } catch (err) {
    return Response.json(
      { error: `Upstream request failed: ${err.message}` },
      { status: 502 },
    );
  }

  const data = await upstream.json().catch(() => null);
  if (!upstream.ok) {
    const message = data?.error?.message || `Upstream error (${upstream.status})`;
    return Response.json({ error: message }, { status: upstream.status });
  }

  const textBlocks = (data?.content || []).filter((b) => b.type === "text");
  const fullText = textBlocks.map((b) => b.text).join("\n").trim();
  const cleaned = fullText
    .replace(/```json\s*/g, "")
    .replace(/```\s*$/g, "")
    .trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);

  try {
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
    return Response.json(parsed);
  } catch (err) {
    return Response.json(
      { error: `Could not parse model JSON: ${err.message}`, raw: fullText },
      { status: 502 },
    );
  }
}
