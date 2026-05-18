import { streamText, type CoreMessage, type UserContent } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";

export type Provider = "gemini" | "openai" | "claude" | "deepseek" | "llamacpp";

export interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    attachments?: any[]; // Simplified for the mapping
}

export interface StreamOptions {
    messages: Message[];
    provider: Provider;
    apiKey: string;
    baseUrl?: string;
}

export const mapMessages = (msgs: Message[]): CoreMessage[] => {
    return msgs.map(m => {
        if (m.role === "user" && m.attachments && m.attachments.length > 0) {
            const content: UserContent = [
                { type: "text", text: m.content },
                ...m.attachments.map(a => ({
                    type: "image" as const,
                    image: a.url,
                    mimeType: a.mediaType,
                }))
            ];
            return {
                role: "user",
                content,
            };
        }
        return {
            role: m.role as "user" | "assistant",
            content: m.content,
        };
    });
};

export async function streamChat({ messages, provider, apiKey, baseUrl }: StreamOptions) {
    if (!apiKey) {
        throw new Error(`API Key for ${provider} is missing. Please set it in Settings.`);
    }

    let model;
    const coreMessages = mapMessages(messages);

    try {
        if (provider === "openai") {
            const openai = createOpenAI({
                apiKey: apiKey,
                baseURL: baseUrl,
            });
            model = openai.chat("gpt-4o");
        } else if (provider === "gemini") {
            const google = createGoogleGenerativeAI({
                apiKey: apiKey,
                baseURL: baseUrl,
            });
            model = google("models/gemini-1.5-pro-latest");
        } else if (provider === "claude") {
            const anthropic = createAnthropic({
                apiKey: apiKey,
                baseURL: baseUrl,
            });
            model = anthropic("claude-3-5-sonnet-20240620");
        } else if (provider === "deepseek") {
            const deepseek = createOpenAI({
                baseURL: baseUrl || "https://api.deepseek.com/v1",
                apiKey: apiKey,
                compatibility: 'compatible',
            });
            model = deepseek.chat("deepseek-chat");
        } else if (provider === "llamacpp") {
            // apiKey here is used as the baseURL for llama.cpp as per App.tsx settings UI
            const llamacpp = createOpenAI({
                baseURL: baseUrl || (apiKey.endsWith("/v1") ? apiKey : `${apiKey}/v1`),
                apiKey: "not-needed",
                compatibility: 'compatible',
            });
            model = llamacpp.chat("gpt-3.5-turbo"); // model name doesn't matter for llama.cpp usually
        } else {
            throw new Error(`Unsupported provider: ${provider}`);
        }

        const result = await streamText({
            model,
            messages: coreMessages,
        });

        return result;
    } catch (error: any) {
        console.error("Full Error Object:", error);
        
        // Handle AI_APICallError specifically to extract more info
        if (error.name === 'AI_APICallError') {
            const details = {
                statusCode: error.statusCode,
                statusText: error.statusText,
                url: error.url,
                responseBody: error.responseBody,
            };
            console.error("AI API Call Error Details:", details);
            throw new Error(`API Call Failed (${error.statusCode || 'unknown'}): ${error.message}${error.responseBody ? ` - ${error.responseBody}` : ''}`);
        }
        
        throw error;
    }
}
