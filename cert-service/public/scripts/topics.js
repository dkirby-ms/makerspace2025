/**
 * Topics page JavaScript functionality with WebSocket support
 */

let ws = null;

document.addEventListener('DOMContentLoaded', function() {
    initWebSocket();
    schedulePageRefresh();
});

function initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    ws = new WebSocket(wsUrl);
    
    ws.onopen = function() {
        console.log('WebSocket connected');
        updateConnectionStatus(true);
    };
    
    ws.onmessage = function(event) {
        try {
            const message = JSON.parse(event.data);
            console.log('WebSocket message received:', message);
            
            if (message.type === 'mqtt-message') {
                addMessageToList(message);
            } else if (message.type === 'connected') {
                console.log('WebSocket connection confirmed');
            }
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    };
    
    ws.onclose = function() {
        console.log('WebSocket disconnected');
        updateConnectionStatus(false);
        
        // Attempt to reconnect after 5 seconds
        setTimeout(initWebSocket, 5000);
    };
    
    ws.onerror = function(error) {
        console.error('WebSocket error:', error);
        updateConnectionStatus(false);
    };
}

function updateConnectionStatus(connected) {
    const statusEl = document.getElementById('connection-status');
    if (statusEl) {
        if (connected) {
            statusEl.textContent = 'Connected';
            statusEl.className = 'connection-status status-connected';
        } else {
            statusEl.textContent = 'Disconnected';
            statusEl.className = 'connection-status status-disconnected';
        }
    }
}

function addMessageToList(message) {
    const messagesList = document.getElementById('messages-list');
    if (!messagesList) return;
    
    // Clear "No messages yet" text if present
    if (messagesList.children.length === 1 && 
        messagesList.children[0].textContent.includes('No messages yet')) {
        messagesList.innerHTML = '';
    }
    
    const messageEl = document.createElement('div');
    messageEl.className = 'message-item';
    
    // Handle both MQTT message format and direct message format
    const topic = message.topic || 'Unknown Topic';
    const payload = message.payload || JSON.stringify(message);
    const timestamp = message.timestamp ? new Date(message.timestamp) : new Date();
    
    messageEl.innerHTML = `
        <div class="message-topic">${topic}</div>
        <div class="message-timestamp">${timestamp.toLocaleString()}</div>
        <div class="message-payload">${typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2)}</div>
        <div class="message-metadata">QoS: ${message.qos || 0} | Retain: ${message.retain || false}</div>
    `;
    
    // Add to the top of the list
    messagesList.insertBefore(messageEl, messagesList.firstChild);
    
    // Keep only the latest 50 messages
    while (messagesList.children.length > 50) {
        messagesList.removeChild(messagesList.lastChild);
    }
}

function clearMessages() {
    const messagesList = document.getElementById('messages-list');
    if (messagesList) {
        messagesList.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">No messages yet</div>';
    }
}

function schedulePageRefresh() {
    // Auto-refresh page every 5 minutes (but keep WebSocket for real-time messages)
    setTimeout(() => {
        window.location.reload();
    }, 300000);
}
