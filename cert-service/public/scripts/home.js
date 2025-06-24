/**
 * Home page JavaScript functionality
 */

document.addEventListener('DOMContentLoaded', function() {
    initializeRefreshButton();
    initializeUnregisterButtons();
    initializeRemoveAllButton();
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

function initializeRemoveAllButton() {
    const removeAllBtn = document.getElementById('remove-all-btn');
    if (removeAllBtn) {
        removeAllBtn.addEventListener('click', async function() {
            await removeAllDevices();
        });
    }
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

async function removeAllDevices() {
    if (!confirm('Are you sure you want to remove ALL registered devices? This action cannot be undone and will affect all devices in the system.')) {
        return;
    }
    
    // Double confirmation for this destructive action
    if (!confirm('This will permanently remove all device registrations. Are you absolutely certain you want to proceed?')) {
        return;
    }
    
    try {
        const response = await fetch('/devices', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const result = await response.json();
            if (result.partialSuccess) {
                alert(`Partially successful: Removed ${result.removedCount} devices.\n\nErrors:\n${result.errors.join('\n')}`);
            } else {
                alert(`Successfully removed all ${result.removedCount} devices.`);
            }
            window.location.reload();
        } else {
            const errorData = await response.json();
            alert(`Failed to remove all devices: ${errorData.error || 'Unknown error'}`);
        }
    } catch (error) {
        alert(`Error removing all devices: ${error.message}`);
    }
}

function scheduleAutoRefresh() {
    // Auto-refresh every 30 seconds
    setTimeout(() => {
        window.location.reload();
    }, 30000);
}
