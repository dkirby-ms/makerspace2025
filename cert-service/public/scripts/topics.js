/**
 * Topics page JavaScript functionality with WebSocket support
 */

let currentTopic = '';
let ws = null;

document.addEventListener('DOMContentLoaded', function() {
    initWebSocket();
    schedulePageRefresh();
});

function initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    ws = new WebSocket(wsUrl);
    
    ws.onopen = function() {
        console.log('WebSocket connected');
        updateConnectionStatus(true);
    };
    
    ws.onmessage = function(event) {
        try {
            const message = JSON.parse(event.data);
            addMessageToList(message);
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

async function subscribeToTopic() {
    const topicInput = document.getElementById('topic-input');
    const topic = topicInput.value.trim();
    
    if (!topic) {
        alert('Please enter a topic to subscribe to');
        return;
    }

    try {
        const response = await fetch(`/api/topic/${encodeURIComponent(topic)}/subscribe`, {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            currentTopic = topic;
            document.getElementById('subscribe-btn').disabled = true;
            document.getElementById('unsubscribe-btn').disabled = false;
            document.getElementById('topic-input').disabled = true;
            
            // Clear previous messages
            clearMessages();
            
            // Load existing messages
            loadTopicMessages(topic);
        } else {
            alert(`Failed to subscribe: ${result.error}`);
        }
    } catch (error) {
        alert(`Error subscribing to topic: ${error.message}`);
    }
}

async function unsubscribeFromTopic() {
    if (!currentTopic) return;

    try {
        const response = await fetch(`/api/topic/${encodeURIComponent(currentTopic)}/subscribe`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            currentTopic = '';
            document.getElementById('subscribe-btn').disabled = false;
            document.getElementById('unsubscribe-btn').disabled = true;
            document.getElementById('topic-input').disabled = false;
        } else {
            alert(`Failed to unsubscribe: ${result.error}`);
        }
    } catch (error) {
        alert(`Error unsubscribing from topic: ${error.message}`);
    }
}

async function loadTopicMessages(topic) {
    try {
        const response = await fetch(`/api/topic/${encodeURIComponent(topic)}/messages`);
        const result = await response.json();
        
        if (response.ok && result.messages) {
            result.messages.forEach(message => {
                addMessageToList(message);
            });
        }
    } catch (error) {
        console.error('Error loading topic messages:', error);
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
    messageEl.innerHTML = `
        <div class="message-topic">${message.topic}</div>
        <div class="message-timestamp">${new Date(message.timestamp).toLocaleString()}</div>
        <div class="message-payload">${JSON.stringify(message.payload, null, 2)}</div>
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
