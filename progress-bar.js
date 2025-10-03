/**
 * Progress Bar Auto-Updater
 * Automatically updates a progress bar based on session comments in diagram file
 * 
 * @requires parseBlockStatesFromComments function from mermaid-updater.js
 * 
 * @param {string} diagramUrl - URL to the diagram.mmd file
 * @param {string} containerId - ID of the HTML element to contain the progress bar
 * @param {Object} options - Configuration options
 * @param {number} options.interval_s - Update interval in seconds
 * @param {string} options.barColor - Color of the progress bar
 * @param {string} options.backgroundColor - Background color of the progress bar
 */
function initProgressBar(diagramUrl, containerId, options = {}) {
    // Default configuration
    const config = {
        interval_s: options.interval_s || 1,
        barColor: options.barColor || '#4472C4',
        backgroundColor: options.backgroundColor || '#e9ecef'
    };
    
    // Content tracking for change detection
    let lastFileContent = null;
    
    function updateProgressBar() {
        // Prevent browser caching
        const fetchOptions = { cache: 'no-store' };
        fetch(diagramUrl, fetchOptions)
            .then(r => r.text())
            .then(fileContent => {
                // Only update if content has changed (or first load)
                if (lastFileContent !== null && fileContent === lastFileContent) {
                    return;
                }
                
                lastFileContent = fileContent;
                
                console.log('Progress Bar Debug - File content received:', fileContent.length, 'characters');
                console.log('Progress Bar Debug - parseBlockStatesFromComments available:', typeof parseStates);
                
                // Parse block states using shared function from mermaid-updater.js
                let blockStates;
                if (typeof parseStates === 'function') {
                    blockStates = parseStates(fileContent);
                    console.log('Progress Bar Debug - Block states parsed:', blockStates);
                } else {
                    console.error('Progress Bar Error - parseBlockStatesFromComments function not available');
                    // Fallback parsing
                    blockStates = new Map();
                    fileContent.split('\n').forEach(line => {
                        const match = line.match(/^%%\s*([A-Za-z]+)\s*:\s*(\w+)/);
                        if (match) {
                            blockStates.set(match[1], match[2]);
                        }
                    });
                    console.log('Progress Bar Debug - Fallback parsing result:', blockStates);
                }
                
                // Calculate progress from block states
                let totalBlocks = 0;
                let doneBlocks = 0;
                
                blockStates.forEach((state, blockId) => {
                    console.log(`Progress Bar Debug - Block ${blockId}: ${state}`);
                    totalBlocks++;
                    if (state === 'Done') {
                        doneBlocks++;
                    }
                });
                
                console.log('Progress Bar Debug - Total blocks:', totalBlocks, 'Done blocks:', doneBlocks);
                
                // Calculate progress percentage
                const progressPercentage = totalBlocks > 0 ? Math.round((doneBlocks / totalBlocks) * 100) : 0;
                
                console.log('Progress Bar Debug - Progress percentage:', progressPercentage);
                
                // Update progress bar HTML
                const container = document.getElementById(containerId);
                container.innerHTML = `
                    <div style="width: 100%; background-color: ${config.backgroundColor}; border-radius: 8px; overflow: hidden; height: 20px; margin: 10px 0; border: 1px solid #dee2e6;">
                        <div style="width: ${progressPercentage}%; background-color: ${config.barColor}; height: 100%; transition: width 0.3s ease; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold; font-family: 'trebuchet ms', verdana, arial, sans-serif;">
                            ${progressPercentage > 15 ? `${progressPercentage}%` : ''}
                        </div>
                    </div>
                    <div style="text-align: center; font-size: 14px; color: #666; margin-top: 5px; font-family: 'trebuchet ms', verdana, arial, sans-serif;">
                        ${doneBlocks} of ${totalBlocks} tasks completed (${progressPercentage}%)
                    </div>
                `;
            })
            .catch(error => {
                console.error('Error updating progress bar:', error);
            });
    }
    
    // Initial load
    updateProgressBar();
    
    // Set up automatic refresh
    const intervalId = setInterval(updateProgressBar, config.interval_s * 1000);
    
    // Return cleanup function
    return function cleanup() {
        clearInterval(intervalId);
    };
}