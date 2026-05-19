"use client";

import {
    PromptInput,
    PromptInputBody,
    PromptInputButton,
    PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";

import { AtSignIcon, PaperclipIcon, ImageIcon, FileTextIcon, StickyNoteIcon, SquareIcon, ChevronDownIcon, FileIcon } from "lucide-react";
import { ArrowUpIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useRef, useEffect } from "react";
import { usePromptInputAttachments, usePromptInputController } from "@/components/ai-elements/prompt-input";
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
import { searchNotes, type SearchResult } from "@/lib/siyuan";
import { cn } from "@/lib/utils";

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
    const [menuMode, setMenuMode] = useState<'inline' | 'standalone'>('inline');
    const [noteSearchResults, setNoteSearchResults] = useState<SearchResult[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [cursorPosition, setCursorPosition] = useState(0);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const buttonContainerRef = useRef<HTMLDivElement>(null);
    const { openFileDialog, files, remove, add } = usePromptInputAttachments();
    const controller = usePromptInputController();

    // Automatically attach current note
    useEffect(() => {
        const handleDocSwitch = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (!detail || !detail.id) return;

            // Check if already attached as the current note
            const currentNote = files.find(f => (f as any).isCurrent);
            if (currentNote && currentNote.url === detail.id) return;

            // If a current note already exists but it's different, remove it first
            if (currentNote) {
                remove(currentNote.id);
            }

            add([{
                id: detail.id,
                filename: detail.title || "Current Note",
                mediaType: "application/x-siyuan-note",
                url: detail.id,
                type: "file",
                isCurrent: true // Mark as current note
            }] as any);
        };

        window.addEventListener("siyuan-llm-brain-doc-switch", handleDocSwitch);
        return () => window.removeEventListener("siyuan-llm-brain-doc-switch", handleDocSwitch);
    }, [files, add, remove]);

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

        const handleKeyDownGlobal = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setShowAtMenu(false);
            }
        };

        if (showAtMenu) {
            document.addEventListener("mousedown", handleClickOutside);
            document.addEventListener("keydown", handleKeyDownGlobal);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDownGlobal);
        };
    }, [showAtMenu]);

    useEffect(() => {
        if (showAtMenu && searchQuery.length >= 0) {
            const delayDebounceFn = setTimeout(async () => {
                const results = await searchNotes(searchQuery);
                setNoteSearchResults(results);
                setSelectedIndex(0);
            }, 200);

            return () => clearTimeout(delayDebounceFn);
        }
    }, [searchQuery, showAtMenu]);

    const handleSubmit = (message: PromptInputMessage) => {
        if (isGenerating) {
            onStop?.();
            return;
        }
        return onSend(message);
    };

    const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        // If we are already in standalone mode, don't let textarea changes override it
        if (showAtMenu && menuMode === 'standalone') return;

        const value = e.target.value;
        const pos = e.target.selectionStart;
        setCursorPosition(pos);

        const lastAtPos = value.lastIndexOf("@", pos - 1);
        if (lastAtPos !== -1) {
            const query = value.slice(lastAtPos + 1, pos);
            if (!query.includes(" ")) {
                setSearchQuery(query);
                setShowAtMenu(true);
                setMenuMode('inline');
                return;
            }
        }
        setShowAtMenu(false);
    };

    const selectNote = (note: SearchResult) => {
        if (menuMode === 'inline') {
            const value = controller.textInput.value;
            const lastAtPos = value.lastIndexOf("@", cursorPosition - 1);
            if (lastAtPos !== -1) {
                const newValue = value.slice(0, lastAtPos) + value.slice(cursorPosition);
                controller.textInput.setInput(newValue);
            }
        }
        
        // Add note as attachment
        add([{
            id: note.blockID,
            filename: note.content,
            mediaType: "application/x-siyuan-note",
            url: note.blockID,
            type: "file"
        }] as any);

        setShowAtMenu(false);
        textareaRef.current?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (showAtMenu && menuMode === 'inline') {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedIndex((prev) => (noteSearchResults.length > 0 ? (prev + 1) % noteSearchResults.length : 0));
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedIndex((prev) => (noteSearchResults.length > 0 ? (prev - 1 + noteSearchResults.length) % noteSearchResults.length : 0));
            } else if (e.key === "Enter") {
                if (noteSearchResults.length > 0) {
                    e.preventDefault();
                    selectNote(noteSearchResults[selectedIndex]);
                } else {
                    setShowAtMenu(false);
                }
            } else if (e.key === "Escape") {
                e.preventDefault();
                setShowAtMenu(false);
            }
        }
    };

    const handleOpenNotePicker = () => {
        setMenuMode('standalone');
        setNoteSearchResults([]); // Clear old results to fix flicker
        setShowAtMenu(true);
        setSearchQuery("");
    };

    return (
        <PromptInput
            onSubmit={handleSubmit}
            className="bg-[#121212] border border-white/10 rounded-2xl p-3 flex flex-col shadow-2xl relative"
        >
            {/* Note Search Popover */}
            {showAtMenu && (
                <div 
                    ref={menuRef}
                    className="absolute bottom-full left-0 mb-2 w-full max-w-xs bg-popover border rounded-xl shadow-2xl z-50 overflow-hidden animate-in slide-in-from-bottom-2 duration-200"
                >
                    {menuMode === 'standalone' && (
                        <div className="p-2 border-b bg-muted/30">
                            <input 
                                autoFocus
                                className="w-full bg-transparent border-none text-sm focus:ring-0 placeholder:text-muted-foreground/50 py-1"
                                placeholder="Search SiYuan notes..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        if (noteSearchResults.length > 0) {
                                            e.preventDefault();
                                            selectNote(noteSearchResults[selectedIndex]);
                                        }
                                    } else if (e.key === "ArrowDown") {
                                        e.preventDefault();
                                        setSelectedIndex((prev) => (noteSearchResults.length > 0 ? (prev + 1) % noteSearchResults.length : 0));
                                    } else if (e.key === "ArrowUp") {
                                        e.preventDefault();
                                        setSelectedIndex((prev) => (noteSearchResults.length > 0 ? (prev - 1 + noteSearchResults.length) % noteSearchResults.length : 0));
                                    }
                                }}
                            />
                        </div>
                    )}
                    
                    {(noteSearchResults.length > 0 || (searchQuery && noteSearchResults.length === 0) || (menuMode === 'inline' && !searchQuery)) && (
                        <div className="max-h-[300px] overflow-y-auto p-1 custom-scrollbar border-t first:border-t-0">
                            {noteSearchResults.length === 0 ? (
                                searchQuery ? (
                                    <div className="p-4 text-center text-sm text-muted-foreground">
                                        No notes found
                                    </div>
                                ) : menuMode === 'inline' ? (
                                    <div className="p-4 text-center text-sm text-muted-foreground">
                                        Start typing to search...
                                    </div>
                                ) : null
                            ) : (
                                noteSearchResults.map((note, index) => (
                                    <button
                                        key={note.blockID}
                                        type="button"
                                        className={cn(
                                            "w-full text-left px-3 py-2 rounded-md transition-colors flex items-center gap-2 group",
                                            index === selectedIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                                        )}
                                        onClick={() => selectNote(note)}
                                    >
                                        <FileIcon size={14} className={cn(
                                            "text-muted-foreground",
                                            index === selectedIndex ? "text-primary" : "group-hover:text-primary"
                                        )} />
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-sm font-medium truncate">{note.content}</span>
                                            <span className="text-[10px] text-muted-foreground truncate opacity-70">{note.hPath}</span>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Header */}
            <div className="flex flex-wrap items-center gap-2 pb-2">
                <div ref={buttonContainerRef}>
                    <PromptInputButton
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px] gap-1.5 border-white/5 bg-white/5 hover:bg-white/10 rounded-lg"
                        onClick={handleOpenNotePicker}
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
                                <span className="text-[10px] max-w-[100px] truncate leading-tight">{file.filename}</span>
                                <AttachmentRemove />
                            </Attachment>
                        ))}
                    </Attachments>
                )}
            </div>

            {/* Textarea — PromptInputBody is display:contents so children render directly */}
            <PromptInputBody>
                <PromptInputTextarea
                    ref={textareaRef}
                    placeholder="Ask, search, or make anything…"
                    className="py-0 px-0 bg-transparent text-sm placeholder:text-muted-foreground/50 min-h-[44px]"
                    onChange={handleTextareaChange}
                    onKeyDown={handleKeyDown}
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

