/**
 * Generate and render progress bar HTML directly to the DOM
 * @param {string} containerId - ID of the container element
 * @param {number} progressPercentage - Progress percentage (0-100)
 * @param {Object} config - Configuration object with colors
 */
function renderProgressBar(containerId, progressPercentage, config) {
    const cssContainer = (
        `width:100%;background-color:${config.backgroundColor};border-radius:8px;` +
        `overflow:hidden;height:20px;margin:10px 0;border:1px solid #dee2e6`
    );
    const cssBar = (
        `width:${progressPercentage}%;background-color:${config.barColor};` +
        `height:100%;transition:width 0.3s ease;display:flex;align-items:center;` +
        `justify-content:center;color:white;font-size:12px;font-weight:bold;` +
        `font-family:'trebuchet ms',verdana,arial,sans-serif`
    );
    const text = progressPercentage > 15 ? `${progressPercentage}%` : '';
    
    document.getElementById(containerId).innerHTML = (
        `<div style="${cssContainer}"><div style="${cssBar}">${text}</div></div>`
    );
}

/**
 * Progress Bar Auto-Updater
 * Automatically updates a progress bar based on "Done" blocks in diagram.mmd
 * 
 * @requires parseStates, createDiagramManager, getStatusAge, MAX_STATUS_AGE_S, and state constants from utils.js
 * 
 * @param {Object} diagramManager - Diagram manager instance from createDiagramManager
 * @param {string} containerId - ID of the HTML element to contain the progress bar
 * @param {Object} options - Configuration options
 * @param {string} options.barColor - Color of the progress bar (default: '#4472C4')
 * @param {string} options.bgColor - Background color of the progress bar (default: '#e9ecef')
 * @param {string} options.staleBarColor - Color of the progress bar when stale (default: '#9ca3af')
 * @param {string} options.staleBgColor - Background color when stale (default: '#f3f4f6')
 */
function initProgressBar(diagramManager, containerId, options = {}) {
    // Default configuration
    const config = {
        barColor: options.barColor || '#4472C4',
        bgColor: options.bgColor || '#e9ecef',
        staleBarColor: options.staleBarColor || '#9ca3af',
        staleBgColor: options.staleBgColor || '#f3f4f6'
    };
    
    function updateProgressBar(fileContent) {
        try {
            // Parse block states using shared utility function
            const blockStates = parseStates(fileContent);
            
            // Check if status is stale
            const statusAge = getStatusAge(fileContent);
            const isStale = statusAge !== null && statusAge >= MAX_STATUS_AGE_S;
            
            // Choose colors based on staleness
            const currentConfig = {
                barColor: isStale ? config.staleBarColor : config.barColor,
                backgroundColor: isStale ? config.staleBgColor : config.bgColor
            };
            
            // Calculate progress from block states
            let totalBlocks = 0;
            let completedBlocks = 0;
            
            blockStates.forEach((block, blockId) => {
                totalBlocks++;
                if (block.state === STATE_SUCCESS || block.state === STATE_FAILED) {
                    completedBlocks++;
                }
            });
            
            // Calculate progress percentage
            const progress_pct = (
                totalBlocks > 0 ? Math.round((completedBlocks / totalBlocks) * 100) : 0
            );
            
            // Generate and render progress bar HTML directly to DOM
            renderProgressBar(containerId, progress_pct, currentConfig);
            
        } catch (error) {
            console.error('Error updating progress bar:', error);
        }
    }
    
    // Subscribe to diagram manager for updates
    const unsubscribe = diagramManager.onRedraw(updateProgressBar);
    
    // Return cleanup function
    return function cleanup() {
        unsubscribe();
    };
}