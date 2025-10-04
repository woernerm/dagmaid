/**
 * Utility functions for parsing mermaid diagram files and centralized file management
 */

// Helper function to generate CSS class names from state constants
function cssName(stateConstant) {
    return stateConstant.replace(/\s+/g, '').toLowerCase();
}

// State names
const STATE_RUNNING = 'Running';
const STATE_SUCCESS = 'Success';
const STATE_FAILED = 'Failed';
// CSS class names
const CLS_DEFAULT = 'default';
const CLS_SUCCESS = cssName(STATE_SUCCESS);
const CLS_FAILED = cssName(STATE_FAILED);
const MAX_STATUS_AGE_S = 60;

/**
 * Convert seconds to HH:mm:ss format string
 * @param {number} totalSeconds - Total seconds to convert
 * @returns {string} Formatted time string in HH:mm:ss format
 */
function formatDuration(totalSeconds) {
    const pad = n => n.toString().padStart(2, '0');
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Create dynamic spinner SVG with specified color
 * @param {string} color - The color for the spinner dots
 * @returns {string} Base64 encoded SVG data URL
 */
function spinner(color) {
    const positions = [
        [12, 5], [17, 7], [19, 12], [17, 17], 
        [12, 19], [7, 17], [5, 12], [7, 7]
    ];
    
    const dotClasses = positions.map((_, i) => 
        `.dot${i + 1} { animation: fade 1.0s linear infinite ${i * 0.125}s; }`
    ).join('\n');

    const circles = positions.map(([cx, cy], i) => 
        `<circle cx="${cx}" cy="${cy}" r="2" fill="${color}" class="dot${i + 1}"/>`
    ).join('\n');
    
    return 'data:image/svg+xml;base64,' + btoa(
        `<svg width="24" height="24" viewBox="0 0 24 24" ` +
        `xmlns="http://www.w3.org/2000/svg">
        <style>${dotClasses}
            @keyframes fade {
                0% { opacity: 1; }
                12.5% { opacity: 0.8; }
                25% { opacity: 0.6; }
                37.5% { opacity: 0.4; }
                50%, 100% { opacity: 0.3; }
            }
        </style>${circles}</svg>`
    );
}

/**
 * Create status line HTML with optional spinner
 * @param {string} text - Text to display
 * @param {boolean} showSpinner - Whether to show spinner
 * @param {string} color - Color for the spinner
 * @param {string} blockId - Block ID for HTML element identification
 * @returns {string} HTML for the status line
 */
function formatState(text, showSpinner, color, blockId) {
    const spHtml = showSpinner ? 
        `<img src='${spinner(color)}' height='20' style='margin-right:3px'/>` : '';
    return `<br/><div style='display:flex;align-items:center;justify-content:center;` +
           `font-size:14px'>${spHtml}<span id="${blockId}_text">${text}</span></div>`;
}

/**
 * Parse status timestamp and return it.
 * @param {string} fileContent - The complete mermaid file content
 * @returns {Date|null} The timestamp or null if not found/invalid.
 */
function getTimestamp(fileContent) {    
    try {
        const timestampMatch = fileContent.match(/^%% Status:\s*(.+)$/m);
        const statusDate = new Date(timestampMatch[1].trim());
        return isNaN(statusDate.getTime()) ? null : statusDate;
    } catch (error) {
        return null;
    }
}

/**
 * Parse status timestamp and compute the recency of the status in seconds
 * @param {string} fileContent - The complete mermaid file content
 * @returns {number|null} Age of the timestamp in seconds, or null if not found/invalid
 */
function getStatusAge(fileContent) {    
    try {        
        return ((new Date()).getTime() - getTimestamp(fileContent).getTime()) / 1000;
    } catch (error) {
        return null;
    }
}

/**
 * Parse session data from mermaid file comments and return block states and runtimes
 * @param {string} fileContent - The complete mermaid file content
 * @returns {Map<string, Object>} Map of block IDs to {state: string, runtime: number} objects
 */
function parseStates(fileContent) {
    const blockData = new Map();
    
    // Parse session status for all blocks using global regex that captures runtime
    const matches = fileContent.matchAll(/^%% (\w+):\s*(\w+)\s*\((\d+)s\)/gm);
    for (const match of matches) {
        const blockId = match[1];
        const state = match[2];
        const runtime = parseInt(match[3], 10);
        blockData.set(blockId, { state, runtime });
    }
    
    return blockData;
}

/**
 * Compare specific attribute between two parseStates results and detect any changes
 * @param {Map<string, Object>} oldStates - Previous states map from parseStates
 * @param {Map<string, Object>} newStates - Current states map from parseStates
 * @param {string} attribute - Attribute name to compare ('state' or 'runtime')
 * @returns {boolean} True if any differences in the specified attribute are found, false otherwise
 */
function isAttrChange(oldStates, newStates, attribute) {
    // Get all unique block IDs from both maps
    const allBlockIds = new Set([...oldStates.keys(), ...newStates.keys()]);
    
    // Check each block ID for attribute differences
    for (const blockId of allBlockIds) {
        const oldBlock = oldStates.get(blockId);
        const newBlock = newStates.get(blockId);
        
        // If block exists in only one map or attributes are different, it's a change
        if (!oldBlock || !newBlock || oldBlock[attribute] !== newBlock[attribute]) {
            return true;
        }
    }
    
    return false;
}

/**
 * Extract fill and text colors from a CSS style string
 * @param {string} styleString - CSS style string (e.g., 'fill:#abc123,color:#def456')
 * @returns {Object} Object with fillColor and textColor properties
 */
function extractColors(styleString) {
    if (!styleString) {
        return {
            fillColor: '#4472C4',
            textColor: '#fff'
        };
    }
    const fillMatch = styleString.match(/fill:#([a-fA-F0-9]{3,6})/);
    const colorMatch = styleString.match(/color:#([a-fA-F0-9]{3,6})/);
    return {
        fillColor: fillMatch ? `#${fillMatch[1]}` : '#4472C4',
        textColor: colorMatch ? `#${colorMatch[1]}` : '#fff'
    };
}

/**
 * Extract diagram text from file content and apply theme configuration
 * @param {string} fileContent - The complete mermaid file content
 * @param {Object} config - Configuration object with theme settings
 * @param {string} config.defaultStyle - Default CSS styling for blocks
 * @returns {string} Processed diagram text with theme configuration
 */
function extractDiagram(fileContent, config = {}) {
    // Remove comments
    const diagramText = fileContent.replace(/^%%.*$/gm, '').trim();
    
    // Inject theme configuration if not already present
    if (!diagramText.includes('---\nconfig:')) {
        const {fillColor, textColor} = extractColors(config.defaultStyle);
        const themeConfig = (
            "---\n" +
            "config:\n" +
            "  theme: 'base'\n" +
            "  themeVariables:\n" +
            `    primaryColor: '${fillColor}'\n` +
            `    primaryTextColor: '${textColor}'\n` +
            "---\n\n"
        );
        return themeConfig + diagramText;
    }
    
    return diagramText;
}

/**
 * Centralized diagram file manager that fetches content once and notifies multiple subscribers
 * @param {string} diagramUrl - URL to the diagram.mmd file
 * @param {number} intervalSeconds - Update interval in seconds
 * @returns {Object} Manager object with onRedraw and onUpdate subscription methods
 */
function createDiagramManager(diagramUrl, intervalSeconds = 1) {
    const onRedrawSubs = new Set();
    const onUpdateSubs = new Set();
    let lastStates = null;
    let lastDiagram = null;
    let lastTimestamp = null;
    let refreshTimer = null;
    
    function triggerRedraw(fileContent) {
        onRedrawSubs.forEach(callback => callback(fileContent));
    }
    
    function triggerUpdate(fileContent) {
        onUpdateSubs.forEach(callback => callback(fileContent));
    }
    
    function fetchAndUpdate() {
        const fetchOptions = { cache: 'no-store' };
        fetch(diagramUrl, fetchOptions)
            .then(r => r.text())
            .then(fileContent => {
                const diagram = extractDiagram(fileContent);
                const states = parseStates(fileContent);
                const timestmap = getTimestamp(fileContent);
                
                // Only notify onRedraw subscribers if content has changed (or first load)
                if (lastDiagram !== diagram || isAttrChange(lastStates, states, 'state') || lastTimestamp?.getTime() !== timestmap?.getTime()) {
                    lastDiagram = diagram;
                    lastStates = states;
                    lastTimestamp = timestmap;
                    triggerRedraw(fileContent);
                }

                if (isAttrChange(lastStates, states, 'runtime')){
                    lastStates = states;
                    triggerUpdate(fileContent);
                }
            })
            .catch(() => {}); // Network errors handled silently
    }
    
    function start() {
        if (refreshTimer) return;
        fetchAndUpdate();
        refreshTimer = setInterval(fetchAndUpdate, intervalSeconds * 1000);
    }
    
    function stop() {
        if (!refreshTimer) return;
        clearInterval(refreshTimer);
        refreshTimer = null;
    }
    
    function onRedraw(callback) {
        onRedrawSubs.add(callback);

        return function unsubscribe() {
            onRedrawSubs.delete(callback);
        };
    }
    
    function onUpdate(callback) {
        onUpdateSubs.add(callback);
        
        return function unsubscribe() {
            onUpdateSubs.delete(callback);
        };
    }
    
    return {
        start,
        stop,
        onRedraw,
        onUpdate,
    };
}