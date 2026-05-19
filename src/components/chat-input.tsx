"use client";

import {
    PromptInput,
    PromptInputBody,
    PromptInputButton,
    PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";

import { AtSignIcon, PaperclipIcon, ImageIcon, FileTextIcon, StickyNoteIcon, SquareIcon, ChevronDownIcon } from "lucide-react";
import { ArrowUpIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useRef, useEffect } from "react";
import { usePromptInputAttachments } from "@/components/ai-elements/prompt-input";
import { 
    Attachments, 
    Attachment, 
    AttachmentPreview, 
    AttachmentRemove 
} from "@/components/ai-elements/attachments";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ChatInputProps {
    onSend: (message: PromptInputMessage) => void | Promise<void>;
    isGenerating?: boolean;
    onStop?: () => void;
    models: string[];
    selectedModel: string;
    onModelChange: (model: string) => void;
}

export default function ChatInput({ 
    onSend, 
    isGenerating, 
    onStop, 
    models, 
    selectedModel, 
    onModelChange 
}: ChatInputProps) {
    const [showAtMenu, setShowAtMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const buttonContainerRef = useRef<HTMLDivElement>(null);
    const { openFileDialog, files, remove } = usePromptInputAttachments();

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                menuRef.current && 
                !menuRef.current.contains(event.target as Node) &&
                buttonContainerRef.current &&
                !buttonContainerRef.current.contains(event.target as Node)
            ) {
                setShowAtMenu(false);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setShowAtMenu(false);
            }
        };

        if (showAtMenu) {
            document.addEventListener("mousedown", handleClickOutside);
            document.addEventListener("keydown", handleKeyDown);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [showAtMenu]);

    const handleSubmit = (message: PromptInputMessage) => {
        if (isGenerating) {
            onStop?.();
            return;
        }
        return onSend(message);
    };

    const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        const cursorPosition = e.target.selectionStart;
        const lastChar = value[cursorPosition - 1];

        if (lastChar === "@") {
            setShowAtMenu(true);
        } else {
            setShowAtMenu(false);
        }
    };

    return (
		<PromptInput
            onSubmit={handleSubmit}
            className="bg-[#121212] border border-white/10 rounded-2xl p-3 flex flex-col shadow-2xl relative"
        >
            {/* Context Menu for '@' trigger and 'Add context' button */}
            {showAtMenu && (
                <div 
                    ref={menuRef}
                    className="absolute bottom-full left-3 mb-2 w-48 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2"
                >
                    <div className="px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider border-b border-white/5">
                        Add Context
                    </div>
                    <div className="p-1">
                        <button className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-md transition-colors" onClick={() => setShowAtMenu(false)}>
                            <FileTextIcon size={12} />
                            <span>Files</span>
                        </button>
                        <button className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-md transition-colors" onClick={() => setShowAtMenu(false)}>
                            <StickyNoteIcon size={12} />
                            <span>Notes</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-wrap items-center gap-2 pb-2">
                <div ref={buttonContainerRef}>
                    <PromptInputButton
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px] gap-1.5 border-white/5 bg-white/5 hover:bg-white/10 rounded-lg"
                        onClick={() => setShowAtMenu(!showAtMenu)}
                    >
                        <AtSignIcon size={10} />
                        <span>Add context</span>
                    </PromptInputButton>
                </div>

                {files.length > 0 && (
                    <Attachments variant="inline" className="gap-1.5">
                        {files.map((file) => (
                            <Attachment 
                                key={file.id} 
                                data={file} 
                                onRemove={() => remove(file.id)}
                            >
                                <AttachmentPreview />
                                <span className="text-[10px] max-w-[100px] truncate">{file.filename}</span>
                                <AttachmentRemove />
                            </Attachment>
                        ))}
                    </Attachments>
                )}
            </div>

            {/* Textarea — PromptInputBody is display:contents so children render directly */}
            <PromptInputBody>
                <PromptInputTextarea
                    placeholder="Ask, search, or make anything…"
                    className="py-0 px-0 bg-transparent text-sm placeholder:text-muted-foreground/50 min-h-[44px]"
                    onChange={handleTextareaChange}
                />
            </PromptInputBody>

            {/* Footer */}
            <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-3">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-[11px] gap-2 text-muted-foreground/70 hover:text-foreground hover:bg-white/5 px-2 rounded-md"
                            >
                                <PaperclipIcon size={13} />
                                <span className="max-w-[100px] truncate">{selectedModel || "Auto"}</span>
                                <ChevronDownIcon size={10} className="opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-[200px] max-h-[300px] overflow-y-auto">
                            {models.length === 0 ? (
                                <div className="px-2 py-1.5 text-[11px] text-muted-foreground text-center">
                                    No models found. Check API key.
                                </div>
                            ) : (
                                models.map((model) => (
                                    <DropdownMenuItem 
                                        key={model} 
                                        className={`text-[11px] ${selectedModel === model ? "bg-accent text-accent-foreground" : ""}`}
                                        onClick={() => onModelChange(model)}
                                    >
                                        {model}
                                    </DropdownMenuItem>
                                ))
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <PromptInputButton
                        variant="ghost"
                        size="sm"
                        className="h-8 text-[11px] gap-2 text-muted-foreground/70 hover:text-foreground hover:bg-white/5 px-2 rounded-md"
                        onClick={openFileDialog}
                    >
                        <ImageIcon size={13} />
                        <span>Images</span>
                    </PromptInputButton>
                </div>
                <Button
                    size="icon"
                    className={`size-9 rounded-full shadow-xl transition-all shrink-0 ${
                        isGenerating 
                            ? "bg-foreground text-background hover:bg-foreground/90" 
                            : "bg-white text-black hover:bg-white/90"
                    }`}
                    type="submit"
                >
                    {isGenerating ? (
                        <SquareIcon size={14} fill="currentColor" />
                    ) : (
                        <ArrowUpIcon size={16} strokeWidth={2.5} />
                    )}
                </Button>
            </div>
        </PromptInput>
    );
}
