
/**
 * WikiGraaf - Interactive Wikipedia Graph Viewer
 * Uses MediaWiki API (No Keys Required) & Vis.js
 */

// --- CONFIGURATION ---
const CONFIG = {
    API_URL: 'https://nl.wikipedia.org/w/api.php',
    MAX_LINKS: 15, // Limit nodes to prevent lag/clutter
    GRAPH_OPTIONS: {
        nodes: {
            shape: 'dot',
            font: {
                face: 'Inter',
                color: '#ffffff',
                size: 14,
                strokeWidth: 0,
                background: 'rgba(0,0,0,0.5)'
            },
            borderWidth: 2,
            shadow: true
        },
        edges: {
            width: 1,
            color: { inherit: 'from', opacity: 0.4 },
            smooth: { type: 'continuous' }
        },
        physics: {
            stabilization: false,
            barnesHut: {
                gravitationalConstant: -3000,
                springConstant: 0.04,
                springLength: 150
            }
        },
        interaction: {
            hover: true,
            tooltipDelay: 200,
            zoomView: true
        }
    }
};

// --- STATE MANAGEMENT ---
const state = {
    history: [],
    currentTopic: null,
    network: null, // Vis.js network instance
    nodes: new vis.DataSet([]),
    edges: new vis.DataSet([]),
    selectedNode: null // Currently viewed in panel
};

// --- API SERVICE ---
const WikiAPI = {
    /**
     * Fetch direct links from an article
     */
    async getLinks(title) {
        const params = new URLSearchParams({
            action: 'query',
            format: 'json',
            titles: title,
            prop: 'links',
            pllimit: 'max', // Get many, we filter later
            plnamespace: 0, // Main articles only
            origin: '*' // CORS fix
        });

        try {
            const response = await fetch(`${CONFIG.API_URL}?${params}`);
            const data = await response.json();
            
            const pages = data.query.pages;
            const pageId = Object.keys(pages)[0];
            
            if (pageId === '-1') return null; // Not found

            const links = pages[pageId].links || [];
            
            // Filter and Randomize to avoid seeing "A..." links only
            // Shuffle array
            const shuffled = links.sort(() => 0.5 - Math.random());
            
            // Return sliced subset
            return shuffled.slice(0, CONFIG.MAX_LINKS).map(l => l.title);
        } catch (error) {
            console.error("API Error (Links):", error);
            return [];
        }
    },

    /**
     * Fetch HTML content of an article
     */
    async getContent(title) {
        const params = new URLSearchParams({
            action: 'parse',
            format: 'json',
            page: title,
            prop: 'text',
            mobileformat: true, // cleaner html
            origin: '*'
        });

        try {
            const response = await fetch(`${CONFIG.API_URL}?${params}`);
            const data = await response.json();
            
            if (data.error || !data.parse) return null;

            return data.parse.text['*'];
        } catch (error) {
            console.error("API Error (Content):", error);
            return "<p>Kon artikel niet laden.</p>";
        }
    }
};

// --- UI MANAGER ---
const UI = {
    elements: {
        network: document.getElementById('network'),
        form: document.getElementById('search-form'),
        input: document.getElementById('search-input'),
        backBtn: document.getElementById('btn-back'),
        topicLabel: document.getElementById('current-topic-label'),
        panel: document.getElementById('side-panel'),
        panelTitle: document.getElementById('panel-title'),
        panelContent: document.getElementById('panel-content'),
        closePanelBtn: document.getElementById('btn-close-panel'),
        focusBtn: document.getElementById('btn-focus'),
        loader: document.getElementById('loader')
    },

    setLoading(isLoading) {
        if (isLoading) {
            this.elements.loader.classList.add('active');
            this.elements.network.style.opacity = '0.5';
        } else {
            this.elements.loader.classList.remove('active');
            this.elements.network.style.opacity = '1';
        }
    },

    updateHistoryUI() {
        this.elements.backBtn.disabled = state.history.length === 0;
        this.elements.topicLabel.textContent = state.currentTopic 
            ? `Huidige focus: ${state.currentTopic}` 
            : 'Start je reis...';
    },

    openPanel(title, htmlContent) {
        this.elements.panelTitle.textContent = title;
        this.elements.panelContent.innerHTML = htmlContent;
        this.elements.panel.classList.add('open');
        state.selectedNode = title;
    },

    closePanel() {
        this.elements.panel.classList.remove('open');
        state.selectedNode = null;
        // Deselect in graph
        state.network.selectNodes([]);
    }
};

// --- GRAPH MANAGER ---
const Graph = {
    init() {
        const container = document.getElementById('network');
        const data = { nodes: state.nodes, edges: state.edges };
        state.network = new vis.Network(container, data, CONFIG.GRAPH_OPTIONS);

        // Events
        state.network.on('click', this.handleClick);
        state.network.on('doubleClick', this.handleDoubleClick);
    },

    async loadTopic(topic, addToHistory = true) {
        if (!topic) return;

        UI.setLoading(true);
        UI.closePanel();

        // 1. History Management
        if (addToHistory && state.currentTopic) {
            state.history.push(state.currentTopic);
        }
        state.currentTopic = topic;
        UI.updateHistoryUI();

        // 2. Fetch Data
        const linkedTopics = await WikiAPI.getLinks(topic);
        
        if (!linkedTopics) {
            alert("Onderwerp niet gevonden op Wikipedia.");
            UI.setLoading(false);
            return;
        }

        // 3. Construct Graph Data
        state.nodes.clear();
        state.edges.clear();

        // Central Node
        state.nodes.add({
            id: topic,
            label: topic,
            color: '#fbbf24', // Amber
            size: 30,
            font: { size: 18, face: 'JetBrains Mono' }
        });

        // Child Nodes
        linkedTopics.forEach(link => {
            state.nodes.add({
                id: link,
                label: link,
                color: '#3b82f6', // Blue
                size: 15
            });

            state.edges.add({
                from: topic,
                to: link
            });
        });

        // 4. Stabilize
        state.network.fit();
        UI.setLoading(false);
    },

    async handleClick(params) {
        if (params.nodes.length > 0) {
            const nodeId = params.nodes[0];
            UI.setLoading(true);
            
            // Don't re-render graph, just show content
            const content = await WikiAPI.getContent(nodeId);
            if (content) {
                UI.openPanel(nodeId, content);
            }
            UI.setLoading(false);
        } else {
            UI.closePanel();
        }
    },

    handleDoubleClick(params) {
        if (params.nodes.length > 0) {
            const nodeId = params.nodes[0];
            Graph.loadTopic(nodeId, true);
        }
    }
};

// --- EVENT LISTENERS ---

// Search Form
UI.elements.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = UI.elements.input.value.trim();
    if (val) {
        Graph.loadTopic(val, true);
        UI.elements.input.value = '';
        // Unfocus keyboard on mobile
        UI.elements.input.blur(); 
    }
});

// Back Button
UI.elements.backBtn.addEventListener('click', () => {
    if (state.history.length > 0) {
        const prev = state.history.pop();
        Graph.loadTopic(prev, false); // false = don't push current to history
    }
});

// Panel Actions
UI.elements.closePanelBtn.addEventListener('click', () => UI.closePanel());

UI.elements.focusBtn.addEventListener('click', () => {
    if (state.selectedNode) {
        Graph.loadTopic(state.selectedNode, true);
    }
});

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    Graph.init();
    
    // Start with a default topic
    Graph.loadTopic("Internet", false);
});
