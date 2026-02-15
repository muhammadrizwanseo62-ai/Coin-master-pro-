/**
 * Admin Network Integration JavaScript
 * Handles CPA network iframe code management, offers.html generation
 * EXACTLY AS REQUESTED - Simple 5 field system
 */

// Global variables
let networks = [];
let currentNetworkId = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    loadNetworks();
    setupEventListeners();
    checkGeneratedFile();
});

// Load networks from API
async function loadNetworks() {
    try {
        const token = localStorage.getItem('token') || getAuthToken();
        const response = await fetch('/api/admin/networks', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            networks = data.networks || [];
            renderNetworks();
            updateStats();
        }
    } catch (error) {
        console.error('Load networks error:', error);
        showNotification('Failed to load networks', 'error');
    }
}

// Render networks list
function renderNetworks() {
    const container = document.getElementById('networksList');
    const emptyState = document.getElementById('emptyState');
    
    if (!container) return;
    
    if (networks.length === 0) {
        container.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }
    
    if (emptyState) emptyState.style.display = 'none';
    
    // Sort by display order
    networks.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    
    let html = '';
    networks.forEach((network, index) => {
        const statusClass = network.status === 'active' ? 'badge-active' : 'badge-inactive';
        const cardClass = network.status === 'active' ? 'network-card active' : 'network-card inactive';
        const toggleIcon = network.status === 'active' ? 'fa-pause' : 'fa-play';
        const toggleTitle = network.status === 'active' ? 'Deactivate' : 'Activate';
        
        // Truncate iframe preview
        let iframePreview = network.iframeCode || '';
        if (iframePreview.length > 150) {
            iframePreview = iframePreview.substring(0, 150) + '...';
        }
        
        html += `
            <div class="${cardClass}" data-network-id="${network._id}" data-order="${network.displayOrder || 0}">
                <div class="network-header">
                    <div class="network-title">
                        <i class="fas ${network.icon || 'fa-ad'}"></i>
                        <div>
                            <h3>${escapeHtml(network.displayName || network.name)}</h3>
                            <small>Order: ${network.displayOrder || 0} | ID: ${network.networkId || network._id?.substring(0, 8) || 'NET-001'}</small>
                        </div>
                    </div>
                    <div>
                        <span class="badge ${statusClass}">${network.status || 'inactive'}</span>
                    </div>
                </div>
                
                <div class="network-preview">
                    <div class="preview-header">
                        <span class="preview-title">
                            <i class="fas fa-code"></i>
                            Iframe Code
                        </span>
                        <span class="text-muted small">
                            <i class="fas fa-clock"></i>
                            ${network.lastGenerated ? new Date(network.lastGenerated).toLocaleString() : 'Not generated'}
                        </span>
                    </div>
                    <div class="preview-code">
                        ${escapeHtml(iframePreview)}
                    </div>
                </div>
                
                <div class="network-footer">
                    <div class="network-meta">
                        <span class="meta-item">
                            <i class="fas fa-globe"></i>
                            ${network.countryTargeting === 'all' ? 'All Countries' : 'Specific Countries'}
                        </span>
                        ${network.description ? `
                            <span class="meta-item">
                                <i class="fas fa-info-circle"></i>
                                ${escapeHtml(network.description)}
                            </span>
                        ` : ''}
                    </div>
                    
                    <div class="network-actions">
                        <button class="btn-icon btn-edit" onclick="editNetwork('${network._id}')" title="Edit Network">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon btn-toggle ${network.status === 'active' ? 'active' : 'inactive'}" 
                                onclick="toggleNetworkStatus('${network._id}')" 
                                title="${toggleTitle}">
                            <i class="fas ${toggleIcon}"></i>
                        </button>
                        <button class="btn-icon btn-preview" onclick="previewNetwork('${network._id}')" title="Preview Iframe">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-icon btn-duplicate" onclick="duplicateNetwork('${network._id}')" title="Duplicate">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button class="btn-icon btn-delete" onclick="deleteNetwork('${network._id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    
    // Make networks sortable
    makeSortable();
}

// Make networks sortable via drag and drop
function makeSortable() {
    const container = document.getElementById('networksList');
    if (!container) return;
    
    let draggedItem = null;
    
    container.addEventListener('dragstart', function(e) {
        draggedItem = e.target.closest('.network-card');
        if (draggedItem) {
            draggedItem.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        }
    });
    
    container.addEventListener('dragend', function(e) {
        if (draggedItem) {
            draggedItem.classList.remove('dragging');
            
            // Update order
            const items = [...container.querySelectorAll('.network-card')];
            const newOrder = items.map((item, index) => {
                return {
                    id: item.dataset.networkId,
                    order: index
                };
            });
            
            saveNetworkOrder(newOrder);
            draggedItem = null;
        }
    });
    
    container.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        const afterElement = getDragAfterElement(container, e.clientY);
        const dragging = document.querySelector('.dragging');
        
        if (afterElement) {
            container.insertBefore(dragging, afterElement);
        } else {
            container.appendChild(dragging);
        }
    });
}

// Get drag after element
function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.network-card:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// Save network order after drag
async function saveNetworkOrder(orderArray) {
    try {
        const token = localStorage.getItem('token') || getAuthToken();
        const response = await fetch('/api/admin/networks/reorder', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ 
                orders: orderArray.map(item => item.id),
                networkOrders: orderArray.map(item => item.id)
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Network order updated successfully', 'success');
            loadNetworks(); // Reload to get fresh order
        } else {
            showNotification('Failed to update order', 'error');
        }
    } catch (error) {
        console.error('Save order error:', error);
        showNotification('Failed to save order', 'error');
    }
}

// Update statistics
function updateStats() {
    const totalNetworks = document.getElementById('totalNetworks');
    const activeNetworks = document.getElementById('activeNetworks');
    const inactiveNetworks = document.getElementById('inactiveNetworks');
    const lastGenerated = document.getElementById('lastGenerated');
    
    if (totalNetworks) totalNetworks.textContent = networks.length;
    if (activeNetworks) activeNetworks.textContent = networks.filter(n => n.status === 'active').length;
    if (inactiveNetworks) inactiveNetworks.textContent = networks.filter(n => n.status === 'inactive').length;
    
    // Find most recent generation
    const latest = networks.reduce((latest, n) => {
        return n.lastGenerated && (!latest || new Date(n.lastGenerated) > new Date(latest)) 
            ? n.lastGenerated 
            : latest;
    }, null);
    
    if (lastGenerated && latest) {
        lastGenerated.textContent = new Date(latest).toLocaleString();
    }
}

// Open add network modal
function openAddNetworkModal() {
    resetNetworkForm();
    document.getElementById('modalTitle').textContent = 'Add New Network';
    document.getElementById('networkModal').classList.add('active');
    currentNetworkId = null;
}

// Reset network form
function resetNetworkForm() {
    const form = document.getElementById('networkForm');
    if (form) form.reset();
    
    document.getElementById('networkId').value = '';
    document.getElementById('customNameGroup').style.display = 'none';
    document.getElementById('targetCountriesGroup').style.display = 'none';
    
    // Set defaults
    document.getElementById('status').value = 'active';
    document.getElementById('displayOrder').value = networks.length;
    document.getElementById('width').value = '100%';
    document.getElementById('height').value = '600px';
    document.getElementById('scrolling').value = 'auto';
    document.getElementById('loading').value = 'lazy';
    document.getElementById('icon').value = 'fa-ad';
}

// Toggle custom name field
function toggleCustomName() {
    const networkName = document.getElementById('networkName')?.value;
    const customNameGroup = document.getElementById('customNameGroup');
    
    if (networkName === 'Other') {
        customNameGroup.style.display = 'block';
        document.getElementById('customName').required = true;
    } else {
        customNameGroup.style.display = 'none';
        document.getElementById('customName').required = false;
    }
}

// Save network
async function saveNetwork(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const networkId = document.getElementById('networkId').value;
    const isEdit = !!networkId;
    
    // Validate iframe code
    const iframeCode = formData.get('iframeCode');
    if (!iframeCode.includes('<iframe') && !iframeCode.includes('<script')) {
        showNotification('Invalid iframe code. Must contain <iframe> or <script> tag', 'error');
        return;
    }
    
    const data = {
        name: formData.get('name'),
        customName: formData.get('customName'),
        iframeCode: iframeCode,
        status: formData.get('status'),
        displayOrder: parseInt(formData.get('displayOrder')) || 0,
        countryTargeting: formData.get('countryTargeting') || 'all',
        width: formData.get('width') || '100%',
        height: formData.get('height') || '600px',
        scrolling: formData.get('scrolling') || 'auto',
        description: formData.get('description') || '',
        icon: formData.get('icon') || 'fa-ad',
        loading: formData.get('loading') || 'lazy'
    };
    
    // Add target countries if specific targeting
    if (data.countryTargeting === 'specific') {
        const select = document.getElementById('targetCountries');
        data.targetCountries = Array.from(select.selectedOptions).map(opt => opt.value);
    }
    
    try {
        const token = localStorage.getItem('token') || getAuthToken();
        const url = isEdit ? `/api/admin/networks/${networkId}` : '/api/admin/networks';
        const method = isEdit ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification(`Network ${isEdit ? 'updated' : 'added'} successfully!`, 'success');
            showNotification('Offers page is being regenerated...', 'info');
            closeModal();
            loadNetworks();
            
            // Check if offers.html was generated
            setTimeout(checkGeneratedFile, 2000);
        } else {
            showNotification(result.message || 'Failed to save network', 'error');
        }
    } catch (error) {
        console.error('Save network error:', error);
        showNotification('Failed to save network', 'error');
    }
}

// Edit network
async function editNetwork(id) {
    try {
        const token = localStorage.getItem('token') || getAuthToken();
        const response = await fetch(`/api/admin/networks/${id}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            const network = data.network;
            currentNetworkId = network._id;
            
            document.getElementById('modalTitle').textContent = 'Edit Network';
            document.getElementById('networkId').value = network._id;
            document.getElementById('networkName').value = network.name || '';
            document.getElementById('iframeCode').value = network.iframeCode || '';
            document.getElementById('status').value = network.status || 'active';
            document.getElementById('displayOrder').value = network.displayOrder || 0;
            document.getElementById('countryTargeting').value = network.countryTargeting || 'all';
            document.getElementById('width').value = network.width || '100%';
            document.getElementById('height').value = network.height || '600px';
            document.getElementById('scrolling').value = network.scrolling || 'auto';
            document.getElementById('description').value = network.description || '';
            document.getElementById('icon').value = network.icon || 'fa-ad';
            document.getElementById('loading').value = network.loading || 'lazy';
            
            // Handle custom name
            if (network.customName) {
                document.getElementById('customName').value = network.customName;
                document.getElementById('customNameGroup').style.display = 'block';
            } else {
                document.getElementById('customNameGroup').style.display = 'none';
            }
            
            // Handle target countries
            if (network.countryTargeting === 'specific' && network.targetCountries) {
                const select = document.getElementById('targetCountries');
                Array.from(select.options).forEach(option => {
                    option.selected = network.targetCountries.includes(option.value);
                });
                document.getElementById('targetCountriesGroup').style.display = 'block';
            } else {
                document.getElementById('targetCountriesGroup').style.display = 'none';
            }
            
            document.getElementById('networkModal').classList.add('active');
        }
    } catch (error) {
        console.error('Edit network error:', error);
        showNotification('Failed to load network details', 'error');
    }
}

// Toggle network status
async function toggleNetworkStatus(id) {
    try {
        const token = localStorage.getItem('token') || getAuthToken();
        const response = await fetch(`/api/admin/networks/${id}/toggle`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification(`Network ${data.status === 'active' ? 'activated' : 'deactivated'}`, 'success');
            showNotification('Offers page is being regenerated...', 'info');
            loadNetworks();
            setTimeout(checkGeneratedFile, 2000);
        } else {
            showNotification('Failed to toggle network status', 'error');
        }
    } catch (error) {
        console.error('Toggle network error:', error);
        showNotification('Failed to toggle network', 'error');
    }
}

// Delete network
async function deleteNetwork(id) {
    if (!confirm('Are you sure you want to delete this network? This action cannot be undone.')) {
        return;
    }
    
    try {
        const token = localStorage.getItem('token') || getAuthToken();
        const response = await fetch(`/api/admin/networks/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Network deleted successfully', 'success');
            showNotification('Offers page is being regenerated...', 'info');
            loadNetworks();
            setTimeout(checkGeneratedFile, 2000);
        } else {
            showNotification('Failed to delete network', 'error');
        }
    } catch (error) {
        console.error('Delete network error:', error);
        showNotification('Failed to delete network', 'error');
    }
}

// Duplicate network
async function duplicateNetwork(id) {
    try {
        const network = networks.find(n => n._id === id);
        if (!network) return;
        
        const token = localStorage.getItem('token') || getAuthToken();
        const response = await fetch('/api/admin/networks', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                name: network.name === 'Other' ? 'Other' : network.name,
                customName: network.customName ? `${network.customName} (Copy)` : '',
                iframeCode: network.iframeCode,
                status: 'inactive',
                displayOrder: networks.length,
                countryTargeting: network.countryTargeting || 'all',
                targetCountries: network.targetCountries || [],
                width: network.width || '100%',
                height: network.height || '600px',
                scrolling: network.scrolling || 'auto',
                description: network.description ? `${network.description} (Copy)` : '',
                icon: network.icon || 'fa-ad',
                loading: network.loading || 'lazy'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Network duplicated successfully!', 'success');
            loadNetworks();
        }
    } catch (error) {
        console.error('Duplicate network error:', error);
        showNotification('Failed to duplicate network', 'error');
    }
}

// Preview network iframe
async function previewNetwork(id) {
    try {
        const token = localStorage.getItem('token') || getAuthToken();
        const response = await fetch(`/api/admin/networks/${id}/preview`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            const previewModal = document.getElementById('previewModal');
            const previewContent = document.getElementById('previewContent');
            
            if (previewContent) {
                previewContent.innerHTML = data.preview;
            }
            
            if (previewModal) {
                previewModal.classList.add('active');
            }
        }
    } catch (error) {
        console.error('Preview network error:', error);
        showNotification('Failed to generate preview', 'error');
    }
}

// Close preview modal
function closePreviewModal() {
    const modal = document.getElementById('previewModal');
    if (modal) modal.classList.remove('active');
}

// Regenerate offers page
async function regenerateOffersPage() {
    showNotification('Generating offers.html...', 'info');
    
    try {
        const token = localStorage.getItem('token') || getAuthToken();
        const response = await fetch('/api/admin/networks/generate', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification(`Offers page generated successfully! (${data.networksCount} networks)`, 'success');
            checkGeneratedFile();
            loadNetworks(); // Refresh to update lastGenerated timestamps
        } else {
            showNotification('Failed to generate offers page', 'error');
        }
    } catch (error) {
        console.error('Generate offers page error:', error);
        showNotification('Failed to generate offers page', 'error');
    }
}

// Clear cache
async function clearCache() {
    if (!confirm('Clear network cache? This will force regeneration of offers.html')) return;
    
    try {
        const token = localStorage.getItem('token') || getAuthToken();
        const response = await fetch('/api/admin/networks/cache/clear', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification(`Cache cleared! ${data.count} networks refreshed`, 'success');
            loadNetworks();
        } else {
            showNotification('Failed to clear cache', 'error');
        }
    } catch (error) {
        console.error('Clear cache error:', error);
        showNotification('Failed to clear cache', 'error');
    }
}

// Check if offers.html was generated
async function checkGeneratedFile() {
    const indicator = document.getElementById('generationIndicator');
    const lastGenTime = document.getElementById('lastGenerationTime');
    const viewLink = document.getElementById('viewOffersLink');
    
    try {
        const response = await fetch('/admin/offers.html', { method: 'HEAD' });
        
        if (response.ok) {
            if (indicator) {
                indicator.innerHTML = '<span class="badge badge-success"><i class="fas fa-check-circle"></i> Generated</span>';
            }
            
            const lastModified = response.headers.get('last-modified');
            if (lastGenTime && lastModified) {
                lastGenTime.textContent = new Date(lastModified).toLocaleString();
            }
            
            if (viewLink) {
                viewLink.style.display = 'inline-block';
            }
            
            return true;
        }
    } catch (error) {
        console.log('Offers.html not yet generated');
    }
    
    if (indicator) {
        indicator.innerHTML = '<span class="badge badge-warning"><i class="fas fa-exclamation-triangle"></i> Not Generated</span>';
    }
    
    if (viewLink) {
        viewLink.style.display = 'none';
    }
    
    return false;
}

// View offers page
function viewOffersPage() {
    window.open('/admin/offers.html', '_blank');
}

// Test iframe code
function testIframeCode() {
    const iframeCode = document.getElementById('iframeCode')?.value;
    if (!iframeCode) {
        showNotification('Please paste iframe code first', 'error');
        return;
    }
    
    const testModal = document.getElementById('testModal');
    const testContent = document.getElementById('testContent');
    
    if (testContent) {
        testContent.innerHTML = iframeCode;
    }
    
    if (testModal) {
        testModal.classList.add('active');
    }
}

// Close test modal
function closeTestModal() {
    const modal = document.getElementById('testModal');
    if (modal) modal.classList.remove('active');
}

// Close modal
function closeModal() {
    const modal = document.getElementById('networkModal');
    if (modal) modal.classList.remove('active');
    currentNetworkId = null;
}

// Export configuration
function exportConfig() {
    const config = {
        networks: networks,
        exportDate: new Date().toISOString(),
        version: '1.0'
    };
    
    const dataStr = JSON.stringify(config, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `network-config-${new Date().toISOString().slice(0,10)}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    showNotification('Configuration exported successfully', 'success');
}

// Import configuration
function importConfig() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    
    input.onchange = function(e) {
        const file = e.target.files[0];
        const reader = new FileReader();
        
        reader.onload = async function(e) {
            try {
                const config = JSON.parse(e.target.result);
                
                if (config.networks && Array.isArray(config.networks)) {
                    let imported = 0;
                    
                    for (const network of config.networks) {
                        try {
                            const token = localStorage.getItem('token') || getAuthToken();
                            await fetch('/api/admin/networks', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                                },
                                body: JSON.stringify({
                                    name: network.name || 'Other',
                                    customName: network.customName,
                                    iframeCode: network.iframeCode,
                                    status: 'inactive',
                                    displayOrder: networks.length + imported,
                                    countryTargeting: network.countryTargeting || 'all',
                                    targetCountries: network.targetCountries || [],
                                    width: network.width || '100%',
                                    height: network.height || '600px',
                                    scrolling: network.scrolling || 'auto',
                                    description: network.description,
                                    icon: network.icon || 'fa-ad',
                                    loading: network.loading || 'lazy'
                                })
                            });
                            imported++;
                        } catch (error) {
                            console.error('Import error:', error);
                        }
                    }
                    
                    showNotification(`Imported ${imported} networks successfully!`, 'success');
                    loadNetworks();
                }
            } catch (error) {
                showNotification('Invalid configuration file', 'error');
            }
        };
        
        reader.readAsText(file);
    };
    
    input.click();
}

// Setup event listeners
function setupEventListeners() {
    // Country targeting toggle
    const countryTargeting = document.getElementById('countryTargeting');
    if (countryTargeting) {
        countryTargeting.addEventListener('change', function() {
            const targetGroup = document.getElementById('targetCountriesGroup');
            if (targetGroup) {
                targetGroup.style.display = this.value === 'specific' ? 'block' : 'none';
            }
        });
    }
    
    // Network name change
    const networkName = document.getElementById('networkName');
    if (networkName) {
        networkName.addEventListener('change', toggleCustomName);
    }
    
    // Auto-refresh generation status every 10 seconds
    setInterval(checkGeneratedFile, 10000);
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification') || createNotification();
    
    notification.className = `notification notification-${type} show`;
    notification.querySelector('span').textContent = message;
    
    const icon = notification.querySelector('i');
    icon.className = `fas fa-${
        type === 'success' ? 'check-circle' : 
        type === 'error' ? 'exclamation-circle' : 
        type === 'warning' ? 'exclamation-triangle' : 'info-circle'
    }`;
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 5000);
}

// Create notification element
function createNotification() {
    const notification = document.createElement('div');
    notification.id = 'notification';
    notification.className = 'notification';
    notification.innerHTML = '<i class="fas"></i><span></span>';
    document.body.appendChild(notification);
    return notification;
}

// Get auth token
function getAuthToken() {
    return localStorage.getItem('token') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
}

// Escape HTML
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Export functions to global scope
window.loadNetworks = loadNetworks;
window.openAddNetworkModal = openAddNetworkModal;
window.saveNetwork = saveNetwork;
window.editNetwork = editNetwork;
window.toggleNetworkStatus = toggleNetworkStatus;
window.deleteNetwork = deleteNetwork;
window.duplicateNetwork = duplicateNetwork;
window.previewNetwork = previewNetwork;
window.closePreviewModal = closePreviewModal;
window.regenerateOffersPage = regenerateOffersPage;
window.clearCache = clearCache;
window.viewOffersPage = viewOffersPage;
window.testIframeCode = testIframeCode;
window.closeTestModal = closeTestModal;
window.closeModal = closeModal;
window.exportConfig = exportConfig;
window.importConfig = importConfig;
window.toggleCustomName = toggleCustomName;