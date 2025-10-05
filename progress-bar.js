/**
 * Generate and render progress bar HTML directly to the DOM
 * @param {string} containerId - ID of the container element
 * @param {number} progressPercentage - Progress percentage (0-100)
 * @param {Object} config - Configuration object with colors
 */
function renderProgressBar(containerId, progressPercentage, config) {
    const height = config.height || '20px';
    
    // Calculate font size relative to height (roughly 60% of height)
    const heightValue = parseFloat(height);
    const heightUnit = height.replace(/[\d.]/g, '') || 'px';
    const fontSize = `${Math.max(8, heightValue * 0.6)}${heightUnit}`;
    
    const cssContainer = (
        `width:100%;background-color:${config.backgroundColor};border-radius:8px;` +
        `overflow:hidden;height:${height};margin:10px 0;border:1px solid #dee2e6;position:relative`
    );
    const cssBar = (
        `width:${progressPercentage}%;background-color:${config.barColor};` +
        `height:100%;transition:width 0.3s ease`
    );
    const textColor = config.textColor || 'white';
    const cssText = (
        `position:absolute;top:0;left:0;width:100%;height:100%;` +
        `display:flex;align-items:center;justify-content:center;` +
        `color:${textColor};font-size:${fontSize};font-weight:bold;` +
        `font-family:'trebuchet ms',verdana,arial,sans-serif;pointer-events:none`
    );
    
    document.getElementById(containerId).innerHTML = (
        `<div style="${cssContainer}">` +
        `<div style="${cssBar}"></div>` +
        `<div style="${cssText}">${progressPercentage}%</div>` +
        `</div>`
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
 * @param {string} options.height - Height of the progress bar (default: '20px')
 * @param {string} options.textColor - Color of the percentage text (default: 'white')
 */
function createProgressBar(diagramManager, containerId, options = {}) {
    // Default configuration
    const config = {
        barColor: options.barColor || '#4472C4',
        bgColor: options.bgColor || '#e9ecef',
        staleBarColor: options.staleBarColor || '#9ca3af',
        staleBgColor: options.staleBgColor || '#f3f4f6',
        height: options.height || '20px',
        textColor: options.textColor || 'white'
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
                backgroundColor: isStale ? config.staleBgColor : config.bgColor,
                height: config.height,
                textColor: config.textColor
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