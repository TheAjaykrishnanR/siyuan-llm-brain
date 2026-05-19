import { fetchSyncPost } from "siyuan";

export interface SearchResult {
    rootID: string;
    blockID: string;
    content: string;
    hPath: string;
}

const stripHTML = (html: string) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const text = doc.body.textContent || "";
    // Second pass to remove any tags that might have been escaped in the input
    return text.replace(/<[^>]*>?/gm, '');
};

export async function searchNotes(query: string): Promise<SearchResult[]> {
    // SiYuan API: /api/search/fullTextSearchBlock
    // type: 0 for all, 1 for doc only
    const response = await fetchSyncPost("/api/search/fullTextSearchBlock", {
        query: query,
        method: 0,
        type: 1, 
        orderBy: 0,
    });

    if (response.code === 0) {
        return response.data.blocks.map((b: any) => ({
            rootID: b.root_id,
            blockID: b.id,
            content: stripHTML(b.content),
            hPath: b.hpath,
        }));
    }
    return [];
}

export async function getNoteContent(id: string): Promise<string> {
    // SiYuan API: /api/export/exportMdContent
    const response = await fetchSyncPost("/api/export/exportMdContent", {
        id: id,
    });

    if (response.code === 0) {
        return response.data.content;
    }
    return "";
}
