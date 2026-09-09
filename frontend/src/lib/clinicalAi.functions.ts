import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createGeminiProvider } from "./ai-gateway.server";

const NarrativeSchema = z.object({
  summary: z.string(),
  sections: z.array(z.object({ heading: z.string(), body: z.string() })),
  concerns: z.array(z.string()),
  medication_conflicts: z.array(z.string()),
  recommended_actions: z.array(z.string()),
});

export type AiNarrative = z.infer<typeof NarrativeSchema>;

const InputSchema = z.object({ ehr: z.string(), rules: z.string() });

const SYSTEM_PROMPT = `You are a clinical summarisation assistant supporting primary-care clinicians.
You are given a structured EHR extract (JSON) for a single synthetic patient plus the active referral rules.
Produce a concise, factual clinical summary. Rules:
- Use only the data provided; never invent findings, dates, or values.
- Cite concrete values with units when describing abnormal results.
- Use professional clinical language, no bullet markup, no markdown.
- sections: 5-7 items with headings such as Patient Overview, Active Conditions, Current Medications,
  Recent Encounters, Recent Laboratory Results, Clinical Concerns, Recommended Referral Actions.
- medication_conflicts: real interaction or dosing risks implied by the active medication list and labs; empty array if none.
- recommended_actions: short imperative actions (e.g. "Create Endocrinologist referral"); empty array if none.
This output is decision support only, never a diagnosis.`;

export const generateAiNarrative = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<{ narrative: AiNarrative; model: string } | { error: string }> => {
    const key = process.env["GOOGLE_GENERATIVE_AI_API_KEY"];
    if (!key) return { error: "AI is not configured (missing GOOGLE_GENERATIVE_AI_API_KEY)." };

    const model = "gemini-2.5-flash";
    try {
      const provider = createGeminiProvider(key);
      const { text } = await generateText({
        model: provider(model),
        system: SYSTEM_PROMPT,
        prompt: `EHR extract:\n${data.ehr}\n\nActive referral rules:\n${data.rules}\n\nReturn ONLY a json object with keys: summary (string), sections (array of {heading, body}), concerns (string array), medication_conflicts (string array), recommended_actions (string array).`,
      });
      const jsonText = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
      const parsed = NarrativeSchema.safeParse(JSON.parse(jsonText));
      if (!parsed.success) return { error: "AI returned an unexpected summary format." };
      return { narrative: parsed.data, model: `${model} (Gemini)` };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Gemini API failure";
      if (message.includes("429")) return { error: "AI rate limit reached — try again shortly." };
      return { error: `AI summary unavailable: ${message}` };
    }
  });
