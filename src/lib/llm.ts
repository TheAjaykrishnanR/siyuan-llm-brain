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
    modelId?: string;
}

export const mapMessages = (msgs: Message[], provider?: Provider): CoreMessage[] => {
    return msgs.map(m => {
        if (m.role === "user" && m.attachments && m.attachments.length > 0) {
            const isMultimodal = provider === "openai" || provider === "gemini" || provider === "claude" || provider === "llamacpp";
            
            // Filter only image attachments
            const imageAttachments = m.attachments.filter(a => a.mediaType?.startsWith("image/"));
            
            if (isMultimodal && imageAttachments.length > 0) {
                const content: UserContent = [
                    { type: "text", text: m.content },
                    ...imageAttachments.map(a => ({
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
            
            if (!isMultimodal && imageAttachments.length > 0) {
                console.warn(`Provider ${provider} does not support image attachments. Ignoring ${imageAttachments.length} image(s).`);
            }
        }
        return {
            role: m.role as "user" | "assistant",
            content: m.content,
        };
    });
};

export async function listModels(provider: Provider, apiKey: string, baseUrl?: string): Promise<string[]> {
    if (!apiKey && provider !== "llamacpp") return [];

    try {
        if (provider === "openai") {
            const url = baseUrl ? (baseUrl.endsWith('/') ? `${baseUrl}models` : `${baseUrl}/models`) : "https://api.openai.com/v1/models";
            const resp = await fetch(url, {
                headers: { "Authorization": `Bearer ${apiKey}` }
            });
            const data = await resp.json();
            return data.data?.map((m: any) => m.id) || [];
        } else if (provider === "gemini") {
            const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
            const resp = await fetch(url);
            const data = await resp.json();
            return data.models?.map((m: any) => m.name.replace("models/", "")) || [];
        } else if (provider === "claude") {
            // Anthropic doesn't have a public models list endpoint like OpenAI, so we return known models
            return ["claude-3-5-sonnet-20241022", "claude-3-5-sonnet-20240620", "claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-haiku-20240307"];
        } else if (provider === "deepseek") {
            const url = baseUrl ? (baseUrl.endsWith('/') ? `${baseUrl}models` : `${baseUrl}/models`) : "https://api.deepseek.com/v1/models";
            const resp = await fetch(url, {
                headers: { "Authorization": `Bearer ${apiKey}` }
            });
            const data = await resp.json();
            return data.data?.map((m: any) => m.id) || [];
        } else if (provider === "llamacpp") {
            // For llamacpp, apiKey is the primary way to set the URL in the UI
            let finalUrl = apiKey;
            if (!finalUrl) finalUrl = baseUrl || "http://localhost:8080/v1";
            
            // Ensure it has /v1 for model listing if it looks like a base server URL
            if (finalUrl && !finalUrl.endsWith("/v1") && !finalUrl.endsWith("/v1/")) {
                finalUrl = finalUrl.endsWith("/") ? `${finalUrl}v1` : `${finalUrl}/v1`;
            }
            
            const modelsUrl = finalUrl.endsWith('/') ? `${finalUrl}models` : `${finalUrl}/models`;
            const resp = await fetch(modelsUrl);
            const data = await resp.json();
            return data.data?.map((m: any) => m.id) || ["llamacpp-default"];
        }
    } catch (e) {
        console.error(`Failed to list models for ${provider}:`, e);
    }
    return [];
}

export async function streamChat({ messages, provider, apiKey, baseUrl, modelId }: StreamOptions) {
    if (!apiKey && provider !== "llamacpp") {
        throw new Error(`API Key for ${provider} is missing. Please set it in Settings.`);
    }

    let model;
    const coreMessages = mapMessages(messages, provider);

    try {
        if (provider === "openai") {
            const openai = createOpenAI({
                apiKey: apiKey,
                baseURL: baseUrl,
            });
            model = openai.chat(modelId || "gpt-4o");
        } else if (provider === "gemini") {
            const google = createGoogleGenerativeAI({
                apiKey: apiKey,
                baseURL: baseUrl,
            });
            model = google(modelId || "models/gemini-1.5-pro-latest");
        } else if (provider === "claude") {
            const anthropic = createAnthropic({
                apiKey: apiKey,
                baseURL: baseUrl,
            });
            model = anthropic(modelId || "claude-3-5-sonnet-20240620");
        } else if (provider === "deepseek") {
            const deepseek = createOpenAI({
                baseURL: baseUrl || "https://api.deepseek.com/v1",
                apiKey: apiKey,
                compatibility: 'compatible',
            });
            model = deepseek.chat(modelId || "deepseek-chat");
        } else if (provider === "llamacpp") {
            // For llamacpp, apiKey is the primary way to set the URL in the UI (labeled as Server URL)
            let finalBaseUrl = apiKey;
            if (!finalBaseUrl) finalBaseUrl = baseUrl || "http://localhost:8080/v1";
            
            // Ensure it has /v1 if using OpenAI compatibility layer of llama.cpp
            if (finalBaseUrl && !finalBaseUrl.endsWith("/v1") && !finalBaseUrl.endsWith("/v1/")) {
                finalBaseUrl = finalBaseUrl.endsWith("/") ? `${finalBaseUrl}v1` : `${finalBaseUrl}/v1`;
            }

            const llamacpp = createOpenAI({
                baseURL: finalBaseUrl,
                apiKey: "not-needed",
                compatibility: 'compatible',
            });
            model = llamacpp.chat(modelId || "llamacpp-default"); 
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
