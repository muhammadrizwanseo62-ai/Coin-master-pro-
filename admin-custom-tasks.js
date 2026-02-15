/**
 * Admin Custom Tasks JavaScript
 * Handles task creation wizard, form builder, and task management
 */

// Global variables
let currentStep = 1;
const totalSteps = 8;
let formFields = [];
let currentTaskId = null;
let categories = [];

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    loadTasks();
    loadStats();
    loadCategories();
    setupWizard();
    setupDragDrop();
    setupEventListeners();
});

// Load tasks from API
async function loadTasks() {
    try {
        const token = localStorage.getItem('token') || getAuthToken();
        const response = await fetch('/api/admin/custom-tasks/analytics', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            renderTasksTable(data.topTasks || []);
            updateStats(data.overview || {});
        }
    } catch (error) {
        console.error('Load tasks error:', error);
        showNotification('Failed to load tasks', 'error');
    }
}

// Load task statistics
async function loadStats() {
    try {
        const token = localStorage.getItem('token') || getAuthToken();
        const response = await fetch('/api/admin/custom-tasks/analytics', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            updateStats(data.overview || {});
        }
    } catch (error) {
        console.error('Load stats error:', error);
    }
}

// Load categories
async function loadCategories() {
    try {
        const response = await fetch('/api/custom-tasks/categories');
        const data = await response.json();
        
        if (data.success) {
            categories = data.categories || [];
            renderCategoryOptions();
            renderCategoriesTable();
        }
    } catch (error) {
        console.error('Load categories error:', error);
    }
}

// Render tasks table
function renderTasksTable(tasks) {
    const tbody = document.getElementById('tasksTableBody');
    if (!tbody) return;
    
    if (!tasks || tasks.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="text-center py-5">
                    <i class="fas fa-tasks fa-3x text-muted mb-3"></i>
                    <p class="text-muted">No tasks found. Create your first task!</p>
                </td>
            </tr>
        `;
        return;
    }
    
    let html = '';
    tasks.forEach(task => {
        const statusClass = 
            task.status === 'active' ? 'badge-active' :
            task.status === 'paused' ? 'badge-paused' :
            task.status === 'expired' ? 'badge-expired' :
            task.status === 'completed' ? 'badge-completed' : 'badge-draft';
        
        const profit = task.profitUSD || (task.payoutUSD - (task.rewardCoins / 5000));
        
        html += `
            <tr>
                <td>
                    <input type="checkbox" class="task-checkbox" value="${task._id}" onchange="updateBulkActions()">
                </td>
                <td>
                    <small>${task.taskId || task._id?.substring(0, 8) || 'TASK-001'}</small>
                </td>
                <td>
                    <div class="task-title-cell">
                        <strong>${escapeHtml(task.title || 'Untitled Task')}</strong>
                        <br><small class="text-muted">${task.category || 'other'}</small>
                    </div>
                </td>
                <td>
                    <span class="reward-badge">
                        ${(task.rewardCoins || 0).toLocaleString()} coins
                    </span>
                    <br><small>$${(task.rewardUSD || 0).toFixed(2)}</small>
                </td>
                <td>
                    <span class="profit-badge">
                        $${(profit || 0).toFixed(2)}
                    </span>
                </td>
                <td>
                    <div class="progress" style="height: 6px; width: 100px;">
                        <div class="progress-bar bg-success" style="width: ${task.completedSlots && task.totalSlots ? (task.completedSlots / task.totalSlots * 100) : 0}%"></div>
                    </div>
                    <small>${task.completedSlots || 0}/${task.totalSlots || 0}</small>
                </td>
                <td>
                    <span class="badge ${statusClass}">${task.status || 'draft'}</span>
                </td>
                <td>
                    <span class="conversion-rate">${(task.conversionRate || 0).toFixed(1)}%</span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn btn-edit" onclick="editTask('${task._id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn btn-duplicate" onclick="duplicateTask('${task._id}')" title="Duplicate">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button class="action-btn btn-delete" onclick="deleteTask('${task._id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                        <button class="action-btn btn-view" onclick="previewTask('${task._id}')" title="Preview">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

// Update statistics display
function updateStats(overview) {
    const totalTasks = document.getElementById('totalTasks');
    const activeTasks = document.getElementById('activeTasks');
    const totalProfit = document.getElementById('totalProfit');
    const pendingReviews = document.getElementById('pendingReviews');
    
    if (totalTasks) totalTasks.textContent = overview.totalTasks || 0;
    if (activeTasks) activeTasks.textContent = overview.activeTasks || 0;
    if (totalProfit) totalProfit.textContent = `$${(overview.totalProfit || 0).toFixed(2)}`;
    if (pendingReviews) pendingReviews.textContent = overview.totalPending || 0;
}

// Render category options in dropdowns
function renderCategoryOptions() {
    const selects = document.querySelectorAll('.category-select');
    
    selects.forEach(select => {
        let options = '<option value="">Select Category</option>';
        
        categories.forEach(category => {
            options += `<option value="${category.slug || category.name.toLowerCase()}">${category.name}</option>`;
        });
        
        select.innerHTML = options;
    });
}

// Render categories table
function renderCategoriesTable() {
    const tbody = document.getElementById('categoriesTableBody');
    if (!tbody) return;
    
    if (!categories || categories.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4">
                    <p class="text-muted">No categories found. Create your first category!</p>
                </td>
            </tr>
        `;
        return;
    }
    
    let html = '';
    categories.forEach(category => {
        html += `
            <tr>
                <td>${category.categoryId || category._id?.substring(0, 8) || 'CAT-001'}</td>
                <td>
                    <i class="fas ${category.icon || 'fa-folder'}"></i>
                    ${category.name}
                </td>
                <td>${category.slug || ''}</td>
                <td>${category.taskCount || 0}</td>
                <td>
                    <span class="badge ${category.active ? 'badge-active' : 'badge-inactive'}">
                        ${category.active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="editCategory('${category._id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteCategory('${category._id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

// Setup task creation wizard
function setupWizard() {
    // Initialize step indicators
    updateWizardStep(1);
    
    // Add step click handlers
    document.querySelectorAll('.step-indicator').forEach(step => {
        step.addEventListener('click', function() {
            const stepNum = parseInt(this.dataset.step);
            if (stepNum <= currentStep + 1 || confirm('Unsaved changes may be lost. Continue?')) {
                changeStep(stepNum - currentStep);
            }
        });
    });
}

// Update wizard step
function updateWizardStep(step) {
    currentStep = step;
    
    // Update step indicators
    document.querySelectorAll('.step-indicator').forEach(el => {
        el.classList.remove('active', 'completed');
        const stepNum = parseInt(el.dataset.step);
        
        if (stepNum === currentStep) {
            el.classList.add('active');
        } else if (stepNum < currentStep) {
            el.classList.add('completed');
        }
    });
    
    // Update progress bar
    const progress = (currentStep / totalSteps) * 100;
    const progressBar = document.getElementById('wizardProgress');
    if (progressBar) progressBar.style.width = `${progress}%`;
    
    // Show/hide navigation buttons
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const submitBtn = document.getElementById('submitBtn');
    
    if (prevBtn) prevBtn.style.display = currentStep === 1 ? 'none' : 'block';
    if (nextBtn) nextBtn.style.display = currentStep === totalSteps ? 'none' : 'block';
    if (submitBtn) submitBtn.style.display = currentStep === totalSteps ? 'block' : 'none';
    
    // Load preview on last step
    if (currentStep === totalSteps) {
        loadTaskPreview();
    }
}

// Change step by direction
function changeStep(direction) {
    const newStep = currentStep + direction;
    
    if (newStep < 1 || newStep > totalSteps) return;
    
    // Validate current step before proceeding
    if (direction > 0 && !validateStep(currentStep)) {
        return;
    }
    
    // Hide all steps
    document.querySelectorAll('.wizard-step').forEach(el => {
        el.classList.remove('active');
    });
    
    // Show new step
    const stepElement = document.getElementById(`step${newStep}`);
    if (stepElement) stepElement.classList.add('active');
    
    updateWizardStep(newStep);
}

// Validate current step
function validateStep(step) {
    switch(step) {
        case 1:
            const title = document.getElementById('taskTitle');
            const category = document.getElementById('taskCategory');
            const description = document.getElementById('taskDescription');
            
            if (!title.value.trim()) {
                showNotification('Please enter task title', 'error');
                title.focus();
                return false;
            }
            
            if (!category.value) {
                showNotification('Please select a category', 'error');
                category.focus();
                return false;
            }
            
            if (!description.value.trim()) {
                showNotification('Please enter task description', 'error');
                description.focus();
                return false;
            }
            break;
            
        case 2:
            const payout = document.getElementById('payoutUSD');
            const reward = document.getElementById('rewardCoins');
            
            if (!payout.value || parseFloat(payout.value) < 0.01) {
                showNotification('Please enter valid payout amount (min $0.01)', 'error');
                payout.focus();
                return false;
            }
            
            if (!reward.value || parseInt(reward.value) < 100) {
                showNotification('Please enter valid reward coins (min 100)', 'error');
                reward.focus();
                return false;
            }
            
            const profit = parseFloat(document.getElementById('profitUSD')?.value || 0);
            if (profit < 0) {
                showNotification('Profit cannot be negative. Adjust reward or payout.', 'error');
                return false;
            }
            break;
            
        case 4:
            if (formFields.length === 0) {
                if (!confirm('No proof fields added. Users will not be able to submit proof. Continue?')) {
                    return false;
                }
            }
            break;
    }
    
    return true;
}

// Add form field to builder
function addFormField() {
    const fieldType = document.getElementById('fieldType')?.value || 'text';
    const fieldLabel = prompt('Enter field label:', '');
    
    if (!fieldLabel) {
        showNotification('Field label is required', 'error');
        return;
    }
    
    const fieldId = 'field_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    
    const field = {
        fieldId: fieldId,
        label: fieldLabel,
        type: fieldType,
        required: true,
        placeholder: `Enter ${fieldLabel.toLowerCase()}`,
        validation: '',
        options: fieldType === 'dropdown' || fieldType === 'radio' || fieldType === 'checkbox' ? ['Option 1', 'Option 2', 'Option 3'] : []
    };
    
    formFields.push(field);
    renderFormFields();
    showNotification('Field added successfully', 'success');
}

// Render form fields in builder
function renderFormFields() {
    const builder = document.getElementById('formBuilder');
    if (!builder) return;
    
    if (formFields.length === 0) {
        builder.innerHTML = `
            <div class="empty-form-builder">
                <i class="fas fa-arrow-up"></i>
                <p>Add your first proof field</p>
                <small class="text-muted">Fields will appear here</small>
            </div>
        `;
        return;
    }
    
    let html = '';
    formFields.forEach((field, index) => {
        html += `
            <div class="form-field-item" data-field-id="${field.fieldId}" draggable="true">
                <div class="field-drag-handle">
                    <i class="fas fa-grip-vertical"></i>
                </div>
                <div class="field-content">
                    <div class="field-header">
                        <strong>${escapeHtml(field.label)}</strong>
                        <span class="field-type-badge">${field.type}</span>
                        ${field.required ? '<span class="required-badge">Required</span>' : ''}
                    </div>
                    <div class="field-preview">
                        ${renderFieldPreview(field)}
                    </div>
                </div>
                <div class="field-actions">
                    <button class="btn-field-edit" onclick="editField('${field.fieldId}')" title="Edit Field">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-field-duplicate" onclick="duplicateField('${field.fieldId}')" title="Duplicate">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button class="btn-field-delete" onclick="removeField('${field.fieldId}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    });
    
    builder.innerHTML = html;
    setupDragDrop();
}

// Render field preview
function renderFieldPreview(field) {
    switch(field.type) {
        case 'text':
        case 'email':
        case 'number':
        case 'url':
            return `<input type="${field.type}" class="form-control form-control-sm" placeholder="${field.placeholder || ''}" disabled>`;
            
        case 'textarea':
            return `<textarea class="form-control form-control-sm" rows="2" placeholder="${field.placeholder || ''}" disabled></textarea>`;
            
        case 'image':
            return `<input type="file" class="form-control form-control-sm" accept="image/*" disabled>`;
            
        case 'file':
            return `<input type="file" class="form-control form-control-sm" disabled>`;
            
        case 'dropdown':
            return `<select class="form-control form-control-sm" disabled>
                        <option>${field.options?.[0] || 'Option 1'}</option>
                    </select>`;
            
        case 'checkbox':
            return `<div class="form-check">
                        <input type="checkbox" class="form-check-input" disabled>
                        <label class="form-check-label">${field.label}</label>
                    </div>`;
            
        case 'radio':
            return `<div class="form-check">
                        <input type="radio" class="form-check-input" disabled>
                        <label class="form-check-label">${field.options?.[0] || 'Option 1'}</label>
                    </div>`;
            
        default:
            return `<input type="text" class="form-control form-control-sm" placeholder="${field.placeholder || ''}" disabled>`;
    }
}

// Edit field
function editField(fieldId) {
    const field = formFields.find(f => f.fieldId === fieldId);
    if (!field) return;
    
    const modal = document.getElementById('fieldEditModal');
    if (!modal) return;
    
    document.getElementById('editFieldId').value = field.fieldId;
    document.getElementById('editFieldLabel').value = field.label || '';
    document.getElementById('editFieldType').value = field.type || 'text';
    document.getElementById('editFieldPlaceholder').value = field.placeholder || '';
    document.getElementById('editFieldRequired').checked = field.required || false;
    document.getElementById('editFieldValidation').value = field.validation || '';
    
    // Show/hide options field
    const optionsGroup = document.getElementById('editFieldOptionsGroup');
    if (optionsGroup) {
        optionsGroup.style.display = 
            field.type === 'dropdown' || field.type === 'radio' || field.type === 'checkbox' 
            ? 'block' : 'none';
        
        if (field.options) {
            document.getElementById('editFieldOptions').value = field.options.join('\n');
        }
    }
    
    modal.classList.add('active');
}

// Save field edits
function saveFieldEdit() {
    const fieldId = document.getElementById('editFieldId').value;
    const field = formFields.find(f => f.fieldId === fieldId);
    
    if (!field) return;
    
    field.label = document.getElementById('editFieldLabel').value;
    field.placeholder = document.getElementById('editFieldPlaceholder').value;
    field.required = document.getElementById('editFieldRequired').checked;
    field.validation = document.getElementById('editFieldValidation').value;
    
    const newType = document.getElementById('editFieldType').value;
    if (newType !== field.type) {
        field.type = newType;
        field.options = ['Option 1', 'Option 2', 'Option 3'];
    }
    
    // Update options for dropdown/radio/checkbox
    if (field.type === 'dropdown' || field.type === 'radio' || field.type === 'checkbox') {
        const optionsText = document.getElementById('editFieldOptions')?.value || '';
        field.options = optionsText.split('\n').filter(opt => opt.trim()).map(opt => opt.trim());
    }
    
    renderFormFields();
    closeFieldEditModal();
    showNotification('Field updated successfully', 'success');
}

// Close field edit modal
function closeFieldEditModal() {
    const modal = document.getElementById('fieldEditModal');
    if (modal) modal.classList.remove('active');
}

// Duplicate field
function duplicateField(fieldId) {
    const field = formFields.find(f => f.fieldId === fieldId);
    if (!field) return;
    
    const newField = {
        ...field,
        fieldId: 'field_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        label: field.label + ' (Copy)'
    };
    
    formFields.push(newField);
    renderFormFields();
    showNotification('Field duplicated successfully', 'success');
}

// Remove field
function removeField(fieldId) {
    if (!confirm('Remove this field?')) return;
    
    formFields = formFields.filter(f => f.fieldId !== fieldId);
    renderFormFields();
    showNotification('Field removed', 'info');
}

// Setup drag and drop for form builder
function setupDragDrop() {
    const builder = document.getElementById('formBuilder');
    if (!builder) return;
    
    let draggedItem = null;
    
    builder.addEventListener('dragstart', function(e) {
        draggedItem = e.target.closest('.form-field-item');
        if (draggedItem) {
            draggedItem.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        }
    });
    
    builder.addEventListener('dragend', function(e) {
        if (draggedItem) {
            draggedItem.classList.remove('dragging');
            draggedItem = null;
        }
    });
    
    builder.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        const afterElement = getDragAfterElement(builder, e.clientY);
        const dragging = document.querySelector('.dragging');
        
        if (afterElement) {
            builder.insertBefore(dragging, afterElement);
        } else {
            builder.appendChild(dragging);
        }
    });
    
    // Update formFields order after drag
    builder.addEventListener('drop', function(e) {
        e.preventDefault();
        
        const newOrder = [];
        builder.querySelectorAll('.form-field-item').forEach(item => {
            const fieldId = item.dataset.fieldId;
            const field = formFields.find(f => f.fieldId === fieldId);
            if (field) newOrder.push(field);
        });
        
        if (newOrder.length === formFields.length) {
            formFields = newOrder;
        }
    });
}

// Get drag after element
function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.form-field-item:not(.dragging)')];
    
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

// Update rewards calculation
function updateRewards() {
    const payout = parseFloat(document.getElementById('payoutUSD')?.value) || 0;
    const coins = parseFloat(document.getElementById('rewardCoins')?.value) || 0;
    
    const rewardUSD = coins / 5000;
    const profit = payout - rewardUSD;
    
    const profitField = document.getElementById('profitUSD');
    if (profitField) profitField.value = profit.toFixed(2);
    
    // Update suggested rewards
    updateSuggestedRewards(payout);
}

// Update suggested rewards based on payout
function updateSuggestedRewards(payout) {
    const container = document.getElementById('suggestedRewards');
    if (!container) return;
    
    const suggestions = [
        { name: 'Conservative', coins: Math.floor(payout * 5000 * 0.6), profit: payout * 0.4 },
        { name: 'Balanced', coins: Math.floor(payout * 5000 * 0.7), profit: payout * 0.3 },
        { name: 'Aggressive', coins: Math.floor(payout * 5000 * 0.8), profit: payout * 0.2 },
        { name: 'High Volume', coins: Math.floor(payout * 5000 * 0.9), profit: payout * 0.1 }
    ];
    
    let html = '';
    suggestions.forEach(suggestion => {
        html += `
            <button type="button" class="suggested-reward-btn" onclick="setReward(${suggestion.coins})">
                <strong>${suggestion.name}</strong>
                <span>${suggestion.coins.toLocaleString()} coins</span>
                <small>Profit: $${suggestion.profit.toFixed(2)}</small>
            </button>
        `;
    });
    
    container.innerHTML = html;
}

// Set reward from suggestion
function setReward(coins) {
    const rewardInput = document.getElementById('rewardCoins');
    if (rewardInput) {
        rewardInput.value = coins;
        updateRewards();
    }
}

// Load task preview
function loadTaskPreview() {
    const preview = document.getElementById('taskPreview');
    if (!preview) return;
    
    const title = document.getElementById('taskTitle')?.value || 'Task Title';
    const category = document.getElementById('taskCategory')?.value || 'other';
    const description = document.getElementById('taskDescription')?.value || 'Task description...';
    const payout = parseFloat(document.getElementById('payoutUSD')?.value) || 0;
    const coins = parseFloat(document.getElementById('rewardCoins')?.value) || 0;
    const profit = parseFloat(document.getElementById('profitUSD')?.value) || 0;
    
    let instructions = [];
    const instructionsField = document.getElementById('taskInstructions');
    if (instructionsField && instructionsField.value) {
        instructions = instructionsField.value.split('\n').filter(i => i.trim());
    }
    
    preview.innerHTML = `
        <div class="task-preview-header">
            <h4>${escapeHtml(title)}</h4>
            <span class="badge bg-success">Preview Mode</span>
        </div>
        
        <div class="task-preview-meta">
            <span class="meta-item">
                <i class="fas fa-coins"></i>
                ${coins.toLocaleString()} coins (≈ $${(coins/5000).toFixed(2)})
            </span>
            <span class="meta-item">
                <i class="fas fa-tag"></i>
                ${category.replace('_', ' ')}
            </span>
            <span class="meta-item">
                <i class="fas fa-chart-line"></i>
                Your Profit: $${profit.toFixed(2)}
            </span>
        </div>
        
        <div class="task-preview-description">
            <h5>Description</h5>
            <p>${escapeHtml(description)}</p>
        </div>
        
        ${instructions.length > 0 ? `
            <div class="task-preview-instructions">
                <h5>Instructions</h5>
                <ol>
                    ${instructions.map(i => `<li>${escapeHtml(i)}</li>`).join('')}
                </ol>
            </div>
        ` : ''}
        
        <div class="task-preview-proof">
            <h5>Proof Form</h5>
            ${formFields.length > 0 ? 
                formFields.map(f => `
                    <div class="preview-field">
                        <label>${escapeHtml(f.label)} ${f.required ? '<span class="text-danger">*</span>' : ''}</label>
                        ${renderFieldPreview(f)}
                    </div>
                `).join('') 
                : '<p class="text-muted">No proof fields configured</p>'
            }
        </div>
        
        <div class="task-preview-footer">
            <button class="btn btn-success" disabled>
                <i class="fas fa-play"></i> Start Task
            </button>
            <span class="text-muted ms-2">Preview mode - buttons disabled</span>
        </div>
    `;
}

// Save task
async function saveTask() {
    if (!validateStep(1) || !validateStep(2)) {
        showNotification('Please complete all required fields', 'error');
        return;
    }
    
    const taskData = {
        title: document.getElementById('taskTitle')?.value || '',
        category: document.getElementById('taskCategory')?.value || '',
        description: document.getElementById('taskDescription')?.value || '',
        instructions: document.getElementById('taskInstructions')?.value.split('\n').filter(i => i.trim()) || [],
        
        payoutUSD: parseFloat(document.getElementById('payoutUSD')?.value) || 0,
        rewardCoins: parseInt(document.getElementById('rewardCoins')?.value) || 0,
        
        minAccountAge: parseInt(document.getElementById('minAccountAge')?.value) || 0,
        minGamesPlayed: parseInt(document.getElementById('minGamesPlayed')?.value) || 0,
        minReferrals: parseInt(document.getElementById('minReferrals')?.value) || 0,
        minLoginStreak: parseInt(document.getElementById('minLoginStreak')?.value) || 0,
        
        perUserLimit: parseInt(document.getElementById('perUserLimit')?.value) || 1,
        userCooldown: parseInt(document.getElementById('userCooldown')?.value) || 24,
        totalSlots: parseInt(document.getElementById('totalSlots')?.value) || 100,
        dailyLimit: parseInt(document.getElementById('dailyLimit')?.value) || 0,
        
        startDate: document.getElementById('startDate')?.value || null,
        endDate: document.getElementById('endDate')?.value || null,
        
        verificationType: document.getElementById('verificationType')?.value || 'manual',
        autoVerifyKeywords: document.getElementById('autoVerifyKeywords')?.value.split(',').map(k => k.trim()).filter(k => k) || [],
        requireAdminApproval: document.getElementById('requireAdminApproval')?.checked || false,
        verificationTime: parseInt(document.getElementById('verificationTime')?.value) || 24,
        
        countries: Array.from(document.getElementById('countries')?.selectedOptions || []).map(o => o.value) || ['WW'],
        countriesBlacklist: Array.from(document.getElementById('countriesBlacklist')?.selectedOptions || []).map(o => o.value) || [],
        
        proofFormFields: formFields,
        
        status: document.getElementById('status')?.value || 'draft'
    };
    
    try {
        const token = localStorage.getItem('token') || getAuthToken();
        const url = currentTaskId 
            ? `/api/admin/custom-tasks/${currentTaskId}`
            : '/api/admin/custom-tasks';
        const method = currentTaskId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(taskData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification(`Task ${currentTaskId ? 'updated' : 'created'} successfully!`, 'success');
            closeTaskModal();
            loadTasks();
            loadStats();
        } else {
            showNotification(data.message || 'Failed to save task', 'error');
        }
    } catch (error) {
        console.error('Save task error:', error);
        showNotification('Failed to save task', 'error');
    }
}

// Edit task
async function editTask(taskId) {
    try {
        const token = localStorage.getItem('token') || getAuthToken();
        const response = await fetch(`/api/custom-tasks/${taskId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            const task = data.task;
            currentTaskId = task._id;
            
            // Populate form fields
            document.getElementById('taskTitle').value = task.title || '';
            document.getElementById('taskCategory').value = task.category || '';
            document.getElementById('taskDescription').value = task.description || '';
            document.getElementById('taskInstructions').value = Array.isArray(task.instructions) ? task.instructions.join('\n') : task.instructions || '';
            
            document.getElementById('payoutUSD').value = task.payoutUSD || 0;
            document.getElementById('rewardCoins').value = task.rewardCoins || 0;
            
            document.getElementById('minAccountAge').value = task.minAccountAge || 0;
            document.getElementById('minGamesPlayed').value = task.minGamesPlayed || 0;
            document.getElementById('minReferrals').value = task.minReferrals || 0;
            document.getElementById('minLoginStreak').value = task.minLoginStreak || 0;
            
            document.getElementById('perUserLimit').value = task.perUserLimit || 1;
            document.getElementById('userCooldown').value = task.userCooldown || 24;
            document.getElementById('totalSlots').value = task.totalSlots || 100;
            document.getElementById('dailyLimit').value = task.dailyLimit || 0;
            
            if (task.startDate) {
                document.getElementById('startDate').value = task.startDate.substring(0, 16);
            }
            if (task.endDate) {
                document.getElementById('endDate').value = task.endDate.substring(0, 16);
            }
            
            document.getElementById('verificationType').value = task.verificationType || 'manual';
            document.getElementById('autoVerifyKeywords').value = Array.isArray(task.autoVerifyKeywords) ? task.autoVerifyKeywords.join(', ') : task.autoVerifyKeywords || '';
            document.getElementById('requireAdminApproval').checked = task.requireAdminApproval !== false;
            document.getElementById('verificationTime').value = task.verificationTime || 24;
            
            // Set countries
            if (task.countries) {
                const countriesSelect = document.getElementById('countries');
                Array.from(countriesSelect.options).forEach(option => {
                    option.selected = task.countries.includes(option.value);
                });
            }
            
            // Set blacklist
            if (task.countriesBlacklist) {
                const blacklistSelect = document.getElementById('countriesBlacklist');
                Array.from(blacklistSelect.options).forEach(option => {
                    option.selected = task.countriesBlacklist.includes(option.value);
                });
            }
            
            document.getElementById('status').value = task.status || 'draft';
            
            // Load proof form fields
            if (task.proofFormFields) {
                formFields = task.proofFormFields;
                renderFormFields();
            }
            
            // Calculate profit
            updateRewards();
            
            // Open modal and go to first step
            document.getElementById('modalTitle').textContent = 'Edit Task';
            document.getElementById('taskModal').classList.add('active');
            currentStep = 1;
            updateWizardStep(1);
            
            // Show first step
            document.querySelectorAll('.wizard-step').forEach(el => el.classList.remove('active'));
            document.getElementById('step1').classList.add('active');
        }
    } catch (error) {
        console.error('Edit task error:', error);
        showNotification('Failed to load task details', 'error');
    }
}

// Duplicate task
async function duplicateTask(taskId) {
    if (!confirm('Duplicate this task?')) return;
    
    try {
        const token = localStorage.getItem('token') || getAuthToken();
        const response = await fetch(`/api/admin/custom-tasks/${taskId}/duplicate`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Task duplicated successfully!', 'success');
            loadTasks();
        } else {
            showNotification(data.message || 'Failed to duplicate task', 'error');
        }
    } catch (error) {
        console.error('Duplicate task error:', error);
        showNotification('Failed to duplicate task', 'error');
    }
}

// Delete task
async function deleteTask(taskId) {
    if (!confirm('Are you sure you want to delete this task? This action cannot be undone.')) return;
    
    try {
        const token = localStorage.getItem('token') || getAuthToken();
        const response = await fetch(`/api/admin/custom-tasks/${taskId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Task deleted successfully!', 'success');
            loadTasks();
            loadStats();
        } else {
            showNotification(data.message || 'Failed to delete task', 'error');
        }
    } catch (error) {
        console.error('Delete task error:', error);
        showNotification('Failed to delete task', 'error');
    }
}

// Preview task
function previewTask(taskId) {
    window.open(`/preview/task/${taskId}`, '_blank');
}

// Create new category
async function createCategory() {
    const name = prompt('Enter category name:');
    if (!name) return;
    
    const icon = prompt('Enter Font Awesome icon name (e.g., fa-bitcoin):', 'fa-folder');
    const description = prompt('Enter category description (optional):', '');
    
    try {
        const token = localStorage.getItem('token') || getAuthToken();
        const response = await fetch('/api/admin/custom-tasks/categories', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                name: name,
                icon: icon || 'fa-folder',
                description: description,
                active: true,
                sortOrder: categories.length + 1
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Category created successfully!', 'success');
            loadCategories();
        } else {
            showNotification(data.message || 'Failed to create category', 'error');
        }
    } catch (error) {
        console.error('Create category error:', error);
        showNotification('Failed to create category', 'error');
    }
}

// Edit category
async function editCategory(categoryId) {
    const category = categories.find(c => c._id === categoryId);
    if (!category) return;
    
    const newName = prompt('Edit category name:', category.name);
    if (!newName) return;
    
    const newIcon = prompt('Edit icon:', category.icon || 'fa-folder');
    const newDescription = prompt('Edit description:', category.description || '');
    
    try {
        const token = localStorage.getItem('token') || getAuthToken();
        const response = await fetch(`/api/admin/custom-tasks/categories/${categoryId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                name: newName,
                icon: newIcon || 'fa-folder',
                description: newDescription,
                active: category.active
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Category updated successfully!', 'success');
            loadCategories();
        } else {
            showNotification(data.message || 'Failed to update category', 'error');
        }
    } catch (error) {
        console.error('Edit category error:', error);
        showNotification('Failed to update category', 'error');
    }
}

// Delete category
async function deleteCategory(categoryId) {
    if (!confirm('Are you sure you want to delete this category? Tasks in this category will be uncategorized.')) return;
    
    try {
        const token = localStorage.getItem('token') || getAuthToken();
        const response = await fetch(`/api/admin/custom-tasks/categories/${categoryId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Category deleted successfully!', 'success');
            loadCategories();
        } else {
            showNotification(data.message || 'Failed to delete category', 'error');
        }
    } catch (error) {
        console.error('Delete category error:', error);
        showNotification('Failed to delete category', 'error');
    }
}

// Bulk actions
function toggleSelectAll() {
    const checkboxes = document.querySelectorAll('.task-checkbox');
    const selectAll = document.getElementById('selectAll');
    
    checkboxes.forEach(cb => {
        cb.checked = selectAll.checked;
    });
    
    updateBulkActions();
}

function updateBulkActions() {
    const selected = document.querySelectorAll('.task-checkbox:checked').length;
    const counter = document.getElementById('selectedCount');
    if (counter) counter.textContent = `${selected} selected`;
}

async function bulkDelete() {
    const selected = Array.from(document.querySelectorAll('.task-checkbox:checked')).map(cb => cb.value);
    
    if (selected.length === 0) {
        showNotification('No tasks selected', 'error');
        return;
    }
    
    if (!confirm(`Delete ${selected.length} tasks? This action cannot be undone.`)) return;
    
    let success = 0;
    let failed = 0;
    
    for (const taskId of selected) {
        try {
            const token = localStorage.getItem('token') || getAuthToken();
            const response = await fetch(`/api/admin/custom-tasks/${taskId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            const data = await response.json();
            if (data.success) success++;
            else failed++;
        } catch {
            failed++;
        }
    }
    
    showNotification(`${success} tasks deleted, ${failed} failed`, success > 0 ? 'success' : 'error');
    loadTasks();
    loadStats();
}

async function bulkStatus(status) {
    const selected = Array.from(document.querySelectorAll('.task-checkbox:checked')).map(cb => cb.value);
    
    if (selected.length === 0) {
        showNotification('No tasks selected', 'error');
        return;
    }
    
    if (!confirm(`Change status of ${selected.length} tasks to ${status}?`)) return;
    
    let success = 0;
    let failed = 0;
    
    for (const taskId of selected) {
        try {
            const token = localStorage.getItem('token') || getAuthToken();
            const response = await fetch(`/api/admin/custom-tasks/${taskId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status: status })
            });
            
            const data = await response.json();
            if (data.success) success++;
            else failed++;
        } catch {
            failed++;
        }
    }
    
    showNotification(`${success} tasks updated, ${failed} failed`, success > 0 ? 'success' : 'error');
    loadTasks();
}

// Export functions
function exportTasks(format) {
    const url = `/api/admin/custom-tasks/export?format=${format}`;
    window.open(url, '_blank');
}

// Setup event listeners
function setupEventListeners() {
    // Reward calculation listeners
    const payoutInput = document.getElementById('payoutUSD');
    const rewardInput = document.getElementById('rewardCoins');
    
    if (payoutInput) payoutInput.addEventListener('keyup', updateRewards);
    if (rewardInput) rewardInput.addEventListener('keyup', updateRewards);
    
    // Country targeting
    const countryTargeting = document.getElementById('countryTargeting');
    if (countryTargeting) {
        countryTargeting.addEventListener('change', function() {
            const targetGroup = document.getElementById('targetCountriesGroup');
            if (targetGroup) {
                targetGroup.style.display = this.value === 'specific' ? 'block' : 'none';
            }
        });
    }
    
    // Field type change
    const fieldType = document.getElementById('fieldType');
    if (fieldType) {
        fieldType.addEventListener('change', function() {
            // Update field options based on type
        });
    }
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 5000);
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
window.loadTasks = loadTasks;
window.editTask = editTask;
window.duplicateTask = duplicateTask;
window.deleteTask = deleteTask;
window.previewTask = previewTask;
window.createCategory = createCategory;
window.editCategory = editCategory;
window.deleteCategory = deleteCategory;
window.addFormField = addFormField;
window.removeField = removeField;
window.duplicateField = duplicateField;
window.editField = editField;
window.saveFieldEdit = saveFieldEdit;
window.closeFieldEditModal = closeFieldEditModal;
window.updateRewards = updateRewards;
window.setReward = setReward;
window.changeStep = changeStep;
window.saveTask = saveTask;
window.toggleSelectAll = toggleSelectAll;
window.bulkDelete = bulkDelete;
window.bulkStatus = bulkStatus;
window.exportTasks = exportTasks;