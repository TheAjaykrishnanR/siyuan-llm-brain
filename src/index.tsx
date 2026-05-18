import { Plugin } from "siyuan";
import React from "react";
import { createRoot } from "react-dom/client";
import "@/index.css";
import App from "@/App";
import { ThemeProvider } from "@/components/theme-provider";

const DOCK_TYPE = "siyuan-llm-brain-dock";

export default class LLMBrainPlugin extends Plugin {

    onload() {
        this.addIcons(`<symbol id="iconChat" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/></symbol>`);

        this.addDock({
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
                
                const root = createRoot(dock.element);
                root.render(
                    <React.StrictMode>
                        <ThemeProvider defaultTheme="dark" storageKey="siyuan-llm-brain-theme">
                            <App />
                        </ThemeProvider>
                    </React.StrictMode>
                );
            },
            destroy: () => {
                console.log("LLM Brain dock destroyed");
            }
        });
    }

    onunload() {
        console.log("LLM Brain plugin unloaded");
    }
}
