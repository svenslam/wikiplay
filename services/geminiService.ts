
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { Category, TopicContent } from "../types";

// Safely retrieve API key or default to empty string to prevent ReferenceError
const apiKey = (typeof process !== "undefined" && process.env && process.env.API_KEY) ? process.env.API_KEY : "";

// Only initialize if we have a key (or handle safely later)
// Note: In a static GitHub pages deploy without a proxy, this will likely fail to generate content
// unless the key is injected during build. This prevents the immediate "crash" on load.
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const fetchTopicContent = async (category: Category): Promise<TopicContent | null> => {
  if (!ai) {
    console.warn("API Key missing or invalid. Cannot fetch content.");
    return null;
  }

  try {
    const prompt = `
      Je bent de host van een kennis-app genaamd Wikiplay.
      De gebruiker heeft de categorie "${category}" gekozen.

      Genereer een JSON object met twee onderdelen:
      1. 'fact': Een interessant, minder bekend Wikipedia-weetje over dit onderwerp.
         - Begin de tekst ALTIJD met: "- ${category} - \n\nWist je dat..."
         - Houd het beknopt (max 3-4 zinnen).
         - Schrijf in het Nederlands.
      
      2. 'quiz': Een uitdagende multiple-choice vraag die gaat over de bredere context of achtergrond van dit specifieke onderwerp.
         - BELANGRIJK: Het antwoord mag NIET letterlijk in de tekst van 'fact' staan. De gebruiker moet nadenken of algemene kennis gebruiken.
         - Het moet wel direct gerelateerd zijn aan het onderwerp van het weetje.
         - 3 opties.
         - 1 correct antwoord.
         - Een korte uitleg.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            fact: { type: Type.STRING },
            quiz: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: { 
                  type: Type.ARRAY, 
                  items: { type: Type.STRING },
                  description: "Array van precies 3 opties"
                },
                correctAnswer: { type: Type.STRING },
                explanation: { type: Type.STRING }
              },
              required: ["question", "options", "correctAnswer", "explanation"]
            }
          },
          required: ["fact", "quiz"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as TopicContent;
    }
    return null;
  } catch (error) {
    console.error("Gemini Content Error:", error);
    return null;
  }
};

export const fetchTriviaImage = async (textContext: string): Promise<string | null> => {
  if (!ai) return null;
  
  try {
    // Shorten context if too long to save tokens/avoid confusion, keep essence
    const cleanContext = textContext.replace(/^-.*?Wist je dat/i, '').substring(0, 300);

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { text: `Een sfeervolle, artistieke illustratie (digitaal schilderij) die past bij dit weetje: "${cleanContext}". Geen tekst in de afbeelding.` }
        ]
      },
      config: {
        imageConfig: {
            aspectRatio: "16:9",
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Gemini API Error (Image):", error);
    return null;
  }
};

export const fetchTriviaAudio = async (text: string): Promise<string | null> => {
    if (!ai) return null;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Fenrir' }, 
              },
          },
        },
      });
  
      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      return base64Audio || null;
    } catch (error) {
      console.error("Gemini API Error (Audio):", error);
      return null;
    }
  };
