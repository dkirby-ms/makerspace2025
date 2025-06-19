/**
 * Home page JavaScript functionality
 */

document.addEventListener('DOMContentLoaded', function() {
    initializeRefreshButton();
    initializeUnregisterButtons();
    scheduleAutoRefresh();
});

function initializeRefreshButton() {
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            window.location.reload();
        });
    }
}

function initializeUnregisterButtons() {
    const unregisterBtns = document.querySelectorAll('.unregister-btn');
    unregisterBtns.forEach(btn => {
        btn.addEventListener('click', async function() {
            const deviceId = this.getAttribute('data-device-id');
            await unregisterDevice(deviceId);
        });
    });
}

async function unregisterDevice(deviceId) {
    if (!confirm(`Are you sure you want to unregister device "${deviceId}"? This action cannot be undone.`)) {
        return;
    }
    
    try {
        const response = await fetch(`/device/${deviceId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            alert(`Device "${deviceId}" has been successfully unregistered.`);
            window.location.reload();
        } else {
            const errorData = await response.json();
            alert(`Failed to unregister device: ${errorData.error || 'Unknown error'}`);
        }
    } catch (error) {
        alert(`Error unregistering device: ${error.message}`);
    }
}

function scheduleAutoRefresh() {
    // Auto-refresh every 30 seconds
    setTimeout(() => {
        window.location.reload();
    }, 30000);
}
