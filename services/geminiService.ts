/**
 * @fileoverview Gemini AI Integration for Semantic Planning (Stage 1)
 * 
 * This service acts as a proxy for the future Autoregressive Transformer that will
 * power NAW's Semantic Planner. Currently uses Gemini 2.5 Flash to generate symbolic
 * musical blueprints (note patterns) that simulate the output of an AR model like
 * MusicGen or Fish Speech.
 * 
 * ## Architecture Context
 * 
 * In the full NAW pipeline, this service will be replaced by:
 * 1. Transformer-XL model (300M-500M params) for semantic planning
 * 2. Predicts only coarse RVQ codebooks (0-1) from DAC/EnCodec
 * 3. Runs in <2 seconds for 32 bars
 * 
 * For now, Gemini generates **symbolic data** (step sequencer patterns) which is
 * sufficient for UI prototyping and workflow validation.
 * 
 * @module services/geminiService
 * @see {@link https://arxiv.org/abs/2306.05284|MusicGen Paper}
 * @see {@link https://ai.google.dev/|Gemini API Documentation}
 */

import { GoogleGenAI, Type } from "@google/genai";
import { StemType } from "../types";

/**
 * Generates a musical blueprint (symbolic pattern) using Gemini 2.5 Flash.
 * 
 * This function simulates the output of an Autoregressive Transformer semantic planner.
 * It takes a high-level text prompt and returns a structured JSON blueprint containing
 * 2-bar loop patterns for each of the 4 stems (DRUMS, BASS, VOCALS, OTHER).
 * 
 * ## Workflow
 * 
 * 1. **Construct System Instruction**: Define the role and output format for Gemini
 * 2. **Send Request**: Call Gemini API with structured schema enforcement
 * 3. **Parse Response**: Robust JSON extraction (handles markdown, trailing commas)
 * 4. **Validate**: Ensure response has required structure
 * 5. **Fallback**: If API fails, return hardcoded pattern to prevent UI crash
 * 
 * ## Output Format
 * 
 * ```json
 * {
 *   "title": "House Groove",
 *   "suggestedBpm": 128,
 *   "stems": [
 *     {
 *       "type": "DRUMS",
 *       "description": "Four-on-floor kick, offbeat hats",
 *       "pattern": [
 *         { "step": 0, "note": "KICK", "duration": 1, "velocity": 1.0 },
 *         { "step": 4, "note": "KICK", "duration": 1, "velocity": 1.0 },
 *         ...
 *       ]
 *     },
 *     ...
 *   ]
 * }
 * ```
 * 
 * ## Error Handling
 * 
 * - **Missing API Key**: Throws error immediately (fatal)
 * - **Network Failure**: Logs error, returns fallback pattern
 * - **Invalid JSON**: Attempts cleanup, falls back if parsing fails
 * - **Missing Fields**: Throws error to prevent downstream crashes
 * 
 * @param {string} prompt - High-level musical description (e.g., "Uplifting house, energetic")
 * @param {number} bpm - Desired tempo (Gemini may override with `suggestedBpm`)
 * @returns {Promise<Object>} Blueprint object with title, suggestedBpm, and stems array
 * @throws {Error} If API key is missing
 * 
 * @example
 * const blueprint = await generateSongBlueprint("Dark techno, 130 BPM, aggressive", 130);
 * console.log(blueprint.title); // "Dark Techno Groove"
 * console.log(blueprint.stems[0].type); // "DRUMS"
 * console.log(blueprint.stems[0].pattern.length); // ~16 events
 */
export const generateSongBlueprint = async (prompt: string, bpm: number) => {
  // ──────────────────────────────────────────────────────────────
  // 1. VALIDATE API KEY
  // ──────────────────────────────────────────────────────────────
  if (!process.env.API_KEY) {
    console.error("API Key missing");
    throw new Error("API Key missing");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // ──────────────────────────────────────────────────────────────
  // 2. CONSTRUCT SYSTEM INSTRUCTION (Model Persona)
  // ──────────────────────────────────────────────────────────────
  // This instruction tells Gemini to behave like an AR Transformer
  // that outputs discrete musical events, not continuous audio.
  
  const systemInstruction = `
    You are the 'Semantic Planner' engine of the Neural Audio Workstation.
    Your goal is to generate a 2-bar loop (32 steps of 16th notes) for 4 distinct stems based on the user's prompt.
    
    CRITICAL INSTRUCTIONS:
    1. Ensure phase alignment between stems (e.g., bass hits align with kick drum).
    2. Output strictly valid JSON (no markdown, no comments).
    3. Be concise. Do not generate endless patterns (max ~20 events per stem).
    4. Only include steps where a note ONSET occurs (not rests).
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
    // ──────────────────────────────────────────────────────────────
    // 3. SEND REQUEST TO GEMINI API
    // ──────────────────────────────────────────────────────────────
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json", // Force JSON output
        maxOutputTokens: 4000, // Prevent runaway generation (safety limit)
        
        // Enforce structured schema to reduce parsing errors
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
                  type: { type: Type.STRING }, // "DRUMS", "BASS", "VOCALS", "OTHER"
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

    // ──────────────────────────────────────────────────────────────
    // 4. PARSE AND CLEAN JSON RESPONSE
    // ──────────────────────────────────────────────────────────────
    let jsonString = response.text || "{}";
    
    // Gemini sometimes wraps JSON in markdown code blocks despite config
    // Extract the substring between first { and last }
    const firstBrace = jsonString.indexOf('{');
    const lastBrace = jsonString.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1) {
        jsonString = jsonString.substring(firstBrace, lastBrace + 1);
    } else {
        // Fallback: Remove markdown code block markers
        jsonString = jsonString.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    }

    // Remove trailing commas (common JSON error)
    // Regex: ", }" or ", ]" → "}" or "]"
    jsonString = jsonString.replace(/,(\s*[}\]])/g, '$1');

    // ──────────────────────────────────────────────────────────────
    // 5. PARSE JSON
    // ──────────────────────────────────────────────────────────────
    let data;
    try {
        data = JSON.parse(jsonString);
    } catch (parseError) {
        console.warn("JSON Parse failed, attempting fallback repair or returning default.", parseError);
        throw new Error("JSON Parse Error");
    }

    // ──────────────────────────────────────────────────────────────
    // 6. VALIDATE RESPONSE STRUCTURE
    // ──────────────────────────────────────────────────────────────
    // Ensure the response has the expected fields to prevent downstream crashes
    if (!data || typeof data !== 'object') {
        throw new Error("Invalid response format");
    }
    if (!Array.isArray(data.stems)) {
        throw new Error("Response missing 'stems' array");
    }

    return data;
    
  } catch (error) {
    // ──────────────────────────────────────────────────────────────
    // 7. FALLBACK PATTERN (Graceful Degradation)
    // ──────────────────────────────────────────────────────────────
    console.error("Semantic Planner Failed:", error);
    
    // Return a hardcoded 2-bar loop to prevent UI crash
    // This simulates a minimal "safe mode" output from the AR model
    return {
      title: "Fallback Pattern",
      suggestedBpm: 128,
      stems: [
        {
           type: "DRUMS", 
           description: "Basic 4/4",
           pattern: [
               // Kick on every beat (steps 0, 4, 8, 12)
               { step: 0, note: "KICK", duration: 1, velocity: 1 },
               { step: 4, note: "KICK", duration: 1, velocity: 1 },
               { step: 8, note: "KICK", duration: 1, velocity: 1 },
               { step: 12, note: "KICK", duration: 1, velocity: 1 },
               // Snare on beats 2 and 4 (steps 4, 12)
               { step: 4, note: "SNARE", duration: 1, velocity: 0.9 },
               { step: 12, note: "SNARE", duration: 1, velocity: 0.9 },
               // Hi-hats on offbeats (steps 2, 6, 10, 14)
               { step: 2, note: "CHAT", duration: 1, velocity: 0.7 },
               { step: 6, note: "CHAT", duration: 1, velocity: 0.7 },
               { step: 10, note: "CHAT", duration: 1, velocity: 0.7 },
               { step: 14, note: "OHAT", duration: 1, velocity: 0.7 },
           ]
        },
        {
            type: "BASS", 
            description: "Offbeat",
            pattern: [
                // Simple bassline on offbeats
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
