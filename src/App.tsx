import { useState, useRef, useEffect } from "react";
import ChatInput from "@/components/chat-input";
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
}

type Provider = keyof ApiKeys;

const DEFAULT_BASE_URLS: BaseUrls = {
    gemini: "https://generativelanguage.googleapis.com/v1beta",
    deepseek: "https://api.deepseek.com/v1",
    openai: "https://api.openai.com/v1",
    llamacpp: "http://localhost:8080/v1",
    claude: "https://api.anthropic.com/v1",
};

function App() {
    const [allMessages, setAllMessages] = useState<ChatMessages>(() => {
        const saved = localStorage.getItem("chat_messages_map");
        return saved ? JSON.parse(saved) : {
            "1": [{ id: "1", role: "assistant", content: "Hello! How can I help you today?" }]
        };
    });
    const [chats, setChats] = useState<Chat[]>(() => {
        const saved = localStorage.getItem("chat_history");
        return saved ? JSON.parse(saved) : [
            { id: "1", title: "New Chat" },
        ];
    });
    const [activeChatId, setActiveChatId] = useState<string>(() => {
        return localStorage.getItem("active_chat_id") || "1";
    });
    const [searchQuery, setSearchQuery] = useState("");
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [activeView, setActiveView] = useState<"chat" | "settings">("chat");
    const [activeSettingProvider, setActiveSettingProvider] = useState<Provider>(() => {
        return (localStorage.getItem("active_provider") as Provider) || "gemini";
    });
    const [defaultProvider, setDefaultProvider] = useState<Provider>(() => {
        return (localStorage.getItem("default_provider") as Provider) || "gemini";
    });
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, messageId: string, content: string } | null>(null);

    const [apiKeys, setApiKeys] = useState<ApiKeys>(() => {
        const saved = localStorage.getItem("api_keys");
        return saved ? JSON.parse(saved) : {
            gemini: "",
            deepseek: "",
            openai: "",
            llamacpp: "",
            claude: "",
        };
    });
    const [baseUrls, setBaseUrls] = useState<BaseUrls>(() => {
        const saved = localStorage.getItem("base_urls");
        return saved ? JSON.parse(saved) : DEFAULT_BASE_URLS;
    });

    const [providerModels, setProviderModels] = useState<Record<Provider, string[]>>({
        gemini: [],
        deepseek: [],
        openai: [],
        llamacpp: [],
        claude: [],
    });

    const [selectedModels, setSelectedModels] = useState<SelectedModels>(() => {
        const saved = localStorage.getItem("selected_models");
        return saved ? JSON.parse(saved) : {
            gemini: "",
            deepseek: "",
            openai: "",
            llamacpp: "",
            claude: "",
        };
    });

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const messages = allMessages[activeChatId] || [];

    // Persistence Effects
    useEffect(() => {
        localStorage.setItem("chat_messages_map", JSON.stringify(allMessages));
    }, [allMessages]);

    useEffect(() => {
        localStorage.setItem("chat_history", JSON.stringify(chats));
    }, [chats]);

    useEffect(() => {
        localStorage.setItem("active_chat_id", activeChatId);
    }, [activeChatId]);

    useEffect(() => {
        localStorage.setItem("api_keys", JSON.stringify(apiKeys));
    }, [apiKeys]);

    useEffect(() => {
        localStorage.setItem("base_urls", JSON.stringify(baseUrls));
    }, [baseUrls]);

    useEffect(() => {
        localStorage.setItem("active_provider", activeSettingProvider);
    }, [activeSettingProvider]);

    useEffect(() => {
        localStorage.setItem("default_provider", defaultProvider);
    }, [defaultProvider]);

    useEffect(() => {
        localStorage.setItem("selected_models", JSON.stringify(selectedModels));
    }, [selectedModels]);

    // Model Fetching Logic
    const fetchModelsForProvider = async (provider: Provider) => {
        const key = apiKeys[provider];
        const url = baseUrls[provider];
        if (key || provider === "llamacpp") {
            const models = await listModels(provider, key, url);
            setProviderModels(prev => ({ ...prev, [provider]: models }));
            
            // Auto-select first model if none selected
            if (!selectedModels[provider] && models.length > 0) {
                setSelectedModels(prev => ({ ...prev, [provider]: models[0] }));
            }
        }
    };

    useEffect(() => {
        fetchModelsForProvider(activeSettingProvider);
    }, [activeSettingProvider, apiKeys, baseUrls]);

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

        const currentId = activeChatId;
        const newMessage: Message = {
            id: nanoid(),
            role: "user",
            content: message.text, // Store original text for UI
            attachments: message.files,
        };

        const updatedMessages = [...messages, newMessage];
        
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

        if (messages.length <= 1 && (messages[0]?.content === "Hello! How can I help you today?" || messages.length === 0)) {
            setChats(prev => prev.map(c => c.id === currentId ? { ...c, title: message.text.slice(0, 30) || "New Chat" } : c));
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

        try {
            const result = await streamChat({
                messages: messagesForLLM as any, // Send enhanced content
                provider: activeSettingProvider,
                apiKey: apiKeys[activeSettingProvider],
                baseUrl: baseUrls[activeSettingProvider],
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
            abortControllerRef.current = null;
        }
    };

    const stopGeneration = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            setIsGenerating(false);
        }
    };

    const deleteMessage = (id: string) => {
        setAllMessages(prev => ({
            ...prev,
            [activeChatId]: (prev[activeChatId] || []).filter(m => m.id !== id)
        }));
    };

    const startEditing = (id: string, content: string) => {
        setEditingMessageId(id);
        setEditContent(content);
    };

    const saveEdit = () => {
        if (!editingMessageId) return;
        setAllMessages(prev => ({
            ...prev,
            [activeChatId]: (prev[activeChatId] || []).map(m => m.id === editingMessageId ? { ...m, content: editContent } : m)
        }));
        setEditingMessageId(null);
    };

    const regenerateMessage = async (id: string) => {
        const index = messages.findIndex(m => m.id === id);
        if (index === -1) return;

        const currentId = activeChatId;
        const history = messages.slice(0, index);
        
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

        try {
            const result = await streamChat({
                messages: history,
                provider: activeSettingProvider,
                apiKey: apiKeys[activeSettingProvider],
                baseUrl: baseUrls[activeSettingProvider],
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
    };

    const handleModelChange = (model: string) => {
        setSelectedModels(prev => ({ ...prev, [activeSettingProvider]: model }));
    };

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

    const setDefaultProviderAndActive = (p: Provider) => {
        setDefaultProvider(p);
        setActiveSettingProvider(p);
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

    const preprocessLaTeX = (content: string) => {
        return content
            .replace(/\\\[/g, '$$$$')
            .replace(/\\\]/g, '$$$$')
            .replace(/\\\(/g, '$$')
            .replace(/\\\)/g, '$$');
    };

    useEffect(() => {
        const handleClickOutside = () => setContextMenu(null);
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, []);

    const handleContextMenu = (e: React.MouseEvent, messageId: string, content: string) => {
        e.preventDefault();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            messageId,
            content
        });
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setContextMenu(null);
    };

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
                                        <span>{activeSettingProvider === "llamacpp" ? "llama.cpp" : activeSettingProvider}</span>
                                        <ChevronDownIcon className="size-3" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    {(["gemini", "openai", "claude", "deepseek", "llamacpp"] as Provider[]).map((p) => (
                                        <DropdownMenuItem 
                                            key={p} 
                                            className="text-[11px] capitalize"
                                            onClick={() => setActiveSettingProvider(p)}
                                        >
                                            {p === "llamacpp" ? "llama.cpp" : p}
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

                <main className="flex-1 overflow-y-auto px-4 py-12 md:px-6">
                    <div className="mx-auto max-w-3xl space-y-16 pb-32">
                        {activeView === "chat" ? (
                            <>
                                {messages.map((message) => (
                                    <div
                                        key={message.id}
                                        className={`flex group/message ${
                                            message.role === "user" ? "justify-end" : "justify-start w-full"
                                        }`}
                                        onContextMenu={(e) => handleContextMenu(e, message.id, message.content)}
                                    >
                                        <div
                                            className={`flex gap-4 items-start ${
                                                message.role === "user" ? "max-w-[85%] flex-row-reverse" : "w-full flex-row"
                                            }`}
                                        >
                                            <div className={`size-8 shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm ${
                                                message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground border"
                                            }`}>
                                                {message.role === "user" ? "ME" : "AI"}
                                            </div>
                                            <div className={`flex-1 ${message.role === "user" ? "items-end flex flex-col" : "items-start w-full"}`}>
                                                <div className={`min-h-8 flex items-center w-full ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                                                    {editingMessageId === message.id ? (
                                                        <div className="flex flex-col gap-2 w-full min-w-[300px]">
                                                            <textarea
                                                                value={editContent}
                                                                onChange={(e) => setEditContent(e.target.value)}
                                                                className="w-full bg-muted border rounded-xl px-4 py-2.5 text-base focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none min-h-[100px]"
                                                            />
                                                            <div className="flex justify-end gap-2">
                                                                <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => setEditingMessageId(null)}>Cancel</Button>
                                                                <Button size="sm" className="h-7 text-[10px]" onClick={saveEdit}>Save</Button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className={`text-base ${
                                                            message.role === "user" 
                                                                ? "px-4 py-2.5 rounded-2xl shadow-sm bg-muted border" 
                                                                : "w-full prose prose-base dark:prose-invert max-w-none"
                                                        }`}>
                                                            {message.role === "user" ? (
                                                                message.content
                                                            ) : (
                                                                <ReactMarkdown 
                                                                    remarkPlugins={[remarkMath, remarkGfm]} 
                                                                    rehypePlugins={[rehypeKatex]}
                                                                >
                                                                    {preprocessLaTeX(message.content)}
                                                                </ReactMarkdown>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className={`flex gap-1 opacity-0 group-hover/message:opacity-100 transition-opacity mt-1 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                                                    {message.role === "user" ? (
                                                        <>
                                                            <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-foreground" onClick={() => startEditing(message.id, message.content)}>
                                                                <Edit3Icon className="size-3" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-destructive" onClick={() => deleteMessage(message.id)}>
                                                                <Trash2Icon className="size-3" />
                                                            </Button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-foreground" onClick={() => regenerateMessage(message.id)}>
                                                                <RefreshCwIcon className="size-3" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-destructive" onClick={() => deleteMessage(message.id)}>
                                                                <Trash2Icon className="size-3" />
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                                {message.attachments && message.attachments.length > 0 && (
                                                    <Attachments variant="grid" className={message.role === "user" ? "justify-end" : "justify-start mt-2"}>
                                                        {message.attachments.map((file, idx) => (
                                                            <Attachment key={idx} data={{ ...file, id: nanoid() }}>
                                                                <AttachmentPreview />
                                                                <AttachmentInfo showMediaType />
                                                            </Attachment>
                                                        ))}
                                                    </Attachments>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </>
                        ) : (
                            <div className="flex gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <aside className="w-32 shrink-0 flex flex-col gap-1">
                                    {(["gemini", "openai", "claude", "deepseek", "llamacpp"] as Provider[]).map((p) => (
                                        <Button
                                            key={p}
                                            variant="ghost"
                                            className={`justify-between text-xs h-9 capitalize ${
                                                activeSettingProvider === p ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                                            }`}
                                            onClick={() => setActiveSettingProvider(p)}
                                        >
                                            <span className="truncate pr-4">{p === "llamacpp" ? "llama.cpp" : p}</span>
                                            {defaultProvider === p && (
                                                <CheckIcon className="size-3 text-primary shrink-0" />
                                            )}
                                        </Button>
                                    ))}
                                </aside>
                                <div className="flex-1 space-y-6 min-w-0">
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
                                            <Input 
                                                type={activeSettingProvider === "llamacpp" ? "text" : "password"} 
                                                placeholder={activeSettingProvider === "llamacpp" ? "http://localhost:8080" : `Enter ${activeSettingProvider} API key`} 
                                                value={apiKeys[activeSettingProvider]}
                                                onChange={(e) => setApiKeys(prev => ({ ...prev, [activeSettingProvider]: e.target.value }))}
                                            />
                                        </div>
                                        {activeSettingProvider !== "llamacpp" && (
                                            <div className="space-y-2">
                                                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                                    Base URL
                                                </label>
                                                <Input 
                                                    type="text" 
                                                    placeholder={`Enter ${activeSettingProvider} base URL`} 
                                                    value={baseUrls[activeSettingProvider]}
                                                    onChange={(e) => setBaseUrls(prev => ({ ...prev, [activeSettingProvider]: e.target.value }))}
                                                />
                                                <p className="text-[10px] text-muted-foreground">
                                                    Default: {DEFAULT_BASE_URLS[activeSettingProvider]}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                    <div className="pt-4 flex gap-3">
                                        <Button className="flex-1" onClick={() => setActiveView("chat")}>Save and Close</Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </main>

                {activeView === "chat" && (
                    <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-t from-background via-background/90 to-transparent pt-10">
                        <div className="mx-auto max-w-3xl">
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
            </div>
        </div>
    );
}

export default App;
