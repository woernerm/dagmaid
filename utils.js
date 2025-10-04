/**
 * Utility functions for parsing mermaid diagram files and centralized file management
 */

// State constants - modify these to change state names throughout the application
const STATE_RUNNING = 'Running';
const STATE_SUCCESS = 'Success';
const STATE_FAILED = 'Failed';

// Helper function to generate CSS class names from state constants
function cssName(stateConstant) {
    return stateConstant.replace(/\s+/g, '').toLowerCase();
}

// CSS class names derived from state constants
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
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
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
 * @param {string} spinnerColor - Color for the spinner
 * @returns {string} HTML for the status line
 */
function formatState(text, showSpinner = false, spinnerColor = '#fff') {
    const spinnerHtml = showSpinner ? `<img src='${spinner(spinnerColor)}' height='20' style='margin-right:3px;vertical-align:middle;'/>` : '';
    const textHtml = `<span style='line-height:20px;vertical-align:middle;'>${text}</span>`;
    return `<br/><div style='display:flex;align-items:center;justify-content:center;font-size:14px;'>${spinnerHtml}${textHtml}</div>`;
}

/**
 * Parse status timestamp and compute the recency of the status in seconds
 * @param {string} fileContent - The complete mermaid file content
 * @returns {number|null} Age of the timestamp in seconds, or null if not found/invalid
 */
function getStatusAge(fileContent) {    
    try {
        const timestampMatch = fileContent.match(/^%% Status:\s*(.+)$/m);
        const statusDate = new Date(timestampMatch[1].trim());
        if (isNaN(statusDate.getTime())) return null;
        
        return ((new Date()).getTime() - statusDate.getTime()) / 1000;
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
 * Centralized diagram file manager that fetches content once and notifies multiple subscribers
 * @param {string} diagramUrl - URL to the diagram.mmd file
 * @param {number} intervalSeconds - Update interval in seconds
 * @returns {Object} Manager object with subscribe method
 */
function createDiagramManager(diagramUrl, intervalSeconds = 1) {
    const subscribers = new Set();
    let lastFileContent = null;
    let intervalId = null;
    
    function notifySubscribers(fileContent) {
        subscribers.forEach(callback => {
            try {
                callback(fileContent);
            } catch (error) {
                console.error('Error in diagram subscriber:', error);
            }
        });
    }
    
    function fetchAndUpdate() {
        const fetchOptions = { cache: 'no-store' };
        fetch(diagramUrl, fetchOptions)
            .then(r => r.text())
            .then(fileContent => {
                // Only notify if content has changed (or first load)
                if (lastFileContent !== fileContent) {
                    lastFileContent = fileContent;
                    notifySubscribers(fileContent);
                }
            })
            .catch(error => {
                console.error('Error fetching diagram file:', error);
            });
    }
    
    function start() {
        if (!intervalId) {
            // Initial fetch
            fetchAndUpdate();
            // Set up periodic fetching
            intervalId = setInterval(fetchAndUpdate, intervalSeconds * 1000);
        }
    }
    
    function stop() {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
    }
    
    function subscribe(callback) {
        subscribers.add(callback);
        // If we already have content, immediately notify the new subscriber
        if (lastFileContent !== null) {
            callback(lastFileContent);
        }
        
        // Return unsubscribe function
        return function unsubscribe() {
            subscribers.delete(callback);
        };
    }
    
    return {
        start,
        stop,
        subscribe,
        getSubscriberCount: () => subscribers.size
    };
}