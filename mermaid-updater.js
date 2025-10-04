/**
 * @requires parseStates, createDiagramManager, state constants, CSS class helpers, and CLS_DEFAULT from utils.js
 */

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
        // Extract colors from defaultStyle for theme variables
        const fillMatch = config.defaultStyle.match(/fill:#([a-fA-F0-9]{3,6})/);
        const colorMatch = config.defaultStyle.match(/color:#([a-fA-F0-9]{3,6})/);
        const primaryColor = fillMatch ? `#${fillMatch[1]}` : '#4472C4';
        const primaryTextColor = colorMatch ? `#${colorMatch[1]}` : '#fff';
        
        const themeConfig = (
            "---\n" +
            "config:\n" +
            "  theme: 'base'\n" +
            "  themeVariables:\n" +
            `    primaryColor: '${primaryColor}'\n` +
            `    primaryTextColor: '${primaryTextColor}'\n` +
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
    const svgContent = `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <style>
            .dot1 { animation: spinner_fade 1.0s linear infinite 0s; }
            .dot2 { animation: spinner_fade 1.0s linear infinite 0.125s; }
            .dot3 { animation: spinner_fade 1.0s linear infinite 0.25s; }
            .dot4 { animation: spinner_fade 1.0s linear infinite 0.375s; }
            .dot5 { animation: spinner_fade 1.0s linear infinite 0.5s; }
            .dot6 { animation: spinner_fade 1.0s linear infinite 0.625s; }
            .dot7 { animation: spinner_fade 1.0s linear infinite 0.75s; }
            .dot8 { animation: spinner_fade 1.0s linear infinite 0.875s; }
            @keyframes spinner_fade {
                0% { opacity: 1; }
                12.5% { opacity: 0.8; }
                25% { opacity: 0.6; }
                37.5% { opacity: 0.4; }
                50%, 100% { opacity: 0.3; }
            }
        </style>
        <circle cx="12" cy="5" r="2" fill="${color}" class="dot1"/>
        <circle cx="17" cy="7" r="2" fill="${color}" class="dot2"/>
        <circle cx="19" cy="12" r="2" fill="${color}" class="dot3"/>
        <circle cx="17" cy="17" r="2" fill="${color}" class="dot4"/>
        <circle cx="12" cy="19" r="2" fill="${color}" class="dot5"/>
        <circle cx="7" cy="17" r="2" fill="${color}" class="dot6"/>
        <circle cx="5" cy="12" r="2" fill="${color}" class="dot7"/>
        <circle cx="7" cy="7" r="2" fill="${color}" class="dot8"/>
    </svg>`;
    
    return 'data:image/svg+xml;base64,' + btoa(svgContent);
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
 */
function initMermaidUpdater(diagramManager, containerId, options = {}) {
    // Default configuration
    const config = {
        defaultStyle: options.defaultStyle || 'fill:#4472C4,stroke:#ffffff,stroke-width:1px,color:#fff',
        successStyle: options.successStyle || 'stroke:#28a745,stroke-width:3px',
        failedStyle: options.failedStyle || 'stroke:#dc3545,stroke-width:3px'
    };
    
    // Extract text color from defaultStyle for spinner
    const textColorMatch = config.defaultStyle.match(/color:#([a-fA-F0-9]{3,6})/);
    const spinnerColor = textColorMatch ? `#${textColorMatch[1]}` : '#fff';
    
    // Initialize Mermaid
    mermaid.initialize({startOnLoad: true});
    
    function updateDiagram(fileContent) {
        // Parse block states from session comments
        const blockStates = parseStates(fileContent);
        const spinnerURL = spinner(spinnerColor);
        let diagram = addFrontMatter(fileContent, config);

        // Apply state-based styling
        blockStates.forEach((state, blockId) => {
            if (state === STATE_RUNNING) {
                // Add spinner to running blocks (both rectangular and rounded)
                diagram = style(diagram, blockId, 
                    `$1<img src='${spinnerURL}' height='25' style='object-fit: contain;' />$2$3`
                );
            } else if (state === STATE_SUCCESS) {
                // Add green border class to successful blocks (both rectangular and rounded)
                diagram = style(diagram, blockId, `$1$2$3:::${CLS_SUCCESS}`);
            } else if (state === STATE_FAILED) {
                // Add red border class to failed blocks (both rectangular and rounded)
                diagram = style(diagram, blockId, `$1$2$3:::${CLS_FAILED}`);
            }
        });
        
        // Add CSS styling for success and failed states. Also override Mermaid's
        // default styling by defining our own default class.
        const styledDiagram = diagram + (
            "\n\n" +
            "classDef default " + config.defaultStyle + "\n" +
            "classDef " + CLS_SUCCESS + " " + config.successStyle + "\n" +
            "classDef " + CLS_FAILED + " " + config.failedStyle
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