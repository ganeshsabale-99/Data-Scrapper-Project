import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

// ─── Configuration ───────────────────────────────────────────────────────────

const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "gemma:2b";
const CHUNK_SIZE = 5000; // gemma:2b can handle ~4000 chars, leave room for prompt
const MAX_CHUNKS = 4;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SummarizationResult {
  summary: string;
  model: string;
  generatedAt: string;
}

// ─── Prompt Templates ────────────────────────────────────────────────────────

function buildChunkPrompt(chunkText: string, chunkIndex: number, totalChunks: number): string {
  if (totalChunks === 1) {
    return `Please provide a concise summary of the following article in 5-6 bullet points, highlighting the key facts and main takeaways:\n\n${chunkText}`;
  }
  return `Summarize the key points from part ${chunkIndex + 1} of ${totalChunks} of this article in 2-3 bullet points:\n\n${chunkText}`;
}

function buildCombinePrompt(chunkSummaries: string[]): string {
  const combined = chunkSummaries
    .map((s, i) => `Part ${i + 1}:\n${s}`)
    .join("\n\n");
  return `Below are summaries of different parts of the same article. Combine them into a single coherent summary with 5-6 bullet points highlighting the key facts and main takeaways:\n\n${combined}`;
}

// ─── Split article into chunks ───────────────────────────────────────────────

function splitIntoChunks(text: string): string[] {
  if (text.length <= CHUNK_SIZE) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0 && chunks.length < MAX_CHUNKS) {
    if (remaining.length <= CHUNK_SIZE) {
      chunks.push(remaining);
      break;
    }

    // Try to split at a paragraph or sentence boundary
    let splitAt = CHUNK_SIZE;

    // Look for paragraph break near the chunk boundary
    const paragraphBreak = remaining.lastIndexOf("\n\n", CHUNK_SIZE);
    if (paragraphBreak > CHUNK_SIZE * 0.5) {
      splitAt = paragraphBreak;
    } else {
      // Look for sentence end near the chunk boundary
      const sentenceEnd = remaining.lastIndexOf(". ", CHUNK_SIZE);
      if (sentenceEnd > CHUNK_SIZE * 0.5) {
        splitAt = sentenceEnd + 1;
      }
    }

    chunks.push(remaining.substring(0, splitAt).trim());
    remaining = remaining.substring(splitAt).trim();
  }

  return chunks;
}

// ─── Call Ollama with proper Node.js streaming ───────────────────────────────

async function callOllama(prompt: string): Promise<string> {
  if (!OLLAMA_BASE_URL) {
    throw new Error("OLLAMA_BASE_URL is not configured. Please set it in .env");
  }
  const ollamaUrl = `${OLLAMA_BASE_URL}/api/generate`;

  try {
    // Use responseType: 'stream' for actual Node.js streaming
    // This keeps the connection alive as tokens arrive, preventing timeout
    const response = await axios.post(
      ollamaUrl,
      {
        model: OLLAMA_MODEL,
        prompt: prompt,
        stream: true,
        options: {
          num_predict: 500,
          temperature: 0.3,
        },
      },
      {
        // Generous timeout for initial connection (model may need loading)
        timeout: 120000,
        responseType: "stream",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    // Collect streamed tokens from the Node.js readable stream
    return new Promise<string>((resolve, reject) => {
      let fullResponse = "";
      let buffer = "";

      const stream = response.data as import("stream").Readable;

      // Set a generous inactivity timeout (5 min with no data = dead)
      let inactivityTimeout: ReturnType<typeof setTimeout> = setTimeout(() => {
        stream.destroy();
        reject(new Error("Ollama stream went silent — no data received for 5 minutes."));
      }, 300000);

      const resetInactivityTimeout = () => {
        clearTimeout(inactivityTimeout);
        inactivityTimeout = setTimeout(() => {
          stream.destroy();
          reject(new Error("Ollama stream went silent — no data received for 5 minutes."));
        }, 300000);
      };

      stream.on("data", (chunk: Buffer) => {
        resetInactivityTimeout();
        buffer += chunk.toString();

        // Process complete lines (newline-delimited JSON)
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.response) {
              fullResponse += parsed.response;
            }
            if (parsed.done) {
              clearTimeout(inactivityTimeout);
              resolve(fullResponse.trim());
              return;
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      });

      stream.on("end", () => {
        clearTimeout(inactivityTimeout);
        // Process any remaining buffer
        if (buffer.trim()) {
          try {
            const parsed = JSON.parse(buffer);
            if (parsed.response) {
              fullResponse += parsed.response;
            }
          } catch {
            // ignore
          }
        }
        resolve(fullResponse.trim());
      });

      stream.on("error", (err: Error) => {
        clearTimeout(inactivityTimeout);
        reject(err);
      });
    });
  } catch (error: any) {
    if (error.code === "ECONNREFUSED") {
      throw new Error(
        `Unable to connect to Ollama at ${OLLAMA_BASE_URL}. Please ensure the Ollama server is running.`
      );
    }

    if (error.code === "ECONNABORTED" || error.message?.includes("timeout")) {
      throw new Error(
        "Ollama request timed out. The server may be under heavy load. Please try again."
      );
    }

    if (axios.isAxiosError(error) && error.response) {
      const status = error.response.status;
      if (status === 404) {
        throw new Error(
          `Ollama model '${OLLAMA_MODEL}' not found. Please ensure it is pulled on the server.`
        );
      }
      throw new Error(`Ollama returned error ${status}`);
    }

    throw error;
  }
}

// ─── Main summarization function ─────────────────────────────────────────────

export async function summarizeWithOllama(
  articleText: string
): Promise<SummarizationResult> {
  if (!articleText || articleText.trim().length < 50) {
    throw new Error("Article text is too short to summarize.");
  }

  const chunks = splitIntoChunks(articleText);
  console.log(
    `[OllamaSummarizer] Processing ${chunks.length} chunk(s) using model: ${OLLAMA_MODEL}`
  );

  let finalSummary: string;

  if (chunks.length === 1) {
    // Single chunk — straightforward summarization
    const firstChunk = chunks[0]!;
    const prompt = buildChunkPrompt(firstChunk, 0, 1);
    console.log(`[OllamaSummarizer] Sending single chunk (${firstChunk.length} chars)...`);
    finalSummary = await callOllama(prompt);
  } else {
    // Multiple chunks — summarize each, then combine
    const chunkSummaries: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!;
      const prompt = buildChunkPrompt(chunk, i, chunks.length);
      console.log(
        `[OllamaSummarizer] Processing chunk ${i + 1}/${chunks.length} (${chunk.length} chars)...`
      );
      const chunkSummary = await callOllama(prompt);
      if (chunkSummary.length > 10) {
        chunkSummaries.push(chunkSummary);
      }
      console.log(
        `[OllamaSummarizer] Chunk ${i + 1} done (${chunkSummary.length} chars)`
      );
    }

    if (chunkSummaries.length === 0) {
      throw new Error("Failed to generate summary from any article chunk.");
    }

    if (chunkSummaries.length === 1) {
      finalSummary = chunkSummaries[0]!;
    } else {
      // Combine all chunk summaries into final summary
      console.log(`[OllamaSummarizer] Combining ${chunkSummaries.length} chunk summaries...`);
      const combinePrompt = buildCombinePrompt(chunkSummaries);
      finalSummary = await callOllama(combinePrompt);
    }
  }

  if (!finalSummary || finalSummary.length < 10) {
    throw new Error("Ollama returned an empty or too-short summary.");
  }

  console.log(
    `[OllamaSummarizer] Summary generated successfully (${finalSummary.length} chars)`
  );

  return {
    summary: finalSummary,
    model: OLLAMA_MODEL,
    generatedAt: new Date().toISOString(),
  };
}

export default summarizeWithOllama;
