// This runs on the server (Vercel), never in the user's browser.
// Your GEMINI_API_KEY lives here as an environment variable, so it's
// never visible to anyone using the app.
// Uses Google's Gemini API (gemini-2.5-flash), which has a genuine free tier —
// see the README for current limits and the privacy tradeoff.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageBase64, imageMediaType, filters } = req.body || {};

  if (!imageBase64 || !imageMediaType) {
    return res.status(400).json({ error: 'Missing image data' });
  }

  const filterText = (filters && filters.length)
    ? `The person specifically cares about: ${filters.join(', ')}. Weight your verdict and notes toward these priorities.`
    : `The person hasn't specified priorities — give a balanced, general-audience read.`;

  const promptText = `You are a calm, evidence-based food label interpreter. Your voice is the opposite of fear-based scanner apps: no alarmism, no "toxic" language, no fearmongering about trace additives. You give context, not verdicts dressed up as facts. You acknowledge uncertainty honestly (say "mixed evidence" when evidence is mixed, don't overstate).

Read the ingredient list and/or nutrition panel in the attached photo. Then respond with ONLY a JSON object matching exactly this shape (no markdown fences, no prose before or after — your entire response must be valid JSON):

{
  "verdict": "good" | "okay" | "caution",
  "verdict_line": "one calm sentence, the overall practical takeaway",
  "personalization_note": "1-2 sentences tailored to the person's stated priorities, or empty string if none given",
  "top_reasons": ["short reason 1", "short reason 2", "short reason 3 (optional)"],
  "ingredients": [
    {
      "name": "ingredient name as it appears",
      "role": "why it's in there, short phrase",
      "evidence_level": "Established" | "Mixed" | "Limited",
      "care_level": "Low" | "Medium" | "High",
      "note": "1-2 sentence calm explanation of what it is and who, if anyone, should care"
    }
  ],
  "swaps": ["practical swap suggestion 1", "practical swap suggestion 2"]
}

Only include ingredients worth flagging (skip totally uninteresting ones like water or salt unless sodium content matters). Cap ingredients at 6. Cap top_reasons at 3. Cap swaps at 3. ${filterText}`;

  try {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: promptText },
                { inline_data: { mime_type: imageMediaType, data: imageBase64 } }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: 'application/json'
          }
        })
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `Gemini API error: ${errText}` });
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return res.status(502).json({ error: `Unexpected Gemini response shape: ${JSON.stringify(data).slice(0, 400)}` });
    }

    // Normalize into the same { content: [{ type: 'text', text }] } shape
    // the frontend already expects, so index.html doesn't need to change.
    return res.status(200).json({ content: [{ type: 'text', text }] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

