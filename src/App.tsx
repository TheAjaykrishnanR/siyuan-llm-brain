import { useState, useRef, useEffect, useCallback } from "react";
import { Plugin } from "siyuan";
import ChatInput from "@/components/chat-input";
import { MessageItem } from "@/components/message-item";
import { PromptInputProvider } from "@/components/ai-elements/prompt-input";
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import { listModels, streamChat } from "@/lib/llm";
import { getNoteContent } from "@/lib/siyuan";

import { 
    Attachments, 
    Attachment, 
    AttachmentPreview, 
    AttachmentInfo 
} from "@/components/ai-elements/attachments";
import { nanoid } from "nanoid";
import { Trash2Icon, MessageSquareIcon, PlusIcon, PanelLeftIcon, MoreHorizontal, SettingsIcon, XIcon, SearchIcon, ChevronDownIcon, Edit3Icon, RefreshCwIcon, CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    attachments?: PromptInputMessage["files"];
}

interface Chat {
    id: string;
    title: string;
}

interface ChatMessages {
    [chatId: string]: Message[];
}

interface ApiKeys {
    gemini: string;
    deepseek: string;
    openai: string;
    llamacpp: string;
    claude: string;
}

interface BaseUrls {
    gemini: string;
    deepseek: string;
    openai: string;
    llamacpp: string;
    claude: string;
}

interface SelectedModels {
    gemini: string;
    deepseek: string;
    openai: string;
    llamacpp: string;
    claude: string;
    [providerId: string]: string;
}

type Provider = string;

const DEFAULT_BASE_URLS: BaseUrls = {
    gemini: "https://generativelanguage.googleapis.com/v1beta",
    deepseek: "https://api.deepseek.com/v1",
    openai: "https://api.openai.com/v1",
    llamacpp: "http://localhost:8080/v1",
    claude: "https://api.anthropic.com/v1",
};

interface AppProps {
    plugin?: Plugin;
}

interface CustomProvider {
    id: string;
    name: string;
    baseUrl: string;
    apiKey: string;
}

function App({ plugin }: AppProps) {
    const [allMessages, setAllMessages] = useState<ChatMessages>({
        "1": [{ id: "1", role: "assistant", content: "Hello! How can I help you today?" }]
    });
    const [chats, setChats] = useState<Chat[]>([
        { id: "1", title: "New Chat" },
    ]);
    const [activeChatId, setActiveChatId] = useState<string>("1");
    const [searchQuery, setSearchQuery] = useState("");
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [activeView, setActiveView] = useState<"chat" | "settings">("chat");
    const [activeSettingProvider, setActiveSettingProvider] = useState<string>("gemini");
    const [defaultProvider, setDefaultProvider] = useState<string>("gemini");
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, messageId: string, content: string } | null>(null);
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

    const [apiKeys, setApiKeys] = useState<ApiKeys>({
        gemini: "",
        deepseek: "",
        openai: "",
        llamacpp: "",
        claude: "",
    });
    const [baseUrls, setBaseUrls] = useState<BaseUrls>(DEFAULT_BASE_URLS);

    const [providerModels, setProviderModels] = useState<Record<string, string[]>>({
        gemini: [],
        deepseek: [],
        openai: [],
        llamacpp: [],
        claude: [],
    });

    const [selectedModels, setSelectedModels] = useState<SelectedModels>({
        gemini: "",
        deepseek: "",
        openai: "",
        llamacpp: "",
        claude: "",
    });

    const [customProviders, setCustomProviders] = useState<CustomProvider[]>([]);
    const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const messages = allMessages[activeChatId] || [];

    const isAllMessagesLoadedRef = useRef(false);
    const isChatsLoadedRef = useRef(false);
    const isActiveChatIdLoadedRef = useRef(false);
    const isApiKeysLoadedRef = useRef(false);
    const isBaseUrlsLoadedRef = useRef(false);
    const isSelectedModelsLoadedRef = useRef(false);
    const isActiveProviderLoadedRef = useRef(false);
    const isDefaultProviderLoadedRef = useRef(false);
    const isCustomProvidersLoadedRef = useRef(false);

    // Initial Loading Effect
    useEffect(() => {
        if (plugin) {
            Promise.all([
                plugin.loadData("chat_messages_map").then((data) => {
                    if (data) setAllMessages(data);
                    isAllMessagesLoadedRef.current = true;
                }),
                plugin.loadData("chat_history").then((data) => {
                    if (data) setChats(data);
                    isChatsLoadedRef.current = true;
                }),
                plugin.loadData("active_chat_id").then((data) => {
                    if (data !== null && data !== undefined) setActiveChatId(data);
                    isActiveChatIdLoadedRef.current = true;
                }),
                plugin.loadData("api_keys").then((data) => {
                    if (data) setApiKeys(prev => ({ ...prev, ...data }));
                    isApiKeysLoadedRef.current = true;
                }),
                plugin.loadData("base_urls").then((data) => {
                    if (data) setBaseUrls(prev => ({ ...prev, ...data }));
                    isBaseUrlsLoadedRef.current = true;
                }),
                plugin.loadData("selected_models").then((data) => {
                    if (data) setSelectedModels(prev => ({ ...prev, ...data }));
                    isSelectedModelsLoadedRef.current = true;
                }),
                plugin.loadData("active_provider").then((data) => {
                    if (data) setActiveSettingProvider(data);
                    isActiveProviderLoadedRef.current = true;
                }),
                plugin.loadData("default_provider").then((data) => {
                    if (data) setDefaultProvider(data);
                    isDefaultProviderLoadedRef.current = true;
                }),
                plugin.loadData("custom_providers").then((data) => {
                    if (data) setCustomProviders(data);
                    isCustomProvidersLoadedRef.current = true;
                })
            ]).catch((err) => {
                console.error("Error loading initial data from SiYuan", err);
            }).finally(() => {
                setIsInitialLoadComplete(true);
            });
        } else {
            // Web browser development environment fallback
            const savedMessages = localStorage.getItem("chat_messages_map");
            if (savedMessages) setAllMessages(JSON.parse(savedMessages));
            isAllMessagesLoadedRef.current = true;

            const savedChats = localStorage.getItem("chat_history");
            if (savedChats) setChats(JSON.parse(savedChats));
            isChatsLoadedRef.current = true;

            const savedActive = localStorage.getItem("active_chat_id");
            if (savedActive !== null) setActiveChatId(savedActive);
            isActiveChatIdLoadedRef.current = true;

            const savedKeys = localStorage.getItem("api_keys");
            if (savedKeys) setApiKeys(prev => ({ ...prev, ...JSON.parse(savedKeys) }));
            isApiKeysLoadedRef.current = true;

            const savedUrls = localStorage.getItem("base_urls");
            if (savedUrls) setBaseUrls(prev => ({ ...prev, ...JSON.parse(savedUrls) }));
            isBaseUrlsLoadedRef.current = true;

            const savedModels = localStorage.getItem("selected_models");
            if (savedModels) setSelectedModels(prev => ({ ...prev, ...JSON.parse(savedModels) }));
            isSelectedModelsLoadedRef.current = true;

            const savedProvider = localStorage.getItem("active_provider");
            if (savedProvider) setActiveSettingProvider(savedProvider);
            isActiveProviderLoadedRef.current = true;

            const savedDefault = localStorage.getItem("default_provider");
            if (savedDefault) setDefaultProvider(savedDefault);
            isDefaultProviderLoadedRef.current = true;

            const savedCustom = localStorage.getItem("custom_providers");
            if (savedCustom) setCustomProviders(JSON.parse(savedCustom));
            isCustomProvidersLoadedRef.current = true;

            setIsInitialLoadComplete(true);
        }
    }, [plugin]);

    // Keep activeChatId in sync with chats list to prevent orphan states
    useEffect(() => {
        if (!isChatsLoadedRef.current || !isActiveChatIdLoadedRef.current) return;
        if (chats.length === 0) {
            if (activeChatId !== "") {
                setActiveChatId("");
            }
        } else {
            const exists = chats.some(c => c.id === activeChatId);
            if (!exists) {
                setActiveChatId(chats[0].id);
            }
        }
    }, [chats, activeChatId]);

    // Save chat messages with debounce & flush
    const pendingMessagesSaveRef = useRef<(() => void) | null>(null);
    useEffect(() => {
        if (!isAllMessagesLoadedRef.current) return;
        const save = () => {
            if (plugin) {
                plugin.saveData("chat_messages_map", allMessages)
                    .catch(err => console.error("Failed to save chat_messages_map", err));
            } else {
                localStorage.setItem("chat_messages_map", JSON.stringify(allMessages));
            }
            pendingMessagesSaveRef.current = null;
        };
        pendingMessagesSaveRef.current = save;
        const timer = setTimeout(save, 1000);
        return () => {
            clearTimeout(timer);
            if (pendingMessagesSaveRef.current) {
                pendingMessagesSaveRef.current();
            }
        };
    }, [allMessages, plugin]);

    // Save chats list immediately
    useEffect(() => {
        if (!isChatsLoadedRef.current) return;
        if (plugin) {
            plugin.saveData("chat_history", chats)
                .catch(err => console.error("Failed to save chat_history", err));
        } else {
            localStorage.setItem("chat_history", JSON.stringify(chats));
        }
    }, [chats, plugin]);

    // Save active chat ID immediately
    useEffect(() => {
        if (!isActiveChatIdLoadedRef.current) return;
        if (plugin) {
            plugin.saveData("active_chat_id", activeChatId)
                .catch(err => console.error("Failed to save active_chat_id", err));
        } else {
            localStorage.setItem("active_chat_id", activeChatId);
        }
    }, [activeChatId, plugin]);

    // Save API keys with debounce & flush
    const pendingApiKeysSaveRef = useRef<(() => void) | null>(null);
    useEffect(() => {
        if (!isApiKeysLoadedRef.current) return;
        const save = () => {
            if (plugin) {
                plugin.saveData("api_keys", apiKeys)
                    .catch(err => console.error("Failed to save api_keys to SiYuan", err));
            } else {
                localStorage.setItem("api_keys", JSON.stringify(apiKeys));
            }
            pendingApiKeysSaveRef.current = null;
        };
        pendingApiKeysSaveRef.current = save;
        const timer = setTimeout(save, 500);
        return () => {
            clearTimeout(timer);
            if (pendingApiKeysSaveRef.current) {
                pendingApiKeysSaveRef.current();
            }
        };
    }, [apiKeys, plugin]);

    // Save Base URLs with debounce & flush
    const pendingBaseUrlsSaveRef = useRef<(() => void) | null>(null);
    useEffect(() => {
        if (!isBaseUrlsLoadedRef.current) return;
        const save = () => {
            if (plugin) {
                plugin.saveData("base_urls", baseUrls)
                    .catch(err => console.error("Failed to save base_urls to SiYuan", err));
            } else {
                localStorage.setItem("base_urls", JSON.stringify(baseUrls));
            }
            pendingBaseUrlsSaveRef.current = null;
        };
        pendingBaseUrlsSaveRef.current = save;
        const timer = setTimeout(save, 500);
        return () => {
            clearTimeout(timer);
            if (pendingBaseUrlsSaveRef.current) {
                pendingBaseUrlsSaveRef.current();
            }
        };
    }, [baseUrls, plugin]);

    // Save Selected Models with debounce & flush
    const pendingSelectedModelsSaveRef = useRef<(() => void) | null>(null);
    useEffect(() => {
        if (!isSelectedModelsLoadedRef.current) return;
        const save = () => {
            if (plugin) {
                plugin.saveData("selected_models", selectedModels)
                    .catch(err => console.error("Failed to save selected_models to SiYuan", err));
            } else {
                localStorage.setItem("selected_models", JSON.stringify(selectedModels));
            }
            pendingSelectedModelsSaveRef.current = null;
        };
        pendingSelectedModelsSaveRef.current = save;
        const timer = setTimeout(save, 500);
        return () => {
            clearTimeout(timer);
            if (pendingSelectedModelsSaveRef.current) {
                pendingSelectedModelsSaveRef.current();
            }
        };
    }, [selectedModels, plugin]);

    // Save Active Provider immediately
    useEffect(() => {
        if (!isActiveProviderLoadedRef.current) return;
        if (plugin) {
            plugin.saveData("active_provider", activeSettingProvider)
                .catch(err => console.error("Failed to save active_provider to SiYuan", err));
        } else {
            localStorage.setItem("active_provider", activeSettingProvider);
        }
    }, [activeSettingProvider, plugin]);

    // Save Default Provider immediately
    useEffect(() => {
        if (!isDefaultProviderLoadedRef.current) return;
        if (plugin) {
            plugin.saveData("default_provider", defaultProvider)
                .catch(err => console.error("Failed to save default_provider to SiYuan", err));
        } else {
            localStorage.setItem("default_provider", defaultProvider);
        }
    }, [defaultProvider, plugin]);

    // Save Custom Providers with debounce & flush
    const pendingCustomProvidersSaveRef = useRef<(() => void) | null>(null);
    useEffect(() => {
        if (!isCustomProvidersLoadedRef.current) return;
        const save = () => {
            if (plugin) {
                plugin.saveData("custom_providers", customProviders)
                    .catch(err => console.error("Failed to save custom_providers to SiYuan", err));
            } else {
                localStorage.setItem("custom_providers", JSON.stringify(customProviders));
            }
            pendingCustomProvidersSaveRef.current = null;
        };
        pendingCustomProvidersSaveRef.current = save;
        const timer = setTimeout(save, 500);
        return () => {
            clearTimeout(timer);
            if (pendingCustomProvidersSaveRef.current) {
                pendingCustomProvidersSaveRef.current();
            }
        };
    }, [customProviders, plugin]);

    // Model Fetching Logic
    const fetchModelsForProvider = async (provider: string) => {
        const custom = customProviders.find(p => p.id === provider);
        const isStandard = ["gemini", "openai", "claude", "deepseek", "llamacpp"].includes(provider);
        const key = custom ? custom.apiKey : (isStandard ? apiKeys[provider as keyof ApiKeys] : "");
        const url = custom ? custom.baseUrl : (isStandard ? baseUrls[provider as keyof BaseUrls] : "");

        if (key || provider === "llamacpp" || custom) {
            const models = await listModels(provider, key, url);
            setProviderModels(prev => ({ ...prev, [provider]: models }));
            
            // Auto-select first model if none selected
            if (!selectedModels[provider] && models.length > 0) {
                setSelectedModels(prev => ({ ...prev, [provider]: models[0] }));
            }
        }
    };

    useEffect(() => {
        if (activeSettingProvider) {
            fetchModelsForProvider(activeSettingProvider);
        }
    }, [activeSettingProvider, apiKeys, baseUrls, customProviders]);

    const filteredChats = chats.filter(chat => 
        chat.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const deleteChat = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setChats(prev => prev.filter(chat => chat.id !== id));
        setAllMessages(prev => {
            const next = { ...prev };
            delete next[id];
            return next;
        });
        if (activeChatId === id) {
            setActiveChatId(chats.find(c => c.id !== id)?.id || "");
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Store latest state in refs for use in stable callbacks
    const stateRef = useRef({ 
        messages, 
        activeChatId, 
        activeSettingProvider, 
        apiKeys, 
        baseUrls, 
        selectedModels,
        customProviders
    });
    
    useEffect(() => {
        stateRef.current = { 
            messages, 
            activeChatId, 
            activeSettingProvider, 
            apiKeys, 
            baseUrls, 
            selectedModels,
            customProviders
        };
    }, [messages, activeChatId, activeSettingProvider, apiKeys, baseUrls, selectedModels, customProviders]);

    const handleSend = async (message: PromptInputMessage) => {
        if (!message.text.trim() && (!message.files || message.files.length === 0)) {
            return;
        }

        // Fetch content for note attachments
        const noteAttachments = message.files?.filter(f => f.mediaType === "application/x-siyuan-note") || [];
        let enhancedContent = message.text;

        if (noteAttachments.length > 0) {
            const noteContents = await Promise.all(
                noteAttachments.map(async (n) => {
                    const content = await getNoteContent(n.url);
                    return `--- START OF NOTE: ${n.filename || n.name} ---\n${content}\n--- END OF NOTE: ${n.filename || n.name} ---`;
                })
            );
            enhancedContent = `${message.text}\n\nContext from SiYuan Notes:\n${noteContents.join("\n\n")}`;
        }

        let currentId = activeChatId;
        let isNewChat = false;

        // Automatically create a new chat if activeChatId is empty, if chats is empty,
        // or if the current activeChatId doesn't exist in the chats history.
        if (!currentId || chats.length === 0 || !chats.some(c => c.id === currentId)) {
            currentId = nanoid();
            isNewChat = true;
        }

        const newMessage: Message = {
            id: nanoid(),
            role: "user",
            content: message.text, // Store original text for UI
            attachments: message.files,
        };

        const updatedMessages = isNewChat ? [newMessage] : [...messages, newMessage];
        
        // Use enhanced content for the actual LLM call but keep UI message clean
        const messagesForLLM = updatedMessages.map(m => {
            if (m.id === newMessage.id) {
                return { ...m, content: enhancedContent };
            }
            return m;
        });

        setAllMessages(prev => ({
            ...prev,
            [currentId]: updatedMessages
        }));

        if (isNewChat) {
            const newChat: Chat = {
                id: currentId,
                title: message.text.slice(0, 30) || "New Chat",
            };
            setChats(prev => [newChat, ...prev]);
            setActiveChatId(currentId);
        } else {
            if (messages.length <= 1 && (messages[0]?.content === "Hello! How can I help you today?" || messages.length === 0)) {
                setChats(prev => prev.map(c => c.id === currentId ? { ...c, title: message.text.slice(0, 30) || "New Chat" } : c));
            }
        }

        const assistantMessageId = nanoid();
        const assistantPlaceholder: Message = {
            id: assistantMessageId,
            role: "assistant",
            content: "",
        };
        
        setAllMessages(prev => ({
            ...prev,
            [currentId]: [...updatedMessages, assistantPlaceholder]
        }));

        setIsGenerating(true);
        const controller = new AbortController();
        abortControllerRef.current = controller;

        const custom = customProviders.find(p => p.id === activeSettingProvider);
        const isStandard = ["gemini", "openai", "claude", "deepseek", "llamacpp"].includes(activeSettingProvider);
        const key = custom ? custom.apiKey : (isStandard ? apiKeys[activeSettingProvider as keyof ApiKeys] : "");
        const url = custom ? custom.baseUrl : (isStandard ? baseUrls[activeSettingProvider as keyof BaseUrls] : "");

        // Execute the streaming generation in the background so handleSend can return immediately
        // and the UI can clear the input field.
        const executeGeneration = async () => {
            try {
                const result = await streamChat({
                    messages: messagesForLLM as any, // Send enhanced content
                    provider: activeSettingProvider,
                    apiKey: key,
                    baseUrl: url,
                    modelId: selectedModels[activeSettingProvider],
                });

                let fullContent = "";
                for await (const chunk of result.textStream) {
                    if (controller.signal.aborted) break;
                    fullContent += chunk;
                    setAllMessages(prev => ({
                        ...prev,
                        [currentId]: (prev[currentId] || []).map(m => m.id === assistantMessageId ? { ...m, content: fullContent } : m)
                    }));
                }
            } catch (error: any) {
                if (error.name === 'AbortError') {
                    console.log('Chat aborted');
                } else {
                    console.error('Chat Error:', error);
                    setAllMessages(prev => ({
                        ...prev,
                        [currentId]: (prev[currentId] || []).map(m => m.id === assistantMessageId ? { ...m, content: `Error: ${error.message}` } : m)
                    }));
                }
            } finally {
                setIsGenerating(false);
                if (abortControllerRef.current === controller) {
                    abortControllerRef.current = null;
                }
            }
        };

        executeGeneration();
    };

    const stopGeneration = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            setIsGenerating(false);
        }
    };

    const deleteMessage = useCallback((id: string) => {
        setAllMessages(prev => ({
            ...prev,
            [stateRef.current.activeChatId]: (prev[stateRef.current.activeChatId] || []).filter(m => m.id !== id)
        }));
    }, []);

    const startEditing = useCallback((id: string, content: string) => {
        setEditingMessageId(id);
        setEditContent(content);
    }, []);

    const saveEdit = useCallback(() => {
        setAllMessages(prev => ({
            ...prev,
            [stateRef.current.activeChatId]: (prev[stateRef.current.activeChatId] || []).map(m => m.id === editingMessageId ? { ...m, content: editContent } : m)
        }));
        setEditingMessageId(null);
    }, [editingMessageId, editContent]);

    const cancelEdit = useCallback(() => {
        setEditingMessageId(null);
    }, []);

    const regenerateMessage = useCallback(async (id: string) => {
        const { 
            messages: currentMessages, 
            activeChatId: currentId, 
            activeSettingProvider: provider, 
            apiKeys: keys, 
            baseUrls: urls, 
            selectedModels: models,
            customProviders: currentCustomProviders
        } = stateRef.current;
        const index = currentMessages.findIndex(m => m.id === id);
        if (index === -1) return;

        const history = currentMessages.slice(0, index);
        
        const assistantMessageId = nanoid();
        const assistantPlaceholder: Message = {
            id: assistantMessageId,
            role: "assistant",
            content: "",
        };
        
        setAllMessages(prev => ({
            ...prev,
            [currentId]: [...history, assistantPlaceholder]
        }));

        setIsGenerating(true);
        const controller = new AbortController();
        abortControllerRef.current = controller;

        const custom = currentCustomProviders.find(p => p.id === provider);
        const isStandard = ["gemini", "openai", "claude", "deepseek", "llamacpp"].includes(provider);
        const key = custom ? custom.apiKey : (isStandard ? keys[provider as keyof ApiKeys] : "");
        const url = custom ? custom.baseUrl : (isStandard ? urls[provider as keyof BaseUrls] : "");

        try {
            const result = await streamChat({
                messages: history,
                provider,
                apiKey: key,
                baseUrl: url,
                modelId: models[provider],
            });

            let fullContent = "";
            for await (const chunk of result.textStream) {
                if (controller.signal.aborted) break;
                fullContent += chunk;
                setAllMessages(prev => ({
                    ...prev,
                    [currentId]: (prev[currentId] || []).map(m => m.id === assistantMessageId ? { ...m, content: fullContent } : m)
                }));
            }
        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.log('Regenerate aborted');
            } else {
                console.error('Regenerate Error:', error);
                setAllMessages(prev => ({
                    ...prev,
                    [currentId]: (prev[currentId] || []).map(m => m.id === assistantMessageId ? { ...m, content: `Error: ${error.message}` } : m)
                }));
            }
        } finally {
            setIsGenerating(false);
            abortControllerRef.current = null;
        }
    }, []);

    const handleModelChange = (model: string) => {
        setSelectedModels(prev => ({ ...prev, [activeSettingProvider]: model }));
    };

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

    const setDefaultProviderAndActive = (p: Provider) => {
        setDefaultProvider(p);
        setActiveSettingProvider(p);
    };

    const handleRevertApiKey = () => {
        setApiKeys(prev => ({
            ...prev,
            [activeSettingProvider as keyof ApiKeys]: activeSettingProvider === "llamacpp" ? "http://localhost:8080/v1" : ""
        }));
    };

    const handleRevertBaseUrl = () => {
        setBaseUrls(prev => ({
            ...prev,
            [activeSettingProvider as keyof BaseUrls]: DEFAULT_BASE_URLS[activeSettingProvider as keyof BaseUrls]
        }));
    };

    const createNewChat = () => {
        const newId = nanoid();
        const newChat: Chat = { id: newId, title: "New Chat" };
        setChats([newChat, ...chats]);
        setAllMessages(prev => ({
            ...prev,
            [newId]: [{ id: nanoid(), role: "assistant", content: "Hello! How can I help you today?" }]
        }));
        setActiveChatId(newId);
    };

    useEffect(() => {
        const handleClickOutside = () => setContextMenu(null);
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, []);

    const handleContextMenu = useCallback((e: React.MouseEvent, messageId: string, content: string) => {
        e.preventDefault();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            messageId,
            content
        });
    }, []);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setContextMenu(null);
    };

    const getProviderDisplayName = (providerId: string) => {
        if (providerId === "llamacpp") return "llama.cpp";
        const custom = customProviders.find(p => p.id === providerId);
        if (custom) return custom.name;
        return providerId;
    };

    if (!isInitialLoadComplete) {
        return (
            <div className="flex h-full w-full bg-background text-foreground items-center justify-center font-sans select-none dark">
                <div className="flex flex-col items-center gap-4">
                    <div className="size-10 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center shadow-xl animate-pulse">
                        <MessageSquareIcon className="size-5 text-primary/80 animate-bounce" />
                    </div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest animate-pulse">Loading LLM Brain...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full w-full bg-background text-foreground overflow-hidden font-sans select-text">
            {/* Context Menu */}
            {contextMenu && (
                <div 
                    className="fixed z-[9999] bg-popover border rounded-md shadow-md py-1 min-w-[120px] animate-in fade-in zoom-in-95 duration-100"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button 
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground transition-colors"
                        onClick={() => copyToClipboard(contextMenu.content)}
                    >
                        Copy Text
                    </button>
                    <button 
                        className="w-full text-left px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 transition-colors"
                        onClick={() => {
                            deleteMessage(contextMenu.messageId);
                            setContextMenu(null);
                        }}
                    >
                        Delete Message
                    </button>
                </div>
            )}
            {/* Sidebar */}
            <aside 
                className={`flex flex-col border-r bg-muted/30 transition-[margin] duration-300 ease-in-out overflow-hidden shrink-0 ${
                    sidebarOpen ? "ml-0" : "-ml-64"
                } w-64`}
            >
                <div className="flex flex-col h-full w-64">
                    <div className="px-3 py-3 border-b flex items-center gap-2 h-[57px]">
                        <div className="relative flex-1">
                            <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-background border rounded-md pl-7 pr-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/30"
                            />
                        </div>
                        <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={createNewChat}>
                            <PlusIcon className="size-4" />
                        </Button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {filteredChats.map((chat) => (
                            <div key={chat.id} className="group relative">
                                <Button 
                                    variant="ghost" 
                                    className={`w-full justify-start gap-2 font-normal text-xs px-3 py-2 h-9 overflow-hidden pr-8 ${
                                        activeChatId === chat.id 
                                            ? "bg-accent text-accent-foreground" 
                                            : "text-muted-foreground hover:text-foreground"
                                    }`}
                                    onClick={() => {
                                        setActiveView("chat");
                                        setActiveChatId(chat.id);
                                    }}
                                >
                                    <MessageSquareIcon className="size-3.5 shrink-0" />
                                    <span className="truncate">{chat.title}</span>
                                </Button>
                                <div className="absolute right-1 top-1/2 -translate-y-1/2">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="size-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <MoreHorizontal className="size-3.5 text-muted-foreground" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem 
                                                variant="destructive"
                                                onClick={(e) => deleteChat(chat.id, e)}
                                            >
                                                <Trash2Icon className="mr-2 size-3.5" />
                                                <span>Delete</span>
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="p-2 border-t">
                        <Button 
                            variant="ghost" 
                            className={`w-full justify-start gap-2 font-normal text-xs px-3 py-2 h-9 ${
                                activeView === "settings" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
                            }`}
                            onClick={() => setActiveView("settings")}
                        >
                            <SettingsIcon className="size-3.5 shrink-0" />
                            <span>Settings</span>
                        </Button>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex flex-1 flex-col overflow-hidden relative">
                <div className="flex flex-row items-center justify-between border-b px-4 py-2.5 h-[57px] shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={toggleSidebar}>
                            <PanelLeftIcon className="size-4.5 text-muted-foreground" />
                        </Button>
                        <span className="text-xs font-medium text-muted-foreground truncate">
                            {activeView === "chat" ? "Chat" : "Settings"}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {activeView === "chat" && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 text-[11px] font-normal px-3 capitalize gap-1.5 text-muted-foreground hover:text-foreground">
                                        <span>{getProviderDisplayName(activeSettingProvider)}</span>
                                        <ChevronDownIcon className="size-3" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    {(["gemini", "openai", "claude", "deepseek", "llamacpp"]).map((p) => (
                                        <DropdownMenuItem 
                                            key={p} 
                                            className="text-[11px] capitalize"
                                            onClick={() => setActiveSettingProvider(p)}
                                        >
                                            {p === "llamacpp" ? "llama.cpp" : p}
                                        </DropdownMenuItem>
                                    ))}
                                    {customProviders.length > 0 && (
                                        <div className="h-px bg-muted my-1" />
                                    )}
                                    {customProviders.map((cp) => (
                                        <DropdownMenuItem 
                                            key={cp.id} 
                                            className="text-[11px]"
                                            onClick={() => setActiveSettingProvider(cp.id)}
                                        >
                                            {cp.name}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                        {activeView === "settings" && (
                            <Button variant="ghost" size="icon" className="size-8" onClick={() => setActiveView("chat")}>
                                <XIcon className="size-4.5 text-muted-foreground" />
                            </Button>
                        )}
                    </div>
                </div>

                <main 
                    className="flex-1 overflow-y-auto px-4 py-12 md:px-6"
                    onClick={(e) => {
                        const target = e.target as HTMLElement;
                        if (target.tagName === "IMG") {
                            const src = target.getAttribute("src");
                            if (src) {
                                setPreviewImageUrl(src);
                            }
                        }
                    }}
                >
                    <div className="mx-auto max-w-3xl space-y-16 pb-32">
                        {activeView === "chat" ? (
                            messages.length === 0 ? null : (
                                <>
                                    {messages.map((message) => (
                                        <MessageItem 
                                            key={message.id}
                                            message={message}
                                            isEditing={editingMessageId === message.id}
                                            editContent={editContent}
                                            onEditContentChange={setEditContent}
                                            onSaveEdit={saveEdit}
                                            onCancelEdit={cancelEdit}
                                            onStartEditing={startEditing}
                                            onDelete={deleteMessage}
                                            onRegenerate={regenerateMessage}
                                            onContextMenu={handleContextMenu}
                                        />
                                    ))}
                                    <div ref={messagesEndRef} />
                                </>
                            )
                        ) : (
                            <div className="flex gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <aside className="w-32 shrink-0 flex flex-col gap-1 max-h-[70vh] overflow-y-auto pr-1">
                                    <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1">Standard</div>
                                    {(["gemini", "openai", "claude", "deepseek", "llamacpp"]).map((p) => (
                                        <Button
                                            key={p}
                                            variant="ghost"
                                            className={`justify-between text-xs h-9 capitalize ${
                                                activeSettingProvider === p ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                                            }`}
                                            onClick={() => setActiveSettingProvider(p)}
                                        >
                                            <span className="truncate pr-2">{p === "llamacpp" ? "llama.cpp" : p}</span>
                                            {defaultProvider === p && (
                                                <CheckIcon className="size-3 text-primary shrink-0" />
                                            )}
                                        </Button>
                                    ))}
                                    
                                    <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mt-4 mb-1">Custom</div>
                                    {customProviders.map((cp) => (
                                        <Button
                                            key={cp.id}
                                            variant="ghost"
                                            className={`justify-between text-xs h-9 ${
                                                activeSettingProvider === cp.id ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                                            }`}
                                            onClick={() => setActiveSettingProvider(cp.id)}
                                        >
                                            <span className="truncate pr-2">{cp.name}</span>
                                            {defaultProvider === cp.id && (
                                                <CheckIcon className="size-3 text-primary shrink-0" />
                                            )}
                                        </Button>
                                    ))}

                                    <Button
                                        variant="outline"
                                        className="text-xs h-8 mt-2 justify-start gap-1 px-2 border-dashed w-full shrink-0"
                                        onClick={() => {
                                            const newId = `custom-${nanoid()}`;
                                            const newProvider: CustomProvider = {
                                                id: newId,
                                                name: "New Provider",
                                                baseUrl: "",
                                                apiKey: "",
                                            };
                                            setCustomProviders(prev => [...prev, newProvider]);
                                            setActiveSettingProvider(newId);
                                        }}
                                    >
                                        <PlusIcon className="size-3" />
                                        <span>Add Custom</span>
                                    </Button>
                                </aside>
                                <div className="flex-1 space-y-6 min-w-0">
                                    {activeSettingProvider.startsWith("custom-") ? (
                                        (() => {
                                            const customProvider = customProviders.find(p => p.id === activeSettingProvider);
                                            if (!customProvider) return null;
                                            return (
                                                <>
                                                    <div className="flex justify-between items-start">
                                                        <div className="space-y-1">
                                                            <h2 className="text-lg font-semibold">
                                                                Custom Settings
                                                            </h2>
                                                            <p className="text-sm text-muted-foreground">
                                                                Manage custom OpenAI-compatible endpoint.
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {defaultProvider !== activeSettingProvider && (
                                                                <Button 
                                                                    variant="outline" 
                                                                    size="sm" 
                                                                    className="text-[10px] h-7"
                                                                    onClick={() => setDefaultProviderAndActive(activeSettingProvider)}
                                                                >
                                                                    Set as Default
                                                                </Button>
                                                            )}
                                                            <Button
                                                                variant="destructive"
                                                                size="sm"
                                                                className="text-[10px] h-7 gap-1"
                                                                onClick={() => {
                                                                    setCustomProviders(prev => prev.filter(p => p.id !== activeSettingProvider));
                                                                    if (defaultProvider === activeSettingProvider) {
                                                                        setDefaultProvider("gemini");
                                                                    }
                                                                    setActiveSettingProvider("gemini");
                                                                }}
                                                            >
                                                                <Trash2Icon className="size-3" />
                                                                <span>Delete</span>
                                                            </Button>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="space-y-4">
                                                        <div className="space-y-2">
                                                            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                                                Provider Name
                                                            </label>
                                                            <Input 
                                                                type="text" 
                                                                placeholder="e.g. OpenRouter" 
                                                                value={customProvider.name}
                                                                onChange={(e) => {
                                                                    const updatedName = e.target.value;
                                                                    setCustomProviders(prev => prev.map(p => p.id === activeSettingProvider ? { ...p, name: updatedName } : p));
                                                                }}
                                                            />
                                                        </div>

                                                        <div className="space-y-2">
                                                            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                                                Base URL
                                                            </label>
                                                            <Input 
                                                                type="text" 
                                                                placeholder="https://api.openai.com/v1" 
                                                                value={customProvider.baseUrl}
                                                                onChange={(e) => {
                                                                    const updatedUrl = e.target.value;
                                                                    setCustomProviders(prev => prev.map(p => p.id === activeSettingProvider ? { ...p, baseUrl: updatedUrl } : p));
                                                                }}
                                                            />
                                                        </div>

                                                        <div className="space-y-2">
                                                            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                                                API Key (Optional)
                                                            </label>
                                                            <Input 
                                                                type="password" 
                                                                placeholder="Enter API Key" 
                                                                value={customProvider.apiKey}
                                                                onChange={(e) => {
                                                                    const updatedKey = e.target.value;
                                                                    setCustomProviders(prev => prev.map(p => p.id === activeSettingProvider ? { ...p, apiKey: updatedKey } : p));
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                </>
                                            );
                                        })()
                                    ) : (
                                        <>
                                            <div className="flex justify-between items-start">
                                                <div className="space-y-1">
                                                    <h2 className="text-lg font-semibold capitalize">
                                                        {activeSettingProvider === "llamacpp" ? "llama.cpp" : activeSettingProvider} Settings
                                                    </h2>
                                                    <p className="text-sm text-muted-foreground">
                                                        Manage your {activeSettingProvider === "llamacpp" ? "llama.cpp server URL" : `${activeSettingProvider} API key`}.
                                                    </p>
                                                </div>
                                                {defaultProvider !== activeSettingProvider && (
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        className="text-[10px] h-7"
                                                        onClick={() => setDefaultProviderAndActive(activeSettingProvider)}
                                                    >
                                                        Set as Default
                                                    </Button>
                                                )}
                                            </div>
                                            
                                            <div className="space-y-4">
                                                <div className="space-y-2">
                                                    <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                                        {activeSettingProvider === "llamacpp" ? "Server URL" : "API Key"}
                                                    </label>
                                                    {activeSettingProvider === "llamacpp" ? (
                                                        <div className="flex gap-2">
                                                            <Input 
                                                                type="text" 
                                                                placeholder="http://localhost:8080" 
                                                                value={apiKeys[activeSettingProvider]}
                                                                onChange={(e) => setApiKeys(prev => ({ ...prev, [activeSettingProvider]: e.target.value }))}
                                                                className="flex-1"
                                                            />
                                                            <Button
                                                                variant="outline"
                                                                size="icon"
                                                                className="size-9 shrink-0"
                                                                onClick={handleRevertApiKey}
                                                                title="Revert to default Server URL"
                                                            >
                                                                <RefreshCwIcon className="size-4" />
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <Input 
                                                            type="password" 
                                                            placeholder={`Enter ${activeSettingProvider} API key`} 
                                                            value={apiKeys[activeSettingProvider as keyof ApiKeys]}
                                                            onChange={(e) => setApiKeys(prev => ({ ...prev, [activeSettingProvider]: e.target.value }))}
                                                        />
                                                    )}
                                                </div>
                                                {activeSettingProvider !== "llamacpp" && (
                                                    <div className="space-y-2">
                                                        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                                            Base URL
                                                        </label>
                                                        <div className="flex gap-2">
                                                            <Input 
                                                                type="text" 
                                                                placeholder={`Enter ${activeSettingProvider} base URL`} 
                                                                value={baseUrls[activeSettingProvider as keyof BaseUrls]}
                                                                onChange={(e) => setBaseUrls(prev => ({ ...prev, [activeSettingProvider]: e.target.value }))}
                                                                className="flex-1"
                                                            />
                                                            <Button
                                                                variant="outline"
                                                                size="icon"
                                                                className="size-9 shrink-0"
                                                                onClick={handleRevertBaseUrl}
                                                                title="Revert to default Base URL"
                                                            >
                                                                <RefreshCwIcon className="size-4" />
                                                            </Button>
                                                        </div>
                                                        <p className="text-[10px] text-muted-foreground">
                                                            Default: {DEFAULT_BASE_URLS[activeSettingProvider as keyof BaseUrls]}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="pt-4 text-center">
                                                <span className="text-xs text-muted-foreground/60 italic">Settings are saved automatically</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </main>

                {activeView === "chat" && (
                    <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 pb-8 pointer-events-none overflow-visible">
                        {/* The Glow - Positioned absolute to the input area's bottom center */}
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-48 bg-gradient-to-t from-white/[0.12] to-transparent blur-3xl rounded-[100%] pointer-events-none" />
                        
                        <div className="mx-auto max-w-3xl relative pointer-events-auto">
                            <PromptInputProvider>
                                <ChatInput 
                                    onSend={handleSend} 
                                    isGenerating={isGenerating} 
                                    onStop={stopGeneration}
                                    models={providerModels[activeSettingProvider]}
                                    selectedModel={selectedModels[activeSettingProvider]}
                                    onModelChange={handleModelChange}
                                />
                            </PromptInputProvider>
                        </div>
                    </div>
                )}

                {previewImageUrl && (
                    <div 
                        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
                        onClick={() => setPreviewImageUrl(null)}
                    >
                        <button 
                            className="absolute top-4 right-4 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors cursor-pointer"
                            onClick={() => setPreviewImageUrl(null)}
                        >
                            <XIcon className="size-6" />
                        </button>
                        <div 
                            className="relative max-w-[90vw] max-h-[85vh] p-2 animate-in zoom-in-95 duration-200"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <img 
                                src={previewImageUrl} 
                                alt="Preview" 
                                className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl border border-white/10"
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default App;
