import {
  CapabilitiesResponse,
  Conversation,
  SessionCumulativeStats,
  BenchmarkResult,
  OptimizationStrategy,
  PresetMode,
  ResponseMode,
  ThinkingLevel,
  QualityFeedbackType,
} from "../types";

const API_BASE = "";

export async function fetchCapabilities(): Promise<CapabilitiesResponse> {
  const res = await fetch(`${API_BASE}/api/config/capabilities`);
  if (!res.ok) throw new Error("Failed to fetch capabilities");
  return res.json();
}

export async function fetchConversations(): Promise<Conversation[]> {
  const res = await fetch(`${API_BASE}/api/conversations`);
  if (!res.ok) throw new Error("Failed to fetch conversations");
  return res.json();
}

export async function createConversation(title?: string, model?: string, strategy?: OptimizationStrategy): Promise<Conversation> {
  const res = await fetch(`${API_BASE}/api/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, model, strategy }),
  });
  if (!res.ok) throw new Error("Failed to create conversation");
  return res.json();
}

export async function loadDemoConversation(): Promise<Conversation> {
  const res = await fetch(`${API_BASE}/api/conversations/load-demo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error("Failed to load demo conversation");
  return res.json();
}

export async function updateConversation(id: string, payload: Partial<Conversation>): Promise<Conversation> {
  const res = await fetch(`${API_BASE}/api/conversations/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to update conversation");
  return res.json();
}

export async function deleteConversation(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/conversations/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete conversation");
}

export async function restoreConversation(conv: Conversation): Promise<Conversation> {
  const res = await fetch(`${API_BASE}/api/conversations/restore`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(conv),
  });
  if (!res.ok) throw new Error("Failed to restore conversation");
  return res.json();
}

export async function resetConversationMemory(id: string): Promise<Conversation> {
  const res = await fetch(`${API_BASE}/api/conversations/${id}/reset-memory`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to reset memory");
  return res.json();
}

export async function sendFeedback(
  convId: string,
  messageId: string,
  feedback: { type: QualityFeedbackType; comment?: string }
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/conversations/${convId}/feedback?messageId=${encodeURIComponent(messageId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...feedback, timestamp: Date.now() }),
  });
  if (!res.ok) throw new Error("Failed to send feedback");
}

export async function countTokens(
  payload: {
    conversationId?: string;
    message: string;
    model?: string;
  },
  signal?: AbortSignal
): Promise<{
  userMessageTokens: number;
  estimatedTotalInputTokens: number;
  exactCount: boolean;
  breakdown: any;
}> {
  const res = await fetch(`${API_BASE}/api/tokens/count`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok) throw new Error("Failed to count tokens");
  return res.json();
}

export async function fetchProtocolInfo(): Promise<{
  promptVersion: string;
  protocolVersion: string;
  promptHash: string;
  schemaHash: string;
  targetRuntime: string;
  trustedServicesCount: number;
}> {
  const res = await fetch(`${API_BASE}/api/protocol/info`);
  if (!res.ok) throw new Error("Failed to fetch protocol info");
  return res.json();
}

export async function fetchSessionStats(): Promise<SessionCumulativeStats> {
  const res = await fetch(`${API_BASE}/api/tokens/session-stats`);
  if (!res.ok) throw new Error("Failed to fetch session stats");
  return res.json();
}

export async function resetSessionStats(): Promise<void> {
  const res = await fetch(`${API_BASE}/api/tokens/session-reset`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to reset session stats");
}

export async function generateConversationTitle(id: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/conversations/${id}/generate-title`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to generate title");
  const data = await res.json();
  return data.title as string;
}

export async function fetchSystemPrompt(): Promise<{ content: string; hash: string; bytes: number }> {
  const res = await fetch(`${API_BASE}/api/system-prompt`);
  return res.json();
}

export async function extractProfileFacts(
  userMessage: string,
  assistantMessage: string,
  existingFacts: string[]
): Promise<{ facts: Array<{ text: string; category: string } | string> }> {
  try {
    const res = await fetch(`${API_BASE}/api/extract-profile-facts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userMessage: userMessage.slice(0, 400), assistantMessage: assistantMessage.slice(0, 400), existingFacts }),
    });
    return res.ok ? res.json() : { facts: [] };
  } catch { return { facts: [] }; }
}

export async function detectContradictions(
  userMessage: string,
  profileFacts: string[]
): Promise<{ contradictions: Array<{ fact: string; contradiction: string }> }> {
  try {
    const res = await fetch(`${API_BASE}/api/detect-contradictions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userMessage: userMessage.slice(0, 400), profileFacts: profileFacts.slice(0, 15) }),
    });
    return res.ok ? res.json() : { contradictions: [] };
  } catch { return { contradictions: [] }; }
}

export async function runBenchmark(payload: {
  conversationId?: string;
  prompt: string;
  model?: string;
  strategies?: OptimizationStrategy[];
  isLive?: boolean;
}): Promise<{ results: BenchmarkResult[] }> {
  const res = await fetch(`${API_BASE}/api/benchmark`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to run benchmark");
  return res.json();
}

export interface StreamCallbacks {
  onStart?: (data: { conversationId: string; messageId: string; appliedThinkingLevel: string }) => void;
  onDelta?: (text: string) => void;
  onStructured?: (data: any) => void;
  onValidation?: (data: any) => void;
  onProtocolValidationError?: (data: { errors: string[]; rawJson?: string }) => void;
  onUsage?: (data: any) => void;
  onCompaction?: (data: any) => void;
  onDone?: () => void;
  onError?: (err: Error) => void;
}

export function streamChatMessage(
  conversationId: string,
  payload: {
    message?: string;
    userEvent?: any;
    model?: string;
    strategy?: OptimizationStrategy;
    preset?: PresetMode;
    responseMode?: ResponseMode;
    thinkingLevel?: ThinkingLevel;
    contextBudget?: number;
    recentTurnsToKeep?: number;
    careerContext?: any;
    systemPromptMode?: string;
    customSystemPrompt?: string;
    userContext?: { date?: string; timezone?: string; location?: string };
    userProfileFacts?: string[];
  },
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): () => void {
  const controller = new AbortController();
  // Always use controller.signal for fetch so the returned cancel fn works.
  // When caller passes their own signal, forward its abort into our controller.
  if (signal) signal.addEventListener("abort", () => controller.abort(), { once: true });

  (async () => {
    let doneCalled = false;
    const triggerDone = () => {
      if (!doneCalled) {
        doneCalled = true;
        if (callbacks.onDone) callbacks.onDone();
      }
    };

    try {
      const response = await fetch(`${API_BASE}/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Chat streaming failed with status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let currentEvent = ""; // must persist across chunk boundaries

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.substring(7).trim();
          } else if (line.startsWith("data: ")) {
            const dataStr = line.substring(6).trim();
            if (dataStr) {
              try {
                const data = JSON.parse(dataStr);
                if (currentEvent === "start" && callbacks.onStart) callbacks.onStart(data);
                else if (currentEvent === "delta" && callbacks.onDelta) callbacks.onDelta(typeof data === "string" ? data : data.delta || "");
                else if (currentEvent === "structured" && callbacks.onStructured) callbacks.onStructured(data);
                else if (currentEvent === "validation" && callbacks.onValidation) callbacks.onValidation(data);
                else if (currentEvent === "protocol_validation_error" && callbacks.onProtocolValidationError) callbacks.onProtocolValidationError(data);
                else if (currentEvent === "usage" && callbacks.onUsage) callbacks.onUsage(data);
                else if (currentEvent === "compaction" && callbacks.onCompaction) callbacks.onCompaction(data);
                else if (currentEvent === "done") triggerDone();
                else if (currentEvent === "error" && callbacks.onError) {
                  const e: any = new Error(data.error || "Streaming error");
                  if (data.errorCode) e.errorCode = data.errorCode;
                  callbacks.onError(e);
                }
              } catch (e) {
                // If text is direct string
                if (currentEvent === "delta" && callbacks.onDelta) {
                  callbacks.onDelta(dataStr);
                }
              }
            }
          }
        }
      }

      triggerDone();
    } catch (err: any) {
      if (err.name !== "AbortError" && callbacks.onError) {
        callbacks.onError(err);
      }
    }
  })();

  return () => controller.abort();
}
