/**
 * @requires parseStates, createDiagramManager, getStatusAge, MAX_STATUS_AGE_S, state constants, and CSS class helpers from utils.js
 */

/**
 * Extract fill and text colors from a CSS style string
 * @param {string} styleString - CSS style string (e.g., 'fill:#abc123,color:#def456')
 * @returns {Object} Object with fillColor and textColor properties
 */
function extractColors(styleString) {
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
function addFrontMatter(fileContent, config) {
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
 * Helper function to apply transformations to both rectangular and rounded blocks
 * @param {string} diagram - The diagram content to modify
 * @param {string} blockId - The block ID to target
 * @param {string} replacement - The replacement pattern to apply
 * @returns {string} Modified diagram content
 */
function style(diagram, blockId, replacement) {
    const rectangularRegex = new RegExp(`(${blockId}\\[)([^\\]]+)(\\])`, 'g');
    const roundedRegex = new RegExp(`(${blockId}\\()([^\\)]+)(\\))`, 'g');
    
    return diagram
        .replace(rectangularRegex, replacement)
        .replace(roundedRegex, replacement);
}

/**
 * Mermaid Diagram Auto-Updater
 * Automatically updates a Mermaid diagram based on embedded session comments
 * 
 * @param {Object} diagramManager - Diagram manager instance from createDiagramManager
 * @param {string} containerId - ID of the HTML element to contain the diagram
 * @param {Object} options - Configuration options
 * @param {string} options.defaultStyle - Default CSS styling for blocks (default: 'fill:#4472C4,stroke:#ffffff,stroke-width:1px,color:#fff')
 * @param {string} options.successStyle - CSS styling for success blocks (default: 'stroke:#28a745,stroke-width:3px')
 * @param {string} options.failedStyle - CSS styling for failed blocks (default: 'stroke:#dc3545,stroke-width:3px')
 * @param {string} options.staleDefaultStyle - Default CSS styling when stale (default: same as defaultStyle but greyed)
 * @param {string} options.staleSuccessStyle - Success CSS styling when stale (default: same as successStyle but greyed)
 * @param {string} options.staleFailedStyle - Failed CSS styling when stale (default: same as failedStyle but greyed)
 */
function initMermaidUpdater(diagramManager, containerId, options = {}) {
    const config = {
        defaultStyle: 'fill:#4472C4,stroke:#ffffff,stroke-width:1px,color:#fff',
        successStyle: 'stroke:#28a745,stroke-width:3px',
        failedStyle: 'stroke:#dc3545,stroke-width:3px',
        staleDefaultStyle: 'fill:#f3f4f6,stroke:#9ca3af,stroke-width:2px,color:#6b7280',
        staleSuccessStyle: 'fill:#f3f4f6,stroke:#9ca3af,stroke-width:2px,color:#6b7280',
        staleFailedStyle: 'fill:#f3f4f6,stroke:#d1d5db,stroke-width:2px,color:#6b7280',
        ...options
    };
    
    const {textColor} = extractColors(config.defaultStyle);
    
    // Initialize Mermaid
    mermaid.initialize({startOnLoad: true});
    
    function updateDiagram(fileContent) {
        // Check if status is stale
        const statusAge = getStatusAge(fileContent);
        const isStale = statusAge !== null && statusAge >= MAX_STATUS_AGE_S;
        
        // Parse block states from session comments
        const blockStates = parseStates(fileContent);
        let diagram = addFrontMatter(fileContent, config);

        // Apply state-based styling
        const actions = {
            [STATE_RUNNING]: !isStale ? `$1<img src='${spinner(textColor)}' height='25'/>$2$3` : null,
            [STATE_SUCCESS]: `$1$2$3:::${CLS_SUCCESS}`,
            [STATE_FAILED]: `$1$2$3:::${CLS_FAILED}`
        };
        
        blockStates.forEach((state, blockId) => {
            if (actions[state]) diagram = style(diagram, blockId, actions[state]);
        });
        
        const currentStyles = {
            defaultStyle: isStale ? config.staleDefaultStyle : config.defaultStyle,
            successStyle: isStale ? config.staleSuccessStyle : config.successStyle,
            failedStyle: isStale ? config.staleFailedStyle : config.failedStyle
        };
        
        // Add CSS styling for success and failed states. Also override Mermaid's
        // default styling by defining our own default class.
        const styledDiagram = diagram + (
            "\n\n" +
            "classDef default " + currentStyles.defaultStyle + "\n" +
            "classDef " + CLS_SUCCESS + " " + currentStyles.successStyle + "\n" +
            "classDef " + CLS_FAILED + " " + currentStyles.failedStyle
        );

        document.getElementById(containerId).innerHTML = (
            `<div class="mermaid">${styledDiagram}</div>`
        );
        mermaid.init();
    }
    
    // Subscribe to diagram manager for updates
    const unsubscribe = diagramManager.subscribe(updateDiagram);
    
    // Return cleanup function
    return function cleanup() {
        unsubscribe();
    };
}