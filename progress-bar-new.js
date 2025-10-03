/**
 * Generate and render progress bar HTML directly to the DOM
 * @param {string} containerId - ID of the container element
 * @param {number} progressPercentage - Progress percentage (0-100)
 * @param {Object} config - Configuration object with colors
 */
function generateProgressBarHTML(containerId, progressPercentage, config) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error('Progress Bar Error - Container element not found:', containerId);
        return;
    }
    
    const content = (
        `<div style="width: 100%; background-color: ${config.backgroundColor}; border-radius: 8px; overflow: hidden; height: 20px; margin: 10px 0; border: 1px solid #dee2e6;">` +
            `<div style="width: ${progressPercentage}%; background-color: ${config.barColor}; height: 100%; transition: width 0.3s ease; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold; font-family: 'trebuchet ms', verdana, arial, sans-serif;">` +
                `${progressPercentage > 15 ? `${progressPercentage}%` : ''}` +
            `</div>` +
        `</div>`
    );
    
    container.innerHTML = content;
}

/**
 * Progress Bar Auto-Updater
 * Automatically updates a progress bar based on "Done" blocks in diagram.mmd
 * 
 * @requires parseBlockStatesFromComments and createDiagramManager functions from utils.js
 * 
 * @param {Object} diagramManager - Diagram manager instance from createDiagramManager
 * @param {string} containerId - ID of the HTML element to contain the progress bar
 * @param {Object} options - Configuration options
 * @param {string} options.barColor - Color of the progress bar (default: '#4472C4')
 * @param {string} options.backgroundColor - Background color of the progress bar (default: '#e9ecef')
 */
function initProgressBar(diagramManager, containerId, options = {}) {
    // Default configuration
    const config = {
        barColor: options.barColor || '#4472C4',
        backgroundColor: options.backgroundColor || '#e9ecef'
    };
    
    function updateProgressBar(fileContent) {
        try {
            // Parse block states using shared utility function
            const blockStates = parseBlockStatesFromComments(fileContent);
            
            // Calculate progress from block states
            let totalBlocks = 0;
            let completedBlocks = 0;
            
            blockStates.forEach((state, blockId) => {
                totalBlocks++;
                if (state === 'Success' || state === 'Failed') {
                    completedBlocks++;
                }
            });
            
            // Calculate progress percentage
            const progressPercentage = totalBlocks > 0 ? Math.round((completedBlocks / totalBlocks) * 100) : 0;
            
            // Generate and render progress bar HTML directly to DOM
            generateProgressBarHTML(containerId, progressPercentage, config);
            
        } catch (error) {
            console.error('Error updating progress bar:', error);
        }
    }
    
    // Subscribe to diagram manager for updates
    const unsubscribe = diagramManager.subscribe(updateProgressBar);
    
    // Return cleanup function
    return function cleanup() {
        unsubscribe();
    };
}