/**
 * @requires parseStates, createDiagramManager, getStatusAge, MAX_STATUS_AGE_S, createStatusLine, formatDuration, extractColors, extractDiagram, state constants, and CSS class helpers from utils.js
 */

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
 * @param {Object} opts - Configuration options
 * @param {string} opts.defaultStyle - Default CSS styling for blocks (default: 'fill:#4472C4,stroke:#ffffff,stroke-width:1px,color:#fff')
 * @param {string} opts.successStyle - CSS styling for success blocks (default: 'stroke:#28a745,stroke-width:3px')
 * @param {string} opts.failedStyle - CSS styling for failed blocks (default: 'stroke:#dc3545,stroke-width:3px')
 * @param {string} opts.staleDefaultStyle - Default CSS styling when stale (default: same as defaultStyle but greyed)
 * @param {string} opts.staleSuccessStyle - Success CSS styling when stale (default: same as successStyle but greyed)
 * @param {string} opts.staleFailedStyle - Failed CSS styling when stale (default: same as failedStyle but greyed)
 */
function initDAG(diagramManager, containerId, opts = {}) {
    const config = {
        defaultStyle: 'fill:#f8f9fa,stroke:#4472C4,stroke-width:2px,color:#495057',
        successStyle: 'fill:#f8f9fa,stroke:#28a745,stroke-width:2px,color:#155724',
        failedStyle: 'fill:#f8f9fa,stroke:#dc3545,stroke-width:2px,color:#721c24',
        staleDefaultStyle: 'fill:#f3f4f6,stroke:#9ca3af,stroke-width:2px,color:#6b7280',
        staleSuccessStyle: 'fill:#f3f4f6,stroke:#6b8e6b,stroke-width:2px,color:#6b7280',
        staleFailedStyle: 'fill:#f3f4f6,stroke:#a37373,stroke-width:2px,color:#6b7280',
        ...opts
    };
    
    const {textColor} = extractColors(config.defaultStyle);
    
    // Initialize Mermaid
    mermaid.initialize({startOnLoad: true});
    
    function updateDiagram(fileContent) {
        // Check if status is stale
        const statusAge = getStatusAge(fileContent);
        const isStale = statusAge !== null && statusAge >= MAX_STATUS_AGE_S;
        
        let diagram = extractDiagram(fileContent, config);

        // Apply state-based styling
        const getAction = (state, blockId) => {
            const createAction = (rt, showSpinner = false, cssClass = '') => 
                `$1$2${formatState(rt, showSpinner, textColor, blockId)}$3${cssClass}`;
            
            const actions = {
                [STATE_RUNNING]: (rt) => createAction(rt, !isStale),
                [STATE_SUCCESS]: (rt) => createAction(rt, false, `:::${CLS_SUCCESS}`),
                [STATE_FAILED]: (rt) => createAction(rt, false, `:::${CLS_FAILED}`)
            };
            return actions[state] || ((rt) => createAction('-', false));
        };
        
        parseStates(fileContent).forEach((blockData, blockId) => {
            const runtime = formatDuration(blockData.runtime);
            const actionFn = getAction(blockData.state, blockId);
            diagram = style(diagram, blockId, actionFn(runtime));
        });
        
        const currentStyles = {
            defaultStyle: isStale ? config.staleDefaultStyle : config.defaultStyle,
            successStyle: isStale ? config.staleSuccessStyle : config.successStyle,
            failedStyle: isStale ? config.staleFailedStyle : config.failedStyle
        };
        
        // Add CSS styling for success, failed, and Mermaid's predefined default states.
        const styledDiagram = (
            `${diagram}\n\n` +
            `classDef default ${currentStyles.defaultStyle}` + "\n" +
            `classDef ${CLS_SUCCESS} ${currentStyles.successStyle}` + "\n" +
            `classDef ${CLS_FAILED} ${currentStyles.failedStyle}`
        );

        document.getElementById(containerId).innerHTML = (
            `<div class="mermaid">${styledDiagram}</div>`
        );
        mermaid.init();
    }
    
    function updateRuntimeOnly(fileContent) {
        // Update each block's runtime text element within the container
        parseStates(fileContent).forEach((blockData, blockId) => {
            const element = document.getElementById(containerId)
                ?.querySelector(`#${blockId}_text`);
            if (element) element.textContent = formatDuration(blockData.runtime);
        });
    }
    
    // Subscribe to diagram manager for redraw events (full re-render)
    const unsubscribeRedraw = diagramManager.onRedraw(updateDiagram);
    const unsubscribeUpdate = diagramManager.onUpdate(updateRuntimeOnly);
    
    // Return cleanup function
    return function cleanup() {
        unsubscribeRedraw();
        unsubscribeUpdate();
    };
}