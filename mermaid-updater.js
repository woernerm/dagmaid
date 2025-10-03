/**
 * @requires parseBlockStatesFromComments and createDiagramManager functions from utils.js
 */

/**
 * Extract diagram text from file content and apply theme configuration
 * @param {string} fileContent - The complete mermaid file content
 * @param {Object} config - Configuration object with theme settings
 * @param {string} config.primaryColor - Primary color for mermaid theme
 * @param {string} config.primaryTextColor - Primary text color for mermaid theme
 * @returns {string} Processed diagram text with theme configuration
 */
function processDiagramWithTheme(fileContent, config) {
    // Get diagram text (excluding comments)
    const diagramText = fileContent.split('\n').filter(l => !l.startsWith('%%')).join('\n');
    
    // Inject theme configuration if not already present
    if (!diagramText.includes('---\nconfig:')) {
        const themeConfig = (
            "---\n" +
            "config:\n" +
            "  theme: 'base'\n" +
            "  themeVariables:\n" +
            `    primaryColor: '${config.primaryColor}'\n` +
            `    primaryTextColor: '${config.primaryTextColor}'\n` +
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
function createDynamicSpinner(color) {
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
 * Mermaid Diagram Auto-Updater
 * Automatically updates a Mermaid diagram based on embedded session comments
 * 
 * @param {Object} diagramManager - Diagram manager instance from createDiagramManager
 * @param {string} containerId - ID of the HTML element to contain the diagram
 * @param {Object} options - Configuration options
 * @param {string} options.primaryColor - Primary color for mermaid theme
 * @param {string} options.primaryTextColor - Primary text color for mermaid theme
 */
function initMermaidUpdater(diagramManager, containerId, options = {}) {
    // Default configuration
    const config = {
        primaryColor: options.primaryColor || '#4472C4',
        primaryTextColor: options.primaryTextColor || '#fff'
    };
    
    // Initialize Mermaid
    mermaid.initialize({startOnLoad: true});
    
    function updateDiagram(fileContent) {
        // Parse block states from session comments
        const blockStates = parseBlockStatesFromComments(fileContent);
        
        // Process diagram text and apply theme configuration
        let modifiedDiagram = processDiagramWithTheme(fileContent, config);
        
        // Modify diagram to add images to running blocks
        const dynamicSpinnerUrl = createDynamicSpinner(config.primaryTextColor);
        blockStates.forEach((state, blockId) => {
            if (state === 'Running') {
                const regex = new RegExp(`(${blockId}\\[)([^\\]]+)(\\])`, 'g');
                modifiedDiagram = modifiedDiagram.replace(regex, 
                    `$1<img src='${dynamicSpinnerUrl}' height='25' style='object-fit: contain;' />$2$3`
                );
            }
        });
        
        document.getElementById(containerId).innerHTML = `<div class="mermaid">${modifiedDiagram}</div>`;
        mermaid.init();
    }
    
    // Subscribe to diagram manager for updates
    const unsubscribe = diagramManager.subscribe(updateDiagram);
    
    // Return cleanup function
    return function cleanup() {
        unsubscribe();
    };
}