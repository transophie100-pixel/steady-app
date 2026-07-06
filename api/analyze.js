// This runs on the server (Vercel), never in the user's browser.
// Your GEMINI_API_KEY and GROQ_API_KEY live here as environment variables,
// so they're never visible to anyone using the app.
//
// Reliability strategy: try Gemini first (primary, free tier). If Gemini
// is overloaded or errors out, automatically fall back to Groq's free
// vision model, so a single provider's bad moment doesn't break the app.

const RESPONSE_SHAPE = `{
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
}`;

function buildFoodPrompt(filters) {
  const filterList = filters || [];
  const filterText = filterList.length
    ? `The person specifically cares about: ${filterList.join(', ')}. Weight your verdict and notes toward these priorities.`
    : `The person hasn't specified priorities — give a balanced, general-audience read.`;

  const kidsFocus = filterList.some(f => /kid|lunchbox/i.test(f));
  const kidsNote = kidsFocus
    ? `\n\nThe person selected "Kids' lunchbox." For synthetic dyes specifically (Red 40, Yellow 5, Yellow 6, Blue 1, etc.), raise care_level to at least "Medium" — the Southampton study and subsequent reviews found a real (if inconsistent) link to hyperactivity in some children, which is why the EU requires a warning label on foods containing them. Don't say "no big deal" for dyes in this context.`
    : '';

  return `You are a calm, evidence-based food label interpreter. Your voice is the opposite of fear-based scanner apps: no alarmism, no "toxic" language, no fearmongering about trace additives. You give context, not verdicts dressed up as facts. You acknowledge uncertainty honestly (say "mixed evidence" when evidence is mixed, don't overstate) — but you also don't undersell ingredients that have real, if nuanced, evidence behind them.

Hard rule: do not claim that any food preservative or additive impairs vaccine efficacy or immune response to vaccines. This claim circulates online but traces back to thin, poorly-generalizable animal studies — do not include it under any circumstance.

Ground your notes on these commonly-flagged ingredients in this specific calibration rather than improvising, since blog-level sources tend to either overstate or understate these:

- Red 40 / Yellow 5 / other synthetic dyes: Evidence level Mixed. Linked to hyperactivity in some children in some studies (Southampton study), which is why the EU requires a warning label (not a ban). Cancer-risk claims are weak evidence and often confused with Red 3 (which the FDA banned in Jan 2025 over separate rat studies — Red 3 alone gets "High" concern). Default care_level "Low-Medium" generally, "Medium" or higher for kids.
- TBHQ: Evidence level Mixed. Synthetic antioxidant preservative; toxic only at doses far above normal food use; some animal studies show effects at high doses. Default care_level "Low-Medium."
- BHA/BHT: Evidence level Mixed. BHA is listed by some regulatory bodies as "reasonably anticipated" to be a carcinogen based on animal studies at high doses; BHT evidence is weaker. Default care_level "Medium."
- Titanium dioxide: Evidence level Mixed. Banned as a food additive in the EU (2022) over inability to rule out genotoxicity concerns; still permitted in the US. Default care_level "Medium."
- High-fructose corn syrup: Evidence level Established for "it's an added sugar, treat like one" — the "worse than other sugars" claim specifically is more Mixed/contested. Default care_level "Medium," tied to total added sugar amount.
- Guar gum, xanthan gum, lecithin, and most emulsifiers/thickeners: Evidence level Limited for most people; main real concern is GI discomfort in sensitive individuals or at high doses. Default care_level "Low" unless gut sensitivity filter is selected.

Read the ingredient list and/or nutrition panel in the attached photo. Then respond with ONLY a JSON object matching exactly this shape (no markdown fences, no prose before or after — your entire response must be valid JSON):

${RESPONSE_SHAPE}

Only include ingredients worth flagging (skip totally uninteresting ones like water or salt unless sodium content matters). Cap ingredients at 6. Cap top_reasons at 3. Cap swaps at 3. ${filterText}${kidsNote}`;
}

function buildSkincarePrompt(filters) {
  const filterList = filters || [];
  const filterText = filterList.length
    ? `The person specifically cares about: ${filterList.join(', ')}. Weight your verdict and notes toward these priorities.`
    : `The person hasn't specified priorities — give a balanced, general-audience read.`;

  const sensitiveFocus = filterList.some(f => /sensitive|reactive|eczema|rosacea|fragrance/i.test(f));
  const sensitiveNote = sensitiveFocus
    ? `\n\nThe person flagged sensitive/reactive skin, eczema, rosacea, or fragrance sensitivity. Raise care_level for fragrance/parfum, essential oils, and denatured alcohol to at least "Medium" in this context — these are the most common real-world irritants and allergens for reactive skin, more so than preservatives.`
    : '';

  const pregnancyFocus = filterList.some(f => /pregnan/i.test(f));
  const pregnancyNote = pregnancyFocus
    ? `\n\nThe person flagged pregnancy/breastfeeding. Retinoids (retinol, retinal, tretinoin, adapalene) and high-dose salicylic acid should be flagged "High" care_level with a clear note to check with an OB — this is genuinely established guidance, not overcaution.`
    : '';

  return `You are a calm, evidence-based skincare ingredient interpreter. Your voice is the opposite of fear-based "clean beauty" scanner apps: no alarmism, no "chemical = bad" framing, no treating every unpronounceable name as dangerous. You give context, not verdicts dressed up as facts. You acknowledge uncertainty honestly, but you also don't undersell ingredients with real, established evidence behind them (fragrance and essential oils are genuinely the top causes of cosmetic allergic reactions — don't soften that to sound balanced).

Ground your notes on these commonly-flagged ingredients in this specific calibration rather than improvising:

- Parabens (methylparaben, propylparaben, etc.): Evidence level Established as safe at cosmetic-use concentrations by major regulatory bodies (FDA, EU), despite a persistent "clean beauty" reputation problem. Default care_level "Low."
- Fragrance / parfum (including "natural fragrance"): Evidence level Established as the single most common cause of cosmetic contact allergy and irritation. Default care_level "Medium," "High" for sensitive/reactive/eczema-prone skin.
- Essential oils (lavender, tea tree, citrus oils, etc.): Evidence level Established as significant contact allergens/sensitizers despite "natural" framing. Default care_level "Medium," higher for reactive skin.
- Sulfates (SLS, SLES): Evidence level Mixed/Limited for lasting harm; can be drying or irritating, especially in leave-on products or for dry/sensitive skin. Rinse-off products (shampoo, cleanser) are lower concern than leave-on. Default care_level "Low-Medium."
- Silicones (dimethicone, cyclopentasiloxane): Evidence level Limited for the "clogs pores" claim for most people; mainly texture/occlusive agents. Default care_level "Low," "Medium" only if acne-prone and product is heavy/occlusive.
- Retinoids (retinol, retinal, tretinoin, adapalene): Evidence level Established as effective anti-aging/acne actives; genuinely require sun protection and are genuinely contraindicated in pregnancy. Default care_level "Medium," "High" for pregnancy.
- Chemical exfoliants (glycolic acid, lactic acid, salicylic acid): Evidence level Established as effective; increase sun sensitivity, generally fine with SPF. Default care_level "Low-Medium."
- Denatured alcohol (alcohol denat.): Evidence level Mixed; can be drying at high concentrations, less concerning in small amounts near the end of an ingredient list. Default care_level "Low-Medium," higher for dry/sensitive skin.
- Phthalates: Evidence level Established as worth avoiding where possible, especially in pregnancy; largely phased out of modern formulations in regulated markets but still worth flagging if listed. Default care_level "Medium-High," "High" for pregnancy.

Read the ingredient list on the attached photo (usually on the back/bottom of the packaging). Then respond with ONLY a JSON object matching exactly this shape (no markdown fences, no prose before or after — your entire response must be valid JSON):

${RESPONSE_SHAPE}

For "swaps," suggest practical alternative product types or routines rather than specific brand names. Only include ingredients worth flagging (skip totally uninteresting ones like water/aqua or plain glycerin). Cap ingredients at 6. Cap top_reasons at 3. Cap swaps at 3. ${filterText}${sensitiveNote}${pregnancyNote}`;
}

async function tryGemini(imageBase64, imageMediaType, promptText) {
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
        generationConfig: { responseMimeType: 'application/json' }
      })
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`Unexpected Gemini response shape: ${JSON.stringify(data).slice(0, 400)}`);
  return text;
}

async function tryGroq(imageBase64, imageMediaType, promptText) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: promptText },
            { type: 'image_url', image_url: { url: `data:${imageMediaType};base64,${imageBase64}` } }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error(`Unexpected Groq response shape: ${JSON.stringify(data).slice(0, 400)}`);
  return text;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageBase64, imageMediaType, filters, mode } = req.body || {};

  if (!imageBase64 || !imageMediaType) {
    return res.status(400).json({ error: 'Missing image data' });
  }

  const promptText = mode === 'skincare' ? buildSkincarePrompt(filters) : buildFoodPrompt(filters);
  const errors = [];

  // Primary: Gemini, with two quick retries if it's just overloaded.
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const text = await tryGemini(imageBase64, imageMediaType, promptText);
      return res.status(200).json({ content: [{ type: 'text', text }] });
    } catch (err) {
      errors.push(`Gemini attempt ${attempt}: ${err.message}`);
      const overloaded = /503|UNAVAILABLE|high demand/i.test(err.message);
      if (!overloaded) break; // don't retry non-transient errors
      await new Promise(r => setTimeout(r, attempt * 1000));
    }
  }

  // Backup: Groq, only reached if Gemini failed above.
  try {
    const text = await tryGroq(imageBase64, imageMediaType, promptText);
    return res.status(200).json({ content: [{ type: 'text', text }] });
  } catch (err) {
    errors.push(`Groq: ${err.message}`);
  }

  return res.status(502).json({ error: `Both providers failed. ${errors.join(' | ')}`.slice(0, 500) });
}