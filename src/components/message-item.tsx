import React from "react";
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Button } from "@/components/ui/button";
import { Edit3Icon, Trash2Icon, RefreshCwIcon } from "lucide-react";
import { Attachments, Attachment, AttachmentPreview, AttachmentInfo } from "@/components/ai-elements/attachments";
import { nanoid } from "nanoid";

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    attachments?: any[];
}

interface MessageItemProps {
    message: Message;
    isEditing: boolean;
    editContent: string;
    onEditContentChange: (content: string) => void;
    onSaveEdit: () => void;
    onCancelEdit: () => void;
    onStartEditing: (id: string, content: string) => void;
    onDelete: (id: string) => void;
    onRegenerate: (id: string) => void;
    onContextMenu: (e: React.MouseEvent, messageId: string, content: string) => void;
}

const preprocessLaTeX = (content: string) => {
    return content
        .replace(/\\\[/g, '$$$$')
        .replace(/\\\]/g, '$$$$')
        .replace(/\\\(/g, '$$')
        .replace(/\\\)/g, '$$');
};

export const MessageItem = React.memo(({
    message,
    isEditing,
    editContent,
    onEditContentChange,
    onSaveEdit,
    onCancelEdit,
    onStartEditing,
    onDelete,
    onRegenerate,
    onContextMenu
}: MessageItemProps) => {
    return (
        <div
            className={`flex group/message ${
                message.role === "user" ? "justify-end" : "justify-start w-full"
            }`}
            onContextMenu={(e) => onContextMenu(e, message.id, message.content)}
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
                        {isEditing ? (
                            <div className="flex flex-col gap-2 w-full min-w-[300px]">
                                <textarea
                                    value={editContent}
                                    onChange={(e) => onEditContentChange(e.target.value)}
                                    className="w-full bg-muted border rounded-xl px-4 py-2.5 text-base focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none min-h-[100px]"
                                />
                                <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={onCancelEdit}>Cancel</Button>
                                    <Button size="sm" className="h-7 text-[10px]" onClick={onSaveEdit}>Save</Button>
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
                                ) : message.content ? (
                                    <ReactMarkdown 
                                        remarkPlugins={[remarkMath, remarkGfm]} 
                                        rehypePlugins={[rehypeKatex]}
                                    >
                                        {preprocessLaTeX(message.content)}
                                    </ReactMarkdown>
                                ) : (
                                    <div className="flex items-center gap-1.5 py-3 px-2">
                                        <div className="size-2 rounded-full bg-muted-foreground/50 animate-dot-pulse-1" />
                                        <div className="size-2 rounded-full bg-muted-foreground/50 animate-dot-pulse-2" />
                                        <div className="size-2 rounded-full bg-muted-foreground/50 animate-dot-pulse-3" />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <div className={`flex gap-1 opacity-0 group-hover/message:opacity-100 transition-opacity mt-1 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                        {message.role === "user" ? (
                            <>
                                <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-foreground" onClick={() => onStartEditing(message.id, message.content)}>
                                    <Edit3Icon className="size-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-destructive" onClick={() => onDelete(message.id)}>
                                    <Trash2Icon className="size-3" />
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-foreground" onClick={() => onRegenerate(message.id)}>
                                    <RefreshCwIcon className="size-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-destructive" onClick={() => onDelete(message.id)}>
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
    );
});

MessageItem.displayName = "MessageItem";
