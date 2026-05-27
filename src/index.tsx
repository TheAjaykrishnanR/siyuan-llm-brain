import { Plugin, fetchSyncPost } from "siyuan";
import React from "react";
import { createRoot } from "react-dom/client";
import "@/index.css";
import App from "@/App";
import { ThemeProvider } from "@/components/theme-provider";

const DOCK_TYPE = "siyuan-llm-brain-dock";

export default class LLMBrainPlugin extends Plugin {
    private dock: any;

    onload() {
        this.addIcons(`<symbol id="iconChat" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/></symbol>`);

        this.dock = this.addDock({
            config: {
                position: "RightTop",
                size: { width: 300, height: 0 },
                icon: "iconChat",
                title: this.i18n.chatWithNotes,
            },
            type: DOCK_TYPE,
            data: {},
            init: (dock) => {
                dock.element.classList.add("fn__flex-1", "fn__flex", "fn__flex-column", "siyuan-llm-brain-container", "dark");
                
                let currentDocId = "";
                
                const emitDoc = (id: string, title: string) => {
                    if (id && id !== currentDocId) {
                        currentDocId = id;
                        window.dispatchEvent(new CustomEvent("siyuan-llm-brain-doc-switch", { 
                            detail: { id, title } 
                        }));
                    }
                };

                // Track document switches
                this.eventBus.on("switch-protyle", ({ detail }) => {
                    emitDoc(detail.protyle.block.rootID, detail.protyle.title || "Current Note");
                });

                // Initial fetch for current doc on startup
                fetchSyncPost("/api/query/sql", {
                    stmt: "SELECT * FROM blocks WHERE type='d' ORDER BY updated DESC LIMIT 1"
                }).then(results => {
                    if (results.code === 0 && results.data && results.data.length > 0) {
                        const doc = results.data[0];
                        emitDoc(doc.id, doc.content || "Current Note");
                    }
                });

                const root = createRoot(dock.element);
                root.render(
                    <React.StrictMode>
                        <ThemeProvider defaultTheme="dark" storageKey="siyuan-llm-brain-theme">
                            <App plugin={this} />
                        </ThemeProvider>
                    </React.StrictMode>
                );
            },
            destroy: () => {
                console.log("LLM Brain dock destroyed");
            }
        });

    }

    onLayoutReady() {
        const dockType = this.dock?.model?.type || DOCK_TYPE;
        this.addTopBar({
            icon: "iconChat",
            title: this.i18n.chatWithNotes,
            position: "right",
            callback: () => {
                const dockBtn = document.querySelector('.dock [data-type*="siyuan-llm-brain-dock"], .dock__item[data-type*="siyuan-llm-brain-dock"]') as HTMLElement;
                if (dockBtn) {
                    dockBtn.click();
                } else {
                    const layout = window.siyuan.layout;
                    if (layout) {
                        const dock = [layout.leftDock, layout.rightDock, layout.bottomDock].find(
                            (d) => d && d.data && (dockType in d.data)
                        );
                        if (dock) {
                            dock.toggleModel(dockType);
                        } else {
                            layout.rightDock?.toggleModel(dockType);
                        }
                    }
                }
            }
        });
    }

    onunload() {
        console.log("LLM Brain plugin unloaded");
    }
}
