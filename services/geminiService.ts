import { GoogleGenAI, Type } from "@google/genai";
import { StemType } from "../types";

export const generateSongBlueprint = async (prompt: string, bpm: number) => {
  if (!process.env.API_KEY) {
    console.error("API Key missing");
    throw new Error("API Key missing");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Stage 1: Semantic Planner (MusicGen-Stem Architecture Simulator)
  // We ask Gemini to generate specific 2-bar loops (32 steps of 16th notes) for each stem.
  
  const systemInstruction = `
    You are the 'Semantic Planner' engine of the Neural Audio Workstation.
    Your goal is to generate a 2-bar loop (32 steps of 16th notes) for 4 distinct stems based on the user's prompt.
    
    CRITICAL INSTRUCTIONS:
    1. Ensure phase alignment between stems.
    2. Output strictly valid JSON.
    3. Be concise. Do not generate endless patterns.
    4. Only include steps where a note ONSET occurs.
    5. 'description' fields should be short (under 10 words).

    For DRUMS: Use note names "KICK", "SNARE", "CHAT" (Closed Hat), "OHAT" (Open Hat).
    For BASS/VOCALS/OTHER: Use Scientific Pitch Notation (e.g., "C2", "F#4", "Ab3") or "REST".
    
    JSON Structure:
    {
      "title": "Song Title",
      "suggestedBpm": 120,
      "stems": [
        {
          "type": "DRUMS",
          "description": "Short description",
          "pattern": [
            { "step": 0, "note": "KICK", "duration": 1, "velocity": 1.0 },
            ...
          ]
        },
        ...
      ]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        maxOutputTokens: 4000, // Prevent runaway generation
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            suggestedBpm: { type: Type.NUMBER },
            stems: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING }, // DRUMS, BASS, VOCALS, OTHER
                  description: { type: Type.STRING },
                  pattern: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            step: { type: Type.NUMBER },
                            note: { type: Type.STRING },
                            duration: { type: Type.NUMBER },
                            velocity: { type: Type.NUMBER }
                        }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    let jsonString = response.text || "{}";
    
    // Robust Extraction: Find the first { and last }
    const firstBrace = jsonString.indexOf('{');
    const lastBrace = jsonString.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1) {
        jsonString = jsonString.substring(firstBrace, lastBrace + 1);
    } else {
        // Fallback cleanup
        jsonString = jsonString.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    }

    // Regex to remove trailing commas
    jsonString = jsonString.replace(/,(\s*[}\]])/g, '$1');

    // Safe parse
    let data;
    try {
        data = JSON.parse(jsonString);
    } catch (parseError) {
        console.warn("JSON Parse failed, attempting fallback repair or returning default.", parseError);
        throw new Error("JSON Parse Error");
    }

    // CRITICAL: Validate structure exists before returning
    if (!data || typeof data !== 'object') {
        throw new Error("Invalid response format");
    }
    if (!Array.isArray(data.stems)) {
        throw new Error("Response missing 'stems' array");
    }

    return data;
  } catch (error) {
    console.error("Semantic Planner Failed:", error);
    // Fallback Mock Data
    return {
      title: "Fallback Pattern",
      suggestedBpm: 128,
      stems: [
        {
           type: "DRUMS", description: "Basic 4/4",
           pattern: [
               { step: 0, note: "KICK", duration: 1, velocity: 1 },
               { step: 4, note: "KICK", duration: 1, velocity: 1 },
               { step: 8, note: "KICK", duration: 1, velocity: 1 },
               { step: 12, note: "KICK", duration: 1, velocity: 1 },
               { step: 4, note: "SNARE", duration: 1, velocity: 0.9 },
               { step: 12, note: "SNARE", duration: 1, velocity: 0.9 },
               { step: 2, note: "CHAT", duration: 1, velocity: 0.7 },
               { step: 6, note: "CHAT", duration: 1, velocity: 0.7 },
               { step: 10, note: "CHAT", duration: 1, velocity: 0.7 },
               { step: 14, note: "OHAT", duration: 1, velocity: 0.7 },
           ]
        },
        {
            type: "BASS", description: "Offbeat",
            pattern: [
                { step: 2, note: "C2", duration: 2, velocity: 0.8 },
                { step: 6, note: "C2", duration: 2, velocity: 0.8 },
                { step: 10, note: "C2", duration: 2, velocity: 0.8 },
                { step: 14, note: "G2", duration: 2, velocity: 0.8 },
            ]
        }
      ]
    };
  }
};
