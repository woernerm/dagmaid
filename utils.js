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
 * Parse session data from mermaid file comments and return block states
 * @param {string} fileContent - The complete mermaid file content
 * @returns {Map<string, string>} Map of block IDs to their current states
 */
function parseStates(fileContent) {
    const blockStates = new Map();
    
    // Parse session status for all blocks using global regex
    const matches = fileContent.matchAll(/^%% (\w+):\s*(\w+)/gm);
    for (const match of matches) {
        const blockId = match[1];
        const state = match[2];
        blockStates.set(blockId, state);
    }
    
    return blockStates;
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