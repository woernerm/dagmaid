/**
 * Mermaid Diagram Auto-Updater
 * Automatically updates a Mermaid diagram based on session status files
 * 
 * @param {string} diagramUrl - URL to the diagram.txt file
 * @param {string} sessionUrl - URL to the session.lst file
 * @param {string} containerId - ID of the HTML element to contain the diagram
 * @param {Object} options - Configuration options
 * @param {number} options.interval_s - Update interval in seconds
 * @param {string} options.primaryColor - Primary color for mermaid theme
 * @param {string} options.primaryTextColor - Primary text color for mermaid theme
 */
function initMermaidUpdater(diagramUrl, sessionUrl, containerId, options = {}) {
    // Default configuration
    const config = {
        interval_s: options.interval_s || 1,
        primaryColor: options.primaryColor || '#4472C4',
        primaryTextColor: options.primaryTextColor || '#fff'
    };
    
    // Create dynamic spinner SVG with primaryTextColor
    function createDynamicSpinner() {
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
            <circle cx="12" cy="5" r="2" fill="${config.primaryTextColor}" class="dot1"/>
            <circle cx="17" cy="7" r="2" fill="${config.primaryTextColor}" class="dot2"/>
            <circle cx="19" cy="12" r="2" fill="${config.primaryTextColor}" class="dot3"/>
            <circle cx="17" cy="17" r="2" fill="${config.primaryTextColor}" class="dot4"/>
            <circle cx="12" cy="19" r="2" fill="${config.primaryTextColor}" class="dot5"/>
            <circle cx="7" cy="17" r="2" fill="${config.primaryTextColor}" class="dot6"/>
            <circle cx="5" cy="12" r="2" fill="${config.primaryTextColor}" class="dot7"/>
            <circle cx="7" cy="7" r="2" fill="${config.primaryTextColor}" class="dot8"/>
        </svg>`;
        
        return 'data:image/svg+xml;base64,' + btoa(svgContent);
    }
    
    // Initialize Mermaid
    mermaid.initialize({startOnLoad: true});
    
    // Content tracking for change detection
    let lastSessionContent = null;
    let lastDiagramContent = null;
    
    function updateDiagram() {
        // Prevent browser caching with fetch options
        const fetchOptions = { cache: 'no-store' };
        Promise.all([
            fetch(diagramUrl, fetchOptions).then(r => r.text()),
            fetch(sessionUrl, fetchOptions).then(r => r.text())
        ]).then(([diagramText, sessionText]) => {
            // Only update if content has changed (or first load)
            if (lastSessionContent !== null && 
                sessionText === lastSessionContent && 
                diagramText === lastDiagramContent) {
                return;
            }
            
            lastSessionContent = sessionText;
            lastDiagramContent = diagramText;
            
            // Parse session status
            const runningBlocks = new Set();
            sessionText.split('\n').forEach(line => {
                const match = line.match(/^(\w+):\s*Running/);
                if (match) {
                    runningBlocks.add(match[1]);
                }
            });
            
            // Inject theme configuration if not already present
            let modifiedDiagram = diagramText;
            if (!diagramText.includes('---\nconfig:')) {
                const themeConfig = `---
config:
  theme: 'base'
  themeVariables:
    primaryColor: '${config.primaryColor}'
    primaryTextColor: '${config.primaryTextColor}'

---

`;
                modifiedDiagram = themeConfig + diagramText;
            }
            
            // Modify diagram to add images to running blocks
            const dynamicSpinnerUrl = createDynamicSpinner();
            runningBlocks.forEach(blockId => {
                const regex = new RegExp(`(${blockId}\\[)([^\\]]+)(\\])`, 'g');
                modifiedDiagram = modifiedDiagram.replace(regex, 
                    `$1<img src='${dynamicSpinnerUrl}' height='25' style='object-fit: contain;' />$2$3`
                );
            });
            
            document.getElementById(containerId).innerHTML = `<div class="mermaid">${modifiedDiagram}</div>`;
            mermaid.init();
        }).catch(error => {
            console.error('Error updating diagram:', error);
        });
    }
    
    // Initial load
    updateDiagram();
    
    // Set up automatic refresh
    const intervalId = setInterval(updateDiagram, config.interval_s * 1000);
    
    // Return cleanup function
    return function cleanup() {
        clearInterval(intervalId);
    };
}