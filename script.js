// ============================================================
// ROADMAP EDITOR - Phase 7
// ============================================================

// ===== MULTI-ROADMAP MANAGER =====
const STORAGE_PREFIX = 'roadmapEditor_v3_';
const META_KEY = 'roadmapEditor_v3_meta';

function getMeta() {
    try { return JSON.parse(localStorage.getItem(META_KEY)) || []; } catch { return []; }
}

function saveMeta(meta) {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
}

function saveRoadmap(id, data) {
    localStorage.setItem(STORAGE_PREFIX + id, JSON.stringify(data));
}

function loadRoadmap(id) {
    try { return JSON.parse(localStorage.getItem(STORAGE_PREFIX + id)); } catch { return null; }
}

function deleteRoadmapStorage(id) {
    localStorage.removeItem(STORAGE_PREFIX + id);
}

function genId() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ===== DEFAULT DATA =====
function getDefaultData() {
    return {
        nodes: [],
        connections: [],
        lineStyle: 'curved-dash'
    };
}

// ===== STATE =====
let data = { nodes: [], connections: [], lineStyle: 'curved-dash' };
let currentRoadmapId = null;
let selectedId = null;
let selectedConnId = null;
let isLocked = false;
let connectMode = false;
let connectSource = null;
let history = [];
let panzoomInstance = null;
let currentScale = 1;

// ===== DOM =====
const canvasWrapper = document.getElementById('canvasWrapper');
const canvasEl = document.getElementById('canvas');
const nodesEl = document.getElementById('nodes');
const linesEl = document.getElementById('lines');
const btnAddMain = document.getElementById('btnAddMain');
const btnAddBranch = document.getElementById('btnAddBranch');
const btnConnect = document.getElementById('btnConnect');
const btnEdit = document.getElementById('btnEdit');
const btnDelete = document.getElementById('btnDelete');
const btnUndo = document.getElementById('btnUndo');
const btnClear = document.getElementById('btnClear');
const btnLock = document.getElementById('btnLock');
const lockText = document.getElementById('lockText');
const lineStyleSelect = document.getElementById('lineStyleSelect');
const btnExportToggle = document.getElementById('btnExportToggle');
const exportMenu = document.getElementById('exportMenu');
const btnExportJSON = document.getElementById('btnExportJSON');
const btnExportHTML = document.getElementById('btnExportHTML');
const btnExportHTMLTransparent = document.getElementById('btnExportHTMLTransparent');
const btnImport = document.getElementById('btnImport');
const importFile = document.getElementById('importFile');
const btnZoomIn = document.getElementById('btnZoomIn');
const btnZoomOut = document.getElementById('btnZoomOut');
const btnZoomReset = document.getElementById('btnZoomReset');
const connectBanner = document.getElementById('connectBanner');
const cancelConnectBtn = document.getElementById('cancelConnect');
const roadmapList = document.getElementById('roadmapList');
const btnNewRoadmap = document.getElementById('btnNewRoadmap');
// Modals
const editModal = document.getElementById('editModal');
const editNodeIdInput = document.getElementById('editNodeId');
const editTitleInput = document.getElementById('editTitle');
const editDefInput = document.getElementById('editDefinition');
const editYtInput = document.getElementById('editYtLink');
const editColorInput = document.getElementById('editColor');
const editShapeInput = document.getElementById('editShape');
const editBorderInput = document.getElementById('editBorder');
const modalSave = document.getElementById('modalSave');
const modalCancel = document.getElementById('modalCancel');
const modalClose = document.getElementById('modalClose');
const detailPanel = document.getElementById('detailPanel');
const detailTitle = document.getElementById('detailTitle');
const detailVideo = document.getElementById('detailVideo');
const detailVideoPlaceholder = document.getElementById('detailVideoPlaceholder');
const detailIframe = document.getElementById('detailIframe');
const detailContent = document.getElementById('detailContent');
const closeDetailBtn = document.getElementById('closeDetailBtn');
const welcomeModal = document.getElementById('welcomeModal');
const btnWelcomeClose = document.getElementById('btnWelcomeClose');
const dontShowAgain = document.getElementById('dontShowAgain');
const renameModal = document.getElementById('renameModal');
const renameInput = document.getElementById('renameInput');
const renameSave = document.getElementById('renameSave');
const renameCancel = document.getElementById('renameCancel');
const renameClose = document.getElementById('renameClose');

// ===== HELPERS =====
function findNode(id) { return data.nodes.find(n => n.id === id); }
function getDescendants(id) {
    const children = data.nodes.filter(n => n.parentId === id);
    let all = [...children];
    children.forEach(c => { all = all.concat(getDescendants(c.id)); });
    return all;
}
function getDefaultStyle(type) {
    return type === 'main'
        ? { bg: '#3b82f6', textColor: '#ffffff', shape: 'rounded', border: 'solid' }
        : { bg: '#ffffff', textColor: '#1a1a2e', shape: 'rounded', border: 'solid' };
}
function isLightColor(hex) {
    if (!hex || hex.length < 7) return true;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 155;
}
function getEmbedUrl(url) {
    if (!url) return '';
    if (url.includes('/embed/')) return url;
    let vid = '';
    if (url.includes('v=')) { vid = url.split('v=')[1].split('&')[0].split('#')[0]; }
    else if (url.includes('youtu.be/')) { vid = url.split('youtu.be/')[1].split('?')[0].split('#')[0]; }
    else if (url.includes('/shorts/')) { vid = url.split('/shorts/')[1].split('?')[0]; }
    else if (url.includes('/live/')) { vid = url.split('/live/')[1].split('?')[0]; }
    return vid ? 'https://www.youtube.com/embed/' + vid : url;
}

// ===== TOAST NOTIFICATIONS =====
const toastContainer = document.getElementById('toastContainer');
function toast(msg, type) {
    type = type || 'info';
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.textContent = msg;
    toastContainer.appendChild(t);
    setTimeout(() => { if (t.parentNode) t.remove(); }, 2200);
}

// ===== STATUS BAR =====
const statusBarEl = document.getElementById('statusBar');
function updateStatusBar() {
    const nc = data.nodes ? data.nodes.length : 0;
    const lc = (data.connections ? data.connections.length : 0) + data.nodes.filter(n => n.parentId).length;
    const sel = multiSelected ? multiSelected.length : 0;
    let txt = 'Nodes: ' + nc + ' \u00b7 Lines: ' + lc;
    if (sel > 0) txt += ' \u00b7 Selected: ' + sel;
    if (statusBarEl) statusBarEl.textContent = txt;
}

// ===== UNDO / REDO =====
let redoStack = [];
function pushHistory() {
    history.push(JSON.stringify(data));
    if (history.length > 50) history.shift();
    redoStack = []; // clear redo on any new action
}
function undo() {
    if (!history.length) { toast('Nothing to undo', 'warn'); return; }
    redoStack.push(JSON.stringify(data));
    if (redoStack.length > 50) redoStack.shift();
    const prev = JSON.parse(history.pop());
    data = prev;
    save(); render();
    toast('Undo', 'info');
}
function redo() {
    if (!redoStack.length) { toast('Nothing to redo', 'warn'); return; }
    history.push(JSON.stringify(data));
    const next = JSON.parse(redoStack.pop());
    data = next;
    save(); render();
    toast('Redo', 'info');
}

// ===== SAVE/LOAD =====
function save() {
    if (currentRoadmapId) saveRoadmap(currentRoadmapId, data);
}
function load(id) {
    try {
        const saved = loadRoadmap(id);
        data = saved || getDefaultData();
    } catch (e) {
        console.warn('Failed to load roadmap, using defaults:', e);
        data = getDefaultData();
    }
    // Validate & ensure required fields
    if (!data.lineStyle) data.lineStyle = 'curved-dash';
    if (!Array.isArray(data.connections)) data.connections = [];
    if (!Array.isArray(data.nodes)) data.nodes = [];
    // Clean orphaned connections
    const nodeIds = new Set(data.nodes.map(n => n.id));
    data.connections = data.connections.filter(c => nodeIds.has(c.from) && nodeIds.has(c.to));
    data.nodes.forEach(n => { if (n.parentId && !nodeIds.has(n.parentId)) n.parentId = null; });
    lineStyleSelect.value = data.lineStyle;
}

// ===== SIDEBAR / ROADMAP MANAGER =====
function renderSidebar() {
    const meta = getMeta();
    roadmapList.innerHTML = '';
    if (!meta.length) {
        roadmapList.innerHTML = '<div style="padding:16px;font-size:12px;color:#9ca3af;text-align:center;">No roadmaps yet.<br>Click + New to start.</div>';
        return;
    }
    meta.forEach(rm => {
        const item = document.createElement('div');
        item.className = 'roadmap-item' + (rm.id === currentRoadmapId ? ' active' : '');
        item.innerHTML = `
            <span class="roadmap-item-name" title="${rm.name}">${rm.name}</span>
            <div class="roadmap-actions">
                <button class="rename-btn" data-id="${rm.id}" title="Rename">✏️</button>
                <button class="del-btn" data-id="${rm.id}" title="Delete">🗑️</button>
            </div>`;
        item.addEventListener('click', (e) => {
            if (e.target.classList.contains('rename-btn') || e.target.classList.contains('del-btn')) return;
            switchRoadmap(rm.id);
        });
        item.querySelector('.rename-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            openRenameModal(rm.id, rm.name);
        });
        item.querySelector('.del-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteRoadmapEntry(rm.id);
        });
        roadmapList.appendChild(item);
    });
}

function switchRoadmap(id) {
    if (currentRoadmapId === id) return;
    save(); // save current first
    currentRoadmapId = id;
    selectedId = null; selectedConnId = null;
    history = [];
    load(id);
    renderSidebar();
    render();
    centerView();
}

function createNewRoadmap(name) {
    const id = genId();
    const meta = getMeta();
    meta.push({ id, name: name || 'New Roadmap' });
    saveMeta(meta);
    saveRoadmap(id, getDefaultData());
    switchRoadmap(id);
}

function deleteRoadmapEntry(id) {
    const meta = getMeta().filter(rm => rm.id !== id);
    saveMeta(meta);
    deleteRoadmapStorage(id);
    if (currentRoadmapId === id) {
        // Switch to first available or create a new one
        if (meta.length) { switchRoadmap(meta[0].id); }
        else { createNewRoadmap('My Roadmap'); }
    } else {
        renderSidebar();
    }
}

function initFirstRoadmap() {
    let meta = getMeta();
    if (!meta.length) {
        const id = genId();
        meta = [{ id, name: 'Python Roadmap' }];
        saveMeta(meta);
        saveRoadmap(id, getDefaultData());
    }
    currentRoadmapId = meta[0].id;
    load(currentRoadmapId);
    renderSidebar();
}

btnNewRoadmap.addEventListener('click', () => {
    createNewRoadmap('New Roadmap');
});

// ===== RENAME MODAL =====
let renamingId = null;
function openRenameModal(id, name) {
    renamingId = id;
    renameInput.value = name;
    renameModal.classList.remove('hidden');
    renameInput.focus(); renameInput.select();
}
function closeRenameModal() { renameModal.classList.add('hidden'); renamingId = null; }
renameSave.addEventListener('click', () => {
    if (!renamingId) return;
    const meta = getMeta();
    const rm = meta.find(r => r.id === renamingId);
    if (rm) { rm.name = renameInput.value.trim() || 'Unnamed'; saveMeta(meta); renderSidebar(); }
    closeRenameModal();
});
[renameCancel, renameClose].forEach(b => b.addEventListener('click', closeRenameModal));

// ===== WELCOME MODAL =====
function maybeShowWelcome() {
    if (!localStorage.getItem('roadmapWelcomeSeen')) {
        welcomeModal.classList.remove('hidden');
    }
}
btnWelcomeClose.addEventListener('click', () => {
    if (dontShowAgain.checked) localStorage.setItem('roadmapWelcomeSeen', '1');
    welcomeModal.classList.add('hidden');
});

// ===== PANZOOM =====
function initPanzoom() {
    panzoomInstance = Panzoom(canvasEl, {
        maxScale: 3,
        minScale: 0.2,
        step: 0.1,
        canvas: true,
        cursor: 'default',
        contain: 'outside',
        excludeClass: 'node',
    });

    canvasWrapper.addEventListener('wheel', (e) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            panzoomInstance.zoomWithWheel(e);
        } else {
            // Pan with regular scroll
            const { x, y } = panzoomInstance.getPan();
            panzoomInstance.pan(x - e.deltaX, y - e.deltaY);
        }
        updateZoomLabel();
    }, { passive: false });

    canvasEl.addEventListener('panzoomchange', () => {
        currentScale = panzoomInstance.getScale();
        updateZoomLabel();
    });
}

function updateZoomLabel() {
    const pct = Math.round(panzoomInstance.getScale() * 100);
    btnZoomReset.textContent = pct + '%';
}

function centerView() {
    if (!panzoomInstance) return;
    // Find the bbox of nodes to center on them
    if (!data.nodes.length) { panzoomInstance.reset(); return; }
    const xs = data.nodes.map(n => n.x);
    const ys = data.nodes.map(n => n.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs) + 180;
    const minY = Math.min(...ys), maxY = Math.max(...ys) + 50;
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const scale = 1;
    const ww = canvasWrapper.clientWidth, wh = canvasWrapper.clientHeight;
    const x = ww / 2 - cx * scale;
    const y = wh / 2 - cy * scale;
    panzoomInstance.zoom(scale, { animate: false });
    panzoomInstance.pan(x, y, { animate: false });
    updateZoomLabel();
}

btnZoomIn.addEventListener('click', () => { panzoomInstance.zoomIn(); updateZoomLabel(); });
btnZoomOut.addEventListener('click', () => { panzoomInstance.zoomOut(); updateZoomLabel(); });
btnZoomReset.addEventListener('click', () => { panzoomInstance.reset(); updateZoomLabel(); });

// ===== RENDER =====
function render() {
    nodesEl.innerHTML = '';
    data.nodes.forEach(n => {
        const el = document.createElement('div');
        const s = n.style || getDefaultStyle(n.type);
        el.className = 'node';
        if (s.shape && s.shape !== 'rounded') el.classList.add('shape-' + s.shape);
        if (s.border === 'dashed') el.classList.add('border-dashed');
        if (s.border === 'none') el.classList.add('border-none');
        if (n.id === selectedId) el.classList.add('selected');
        if (connectMode && connectSource === n.id) el.classList.add('connect-source');
        if (multiSelected && multiSelected.includes(n.id)) el.classList.add('multi-selected');
        el.dataset.id = n.id;
        el.style.left = n.x + 'px';
        el.style.top = n.y + 'px';
        el.style.backgroundColor = s.bg || '#ffffff';
        el.style.color = s.textColor || '#1a1a2e';
        el.textContent = n.title;

        el.addEventListener('mousedown', e => e.stopPropagation());
        el.addEventListener('click', e => { e.stopPropagation(); if (!isRubberBanding) handleNodeClick(n.id); });
        el.addEventListener('dblclick', e => { e.stopPropagation(); if (!isLocked) { selectNode(n.id); openEditModal(n); } });
        el.addEventListener('contextmenu', e => showNodeContextMenu(e, n.id));
        nodesEl.appendChild(el);
    });

    drawLines();
    setupDrag();
    updateToolbar();
    updateStatusBar();
}

// ===== NODE CLICK =====
function handleNodeClick(id) {
    if (connectMode) { handleConnectClick(id); return; }
    if (isLocked) { openDetailPanel(findNode(id)); return; }
    selectNode(id);
}

// ===== SELECTION =====
function selectNode(id) {
    selectedId = id; selectedConnId = null;
    document.querySelectorAll('.node').forEach(el => el.classList.toggle('selected', el.dataset.id === id));
    updateToolbar();
}
function deselectAll() {
    selectedId = null; selectedConnId = null;
    document.querySelectorAll('.node.selected').forEach(el => el.classList.remove('selected'));
    updateToolbar(); drawLines();
}
function updateToolbar() {
    const has = selectedId !== null || selectedConnId !== null;
    btnAddBranch.disabled = !selectedId;
    btnEdit.disabled = !selectedId;
    btnDelete.disabled = !has;
}

// ===== LINES =====
function getLinePath(x1, y1, x2, y2, style) {
    style = style || data.lineStyle || 'curved-dash';
    if (style === 'curved-dash' || style === 'curved-solid') {
        const my = (y1 + y2) / 2;
        return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`;
    }
    if (style === 'straight-dash' || style === 'straight-solid') {
        return `M ${x1} ${y1} L ${x2} ${y2}`;
    }
    if (style === 'orthogonal') {
        const my = (y1 + y2) / 2;
        return `M ${x1} ${y1} L ${x1} ${my} L ${x2} ${my} L ${x2} ${y2}`;
    }
    return `M ${x1} ${y1} L ${x2} ${y2}`;
}

function drawLines() {
    linesEl.innerHTML = '';
    data.nodes.forEach(n => {
        if (!n.parentId) return;
        const parent = findNode(n.parentId);
        if (!parent) return;
        drawOneLine(parent, n, 'parent:' + n.id, n.id === (selectedConnId?.replace('parent:', '')), n.lineStyle);
    });
    data.connections.forEach(c => {
        const from = findNode(c.from), to = findNode(c.to);
        if (!from || !to) return;
        drawOneLine(from, to, c.id, c.id === selectedConnId, c.style);
    });
}

function drawOneLine(fromNode, toNode, lineId, isSelected, styleOverride) {
    const fromEl = nodesEl.querySelector(`[data-id="${fromNode.id}"]`);
    const toEl = nodesEl.querySelector(`[data-id="${toNode.id}"]`);
    if (!fromEl || !toEl) return;

    const pw = fromEl.offsetWidth, ph = fromEl.offsetHeight;
    const cw = toEl.offsetWidth, ch = toEl.offsetHeight;
    const x1 = fromNode.x + pw / 2, y1 = fromNode.y + ph / 2;
    const x2 = toNode.x + cw / 2, y2 = toNode.y + ch / 2;
    const actualStyle = styleOverride || data.lineStyle || 'curved-dash';
    const d = getLinePath(x1, y1, x2, y2, actualStyle);

    // Invisible hitbox path — used only for isPointInStroke() hit testing
    const hitbox = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    hitbox.setAttribute('d', d);
    hitbox.setAttribute('class', 'connector-line-hitbox');
    hitbox.dataset.lineId = lineId;
    linesEl.appendChild(hitbox);

    // Visible line
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('class', (isSelected ? 'connector-line-selected' : 'connector-line') + ' style-' + actualStyle);
    linesEl.appendChild(path);
}

// ===== LINE HIT-TESTING (works despite SVG pointer-events: none) =====
function getLineIdAtPoint(clientX, clientY) {
    const svg = linesEl;
    const pt = svg.createSVGPoint();
    // Convert client coords to SVG coords accounting for panzoom transforms
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    pt.x = clientX;
    pt.y = clientY;
    const svgPt = pt.matrixTransform(ctm.inverse());

    const hitboxes = svg.querySelectorAll('.connector-line-hitbox');
    for (const hb of hitboxes) {
        try {
            if (hb.isPointInStroke(svgPt)) {
                return hb.dataset.lineId;
            }
        } catch (e) { /* ignore */ }
    }
    return null;
}

// Click on empty canvas area — check if we hit a line
canvasWrapper.addEventListener('click', e => {
    if (e.target.closest('.node') || e.target.closest('.ctx-menu')) return;
    const lineId = getLineIdAtPoint(e.clientX, e.clientY);
    if (lineId) {
        e.stopPropagation();
        selectedConnId = lineId; selectedId = null;
        document.querySelectorAll('.node.selected').forEach(el => el.classList.remove('selected'));
        updateToolbar(); drawLines();
    }
});

// Right-click on empty canvas area — check if we hit a line
canvasWrapper.addEventListener('contextmenu', e => {
    if (e.target.closest('.node') || e.target.closest('.ctx-menu')) return;
    const lineId = getLineIdAtPoint(e.clientX, e.clientY);
    if (lineId) {
        e.preventDefault();
        e.stopPropagation();
        showLineContextMenu(e, lineId);
    }
}, true);

// ===== DRAG =====
function setupDrag() {
    interact('.node').draggable({
        inertia: false,
        listeners: {
            start(event) {
                if (isLocked || connectMode) return;
                event.target.classList.add('dragging');
                const dragId = event.target.dataset.id;
                // If dragging a multi-selected node, move them all
                if (multiSelected.length > 0 && !multiSelected.includes(dragId)) {
                    // Clicking a non-selected node during multi-select clears selection
                    clearMultiSelect();
                }
                selectNode(dragId);
                pushHistory();
            },
            move(event) {
                if (isLocked || connectMode) return;
                const dragId = event.target.dataset.id;
                const n = findNode(dragId);
                if (!n) return;
                let dx = event.dx / currentScale;
                let dy = event.dy / currentScale;
                // Shift = axis lock
                if (event.shiftKey) {
                    if (Math.abs(event.dx) >= Math.abs(event.dy)) dy = 0;
                    else dx = 0;
                }
                // Group drag: move all multi-selected nodes together
                if (multiSelected.length > 1 && multiSelected.includes(dragId)) {
                    multiSelected.forEach(id => {
                        const node = findNode(id);
                        if (!node) return;
                        node.x += dx; node.y += dy;
                        const el = nodesEl.querySelector('[data-id="' + id + '"]');
                        if (el) { el.style.left = node.x + 'px'; el.style.top = node.y + 'px'; }
                    });
                } else {
                    n.x += dx; n.y += dy;
                    event.target.style.left = n.x + 'px';
                    event.target.style.top = n.y + 'px';
                }
                drawLines();
            },
            end(event) {
                event.target.classList.remove('dragging');
                save();
            }
        }
    });
}

// ===== ADD MAIN =====
btnAddMain.addEventListener('click', () => {
    if (isLocked) return;
    pushHistory();
    const pan = panzoomInstance.getPan();
    const scale = panzoomInstance.getScale();
    const cx = (-pan.x + canvasWrapper.clientWidth / 2) / scale;
    const cy = (-pan.y + canvasWrapper.clientHeight / 2) / scale;
    const n = { id: genId(), title: 'New Module', type: 'main', x: cx - 70, y: cy - 20, parentId: null, definition: '', yt_link: '', style: getDefaultStyle('main') };
    data.nodes.push(n);
    save(); render(); selectNode(n.id);
});

// ===== ADD BRANCH =====
btnAddBranch.addEventListener('click', () => {
    if (isLocked || !selectedId) return;
    const parent = findNode(selectedId);
    if (!parent) return;
    pushHistory();
    const n = { id: genId(), title: 'New Topic', type: 'branch', x: parent.x + 40 + Math.random() * 60, y: parent.y + 120, parentId: parent.id, definition: '', yt_link: '', style: getDefaultStyle('branch') };
    data.nodes.push(n);
    save(); render(); selectNode(n.id);
});

// ===== CONNECT MODE =====
btnConnect.addEventListener('click', () => {
    if (isLocked) return;
    connectMode = !connectMode; connectSource = null;
    btnConnect.classList.toggle('active', connectMode);
    document.body.classList.toggle('connect-mode', connectMode);
    connectBanner.classList.toggle('hidden', !connectMode);
    if (!connectMode) render();
});
cancelConnectBtn.addEventListener('click', exitConnectMode);

function exitConnectMode() {
    connectMode = false; connectSource = null;
    btnConnect.classList.remove('active');
    document.body.classList.remove('connect-mode');
    connectBanner.classList.add('hidden');
    render();
}

function handleConnectClick(id) {
    if (!connectSource) {
        connectSource = id;
        document.querySelectorAll('.node').forEach(el => el.classList.toggle('connect-source', el.dataset.id === id));
    } else if (connectSource !== id) {
        const exists = data.connections.some(c => (c.from === connectSource && c.to === id) || (c.from === id && c.to === connectSource));
        if (!exists) {
            pushHistory();
            data.connections.push({ id: genId(), from: connectSource, to: id });
            save();
            toast('Connected!', 'success');
        } else {
            toast('Already connected', 'warn');
        }
        exitConnectMode();
    } else {
        // Self-connect: prevent it
        toast('Cannot connect a node to itself', 'warn');
        connectSource = null;
        render();
    }
}

// ===== CLEAR CANVAS =====
btnClear.addEventListener('click', () => {
    if (isLocked) return;
    if (data.nodes.length === 0 && data.connections.length === 0) {
        toast('Canvas is already empty', 'warn');
        return;
    }
    if (confirm('Are you sure you want to completely clear this canvas? This will remove all nodes and connections.')) {
        pushHistory();
        data.nodes = [];
        data.connections = [];
        clearMultiSelect();
        deselectAll();
        panzoomInstance.reset();
        save();
        render();
        toast('Canvas cleared! (Press Ctrl+Z to undo)', 'success');
    }
});

// ===== DELETE =====
btnDelete.addEventListener('click', () => {
    if (isLocked) return;
    if (selectedConnId) {
        pushHistory();
        if (selectedConnId.startsWith('parent:')) {
            const child = findNode(selectedConnId.replace('parent:', ''));
            if (child) child.parentId = null;
        } else {
            data.connections = data.connections.filter(c => c.id !== selectedConnId);
        }
        selectedConnId = null; save(); render(); return;
    }
    if (!selectedId) return;
    pushHistory();
    const idsToRemove = new Set([selectedId, ...getDescendants(selectedId).map(d => d.id)]);
    data.nodes = data.nodes.filter(n => !idsToRemove.has(n.id));
    data.connections = data.connections.filter(c => !idsToRemove.has(c.from) && !idsToRemove.has(c.to));
    selectedId = null; save(); render();
});

// ===== UNDO =====
btnUndo.addEventListener('click', undo);

// ===== LINE STYLE =====
lineStyleSelect.addEventListener('change', () => {
    pushHistory();
    data.lineStyle = lineStyleSelect.value;
    save(); drawLines();
});

// ===== LOCK =====
btnLock.addEventListener('click', () => {
    isLocked = !isLocked;
    document.body.classList.toggle('locked', isLocked);
    lockText.textContent = isLocked ? 'Unlock' : 'Lock';
    if (isLocked) { deselectAll(); exitConnectMode(); }
    render();
});

// ===== DETAIL PANEL =====
function openDetailPanel(node) {
    if (!node) return;
    detailTitle.textContent = node.title;
    detailContent.innerHTML = node.definition || '<p style="color:#9ca3af">No description yet.</p>';
    if (node.yt_link) {
        detailVideo.classList.remove('hidden');
        document.getElementById('detailYtLink').href = node.yt_link;
    } else { detailVideo.classList.add('hidden'); }
    detailPanel.classList.remove('hidden');
}
closeDetailBtn.addEventListener('click', () => { detailPanel.classList.add('hidden'); });

// ===== EDIT MODAL =====
function openEditModal(node) {
    editNodeIdInput.value = node.id;
    editTitleInput.value = node.title;
    editDefInput.value = node.definition || '';
    editYtInput.value = node.yt_link || '';
    const s = node.style || getDefaultStyle(node.type);
    editColorInput.value = s.bg || '#ffffff';
    editShapeInput.value = s.shape || 'rounded';
    editBorderInput.value = s.border || 'solid';
    editModal.classList.remove('hidden');
    editTitleInput.focus();
}
function closeModal() { editModal.classList.add('hidden'); }
btnEdit.addEventListener('click', () => { if (!selectedId || isLocked) return; openEditModal(findNode(selectedId)); });
[modalCancel, modalClose].forEach(b => b.addEventListener('click', closeModal));
modalSave.addEventListener('click', () => {
    const n = findNode(editNodeIdInput.value);
    if (!n) return;
    pushHistory();
    n.title = editTitleInput.value.trim() || 'Untitled';
    n.definition = editDefInput.value;
    n.yt_link = editYtInput.value;
    if (!n.style) n.style = getDefaultStyle(n.type);
    n.style.bg = editColorInput.value;
    n.style.shape = editShapeInput.value;
    n.style.border = editBorderInput.value;
    n.style.textColor = isLightColor(n.style.bg) ? '#1a1a2e' : '#ffffff';
    save(); closeModal(); render(); selectNode(n.id);
});

// ===== EXPORT JSON =====
btnExportJSON.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'roadmap.json'; a.click();
    URL.revokeObjectURL(url);
    exportMenu.classList.remove('show');
});

// ===== EXPORT HTML =====
btnExportHTML.addEventListener('click', () => { doExportHTML('#ffffff'); exportMenu.classList.remove('show'); });
btnExportHTMLTransparent.addEventListener('click', () => { doExportHTML('transparent'); exportMenu.classList.remove('show'); });

function doExportHTML(bgColor) {
    const html = generateStaticHTML(bgColor);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'roadmap.html'; a.click();
    URL.revokeObjectURL(url);
}

function generateStaticHTML(bgColor) {
    bgColor = bgColor || '#ffffff';
    const nodeSizes = {};
    data.nodes.forEach(n => {
        const el = nodesEl.querySelector(`[data-id="${n.id}"]`);
        nodeSizes[n.id] = el ? { w: el.offsetWidth, h: el.offsetHeight } : { w: 150, h: 44 };
    });

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    data.nodes.forEach(n => {
        let sz = nodeSizes[n.id];
        if (!sz || sz.w === 0 || sz.h === 0) sz = { w: 150, h: 44 };
        minX = Math.min(minX, n.x);
        minY = Math.min(minY, n.y);
        maxX = Math.max(maxX, n.x + sz.w);
        maxY = Math.max(maxY, n.y + sz.h);
    });

    // Default values if canvas is empty
    if (minX === Infinity) { minX = 0; minY = 0; maxX = 800; maxY = 600; }
    const pad = 60, w = maxX - minX + pad * 2, h = maxY - minY + pad * 2;
    const dx = minX - pad;
    const dy = minY - pad;

    function lineD(from, to, styleOverride) {
        let fw = nodeSizes[from.id]?.w; if (!fw) fw = 150;
        let fh = nodeSizes[from.id]?.h; if (!fh) fh = 44;
        let tw = nodeSizes[to.id]?.w; if (!tw) tw = 150;
        let th = nodeSizes[to.id]?.h; if (!th) th = 44;
        return getLinePath((from.x - dx) + fw / 2, (from.y - dy) + fh / 2, (to.x - dx) + tw / 2, (to.y - dy) + th / 2, styleOverride || data.lineStyle);
    }

    function getDashStyle(s) {
        s = s || data.lineStyle || 'curved-dash';
        if (s.includes('solid') || s === 'orthogonal') return 'none';
        if (s.includes('straight-dash')) return '6 4';
        return '8 5';
    }

    let svgPaths = '';
    data.nodes.forEach(n => {
        if (!n.parentId) return;
        const p = findNode(n.parentId);
        if (!p) return;
        svgPaths += `<path d="${lineD(p, n, n.lineStyle)}" stroke="#94a3b8" stroke-width="2" stroke-dasharray="${getDashStyle(n.lineStyle)}" fill="none"/>\n`;
    });
    data.connections.forEach(c => {
        const f = findNode(c.from), t = findNode(c.to);
        if (!f || !t) return;
        svgPaths += `<path d="${lineD(f, t, c.style)}" stroke="#94a3b8" stroke-width="2" stroke-dasharray="${getDashStyle(c.style)}" fill="none"/>\n`;
    });

    const exportNodes = JSON.stringify(data.nodes.map(n => ({ id: n.id, title: n.title, definition: n.definition || '', yt_link: n.yt_link || '' }))).replace(/<\/script>/gi, '<\\/script>');

    let nodeDivs = '';
    data.nodes.forEach(n => {
        const s = n.style || getDefaultStyle(n.type);
        let br = '10px'; if (s.shape === 'pill') br = '100px'; if (s.shape === 'square') br = '4px';
        let border = s.border === 'none' ? 'none' : `2px ${s.border || 'solid'} rgba(0,0,0,0.12)`;
        nodeDivs += `<div class="rm-node" data-id="${n.id}" style="position:absolute;left:${n.x - dx}px;top:${n.y - dy}px;min-width:120px;max-width:240px;padding:11px 18px;border-radius:${br};font-size:13.5px;font-weight:600;text-align:center;background:${s.bg};color:${s.textColor};border:${border};box-shadow:0 1px 3px rgba(0,0,0,0.08);white-space:nowrap;cursor:pointer;">${n.title}</div>\n`;
    });

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Roadmap</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:${bgColor};font-family:Inter,sans-serif;overflow:auto}
.canvas{position:relative;width:${w}px;height:${h}px;margin:20px auto}
.rm-node{transition:box-shadow .15s,transform .12s}
.rm-node:hover{box-shadow:0 6px 20px rgba(0,0,0,0.15)!important;transform:translateY(-2px)}
.popup-overlay{display:none;position:fixed;inset:0;z-index:999;background:rgba(0,0,0,0.5);backdrop-filter:blur(6px);align-items:center;justify-content:center;padding:20px}
.popup-overlay.show{display:flex}
.popup-card{background:#fff;border-radius:20px;width:100%;max-width:600px;max-height:85vh;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.2);display:flex;flex-direction:column;animation:popIn .25s cubic-bezier(0.16,1,0.3,1)}
@keyframes popIn{from{opacity:0;transform:scale(0.92) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}
.popup-header{display:flex;justify-content:space-between;align-items:center;padding:24px 30px;border-bottom:2px solid #f0f2f5;background:#f9fafb}
.popup-header h3{font-size:20px;font-weight:800;margin:0;color:#1a1a2e;text-transform:uppercase;letter-spacing:0.5px}
.popup-close{background:rgba(0,0,0,0.05);border:none;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:20px;cursor:pointer;color:#6b7280;transition:all .15s}
.popup-close:hover{background:#ef4444;color:#fff}
.popup-body{padding:30px;overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:24px;}
.popup-content{font-size:16px;line-height:1.7;color:#374151;white-space:pre-wrap;flex:1}
.popup-content h4{margin-top:12px;margin-bottom:14px;font-size:16px;font-weight:800;text-transform:uppercase;border-bottom:2px solid #1a1a2e;padding-bottom:6px;display:inline-block;color:#1a1a2e}
.popup-content p{margin-bottom:16px}
.popup-content ul,.popup-content ol{margin-left:24px;margin-bottom:16px}
.popup-content code{background:#f0f2f5;padding:3px 8px;border-radius:6px;font-size:14px;border:1px solid #e5e7eb;font-family:monospace;font-weight:600;color:#ef4444}
.popup-video{margin-top:auto}
.yt-link-btn{display:flex;align-items:center;justify-content:center;gap:12px;padding:16px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:12px;font-size:15px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;border:2px solid #1a1a2e;box-shadow:4px 4px 0 rgba(0,0,0,0.1);transition:transform .1s,box-shadow .1s;width:100%}
.yt-link-btn:hover{background:#2d2d44;transform:translate(2px,2px);box-shadow:2px 2px 0 rgba(0,0,0,0.1)}
.yt-link-btn svg{flex-shrink:0}
.canvas-wrapper { width: 100%; overflow-x: hidden; padding: 20px; }
@media (max-width: 600px) {
    .popup-card { border-radius: 14px; }
    .popup-body { padding: 16px; font-size: 14px; }
    .popup-header { padding: 16px 18px; }
}
</style>
</head>
<body>
<div class="canvas">
<svg viewBox="0 0 ${w} ${h}" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:visible;">
${svgPaths}
</svg>
${nodeDivs}
</div>
<div class="popup-overlay" id="popup">
<div class="popup-card">
<div class="popup-header"><h3 id="popupTitle"></h3><button class="popup-close" onclick="closePopup()">&times;</button></div>
<div class="popup-body">
<div id="popupContent" class="popup-content"></div>
<div id="popupVideo" class="popup-video" style="display:none">
<a id="popupYtLink" href="#" target="_blank" rel="noopener noreferrer" class="yt-link-btn">
<svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><polygon points="5 3 19 12 5 21 5 3" /></svg>
<span>Watch on YouTube</span>
</a>
</div>
</div>
</div></div>
<script>
var nd=${exportNodes};
function fn(id){return nd.find(function(n){return n.id===id})}
document.querySelectorAll('.rm-node').forEach(function(el){
el.addEventListener('click',function(){
var n=fn(el.dataset.id);
if(!n)return;
document.getElementById('popupTitle').textContent=n.title;
document.getElementById('popupContent').innerHTML=n.definition||'<p style="color:#9ca3af;font-style:italic">No description provided.</p>';
var v=document.getElementById('popupVideo'), l=document.getElementById('popupYtLink');
if(n.yt_link){v.style.display='block';l.href=n.yt_link;}else{v.style.display='none';l.href='#';}
document.getElementById('popup').classList.add('show');
});
});
function closePopup(){document.getElementById('popup').classList.remove('show');}
document.getElementById('popup').addEventListener('click',function(e){if(e.target===this)closePopup()});
document.addEventListener('keydown',function(e){if(e.key==='Escape')closePopup()});
<\/script>
</body>
</html>`;
}

function getDashArray() {
    const s = data.lineStyle || 'curved-dash';
    if (s.includes('solid') || s === 'orthogonal') return 'none';
    if (s.includes('straight-dash')) return '6 4';
    return '8 5';
}

// ===== IMPORT =====
btnImport.addEventListener('click', () => importFile.click());
importFile.addEventListener('change', e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
        try {
            const parsed = JSON.parse(ev.target.result);
            pushHistory();
            if (parsed.nodes && Array.isArray(parsed.nodes)) {
                data = { nodes: parsed.nodes, connections: parsed.connections || [], lineStyle: parsed.lineStyle || 'curved-dash' };
            } else if (Array.isArray(parsed)) {
                data = { nodes: parsed, connections: [], lineStyle: 'curved-dash' };
            } else { alert('Invalid format.'); return; }
            save(); render(); centerView();
            lineStyleSelect.value = data.lineStyle;
        } catch { alert('Failed to parse JSON.'); }
    };
    reader.readAsText(file); importFile.value = '';
});

// ===== EXPORT DROPDOWN =====
btnExportToggle.addEventListener('click', e => {
    e.stopPropagation();
    const show = !exportMenu.classList.contains('show');
    exportMenu.classList.toggle('show', show);
    if (show) {
        const rect = btnExportToggle.getBoundingClientRect();
        exportMenu.style.left = rect.left + 'px';
        exportMenu.style.top = (rect.bottom + 6) + 'px';
    }
});
document.addEventListener('click', () => exportMenu.classList.remove('show'));

// ===== CANVAS CLICK =====
canvasEl.addEventListener('click', e => {
    if (e.target === canvasEl || e.target === nodesEl || e.target === linesEl || e.target.tagName === 'svg') {
        deselectAll();
        detailPanel.classList.add('hidden');
        detailIframe.src = '';
    }
});

// ===== KEYBOARD =====
const shortcutsPanel = document.getElementById('shortcutsPanel');
const closeShortcutsBtn = document.getElementById('closeShortcuts');
const btnShortcutsHelp = document.getElementById('btnShortcutsHelp');
function toggleShortcuts() { shortcutsPanel.classList.toggle('hidden'); }
if (closeShortcutsBtn) closeShortcutsBtn.addEventListener('click', toggleShortcuts);
if (btnShortcutsHelp) btnShortcutsHelp.addEventListener('click', toggleShortcuts);
if (shortcutsPanel) shortcutsPanel.addEventListener('click', e => { if (e.target === shortcutsPanel) toggleShortcuts(); });

document.addEventListener('keydown', e => {
    // Don't intercept when typing in inputs/textareas
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        if (e.key === 'Escape') {
            if (!editModal.classList.contains('hidden')) closeModal();
            else if (!renameModal.classList.contains('hidden')) closeRenameModal();
        }
        return;
    }
    if (!editModal.classList.contains('hidden')) { if (e.key === 'Escape') closeModal(); return; }
    if (!renameModal.classList.contains('hidden')) { if (e.key === 'Escape') closeRenameModal(); return; }
    closeCtxMenu();

    // Escape
    if (e.key === 'Escape') {
        if (!shortcutsPanel.classList.contains('hidden')) { toggleShortcuts(); return; }
        if (connectMode) exitConnectMode();
        else if (!detailPanel.classList.contains('hidden')) { detailPanel.classList.add('hidden'); detailIframe.src = ''; }
        else { deselectAll(); clearMultiSelect(); }
    }

    // ? = show shortcuts
    if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        toggleShortcuts();
    }

    // Ctrl+Z = undo
    if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault(); undo();
    }
    // Ctrl+Y or Ctrl+Shift+Z = redo
    if ((e.key === 'y' || e.key === 'Y') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault(); redo();
    }
    if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey) && e.shiftKey) {
        e.preventDefault(); redo();
    }

    // Delete / Backspace
    if ((e.key === 'Delete' || e.key === 'Backspace') && document.activeElement === document.body) {
        if (!isLocked && multiSelected.length > 0) { deleteMultiSelected(); return; }
        if (!isLocked && (selectedId || selectedConnId)) btnDelete.click();
    }

    // Ctrl+A = select all
    if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        multiSelected = data.nodes.map(n => n.id);
        render();
        toast('All nodes selected', 'info');
    }

    // Ctrl+C = copy
    if ((e.key === 'c' || e.key === 'C') && (e.ctrlKey || e.metaKey)) {
        copySelected();
    }
    // Ctrl+X = cut
    if ((e.key === 'x' || e.key === 'X') && (e.ctrlKey || e.metaKey)) {
        cutSelected();
    }
    // Ctrl+V = paste
    if ((e.key === 'v' || e.key === 'V') && (e.ctrlKey || e.metaKey)) {
        pasteClipboard();
    }

    // Ctrl+D = duplicate selected
    if ((e.key === 'd' || e.key === 'D') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        duplicateSelected();
    }

    // Arrow keys = nudge selected node(s)
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && document.activeElement === document.body) {
        const targets = multiSelected.length > 0 ? multiSelected : (selectedId ? [selectedId] : []);
        if (targets.length === 0) return;
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        pushHistory();
        targets.forEach(id => {
            const n = findNode(id);
            if (!n) return;
            if (e.key === 'ArrowLeft') n.x -= step;
            if (e.key === 'ArrowRight') n.x += step;
            if (e.key === 'ArrowUp') n.y -= step;
            if (e.key === 'ArrowDown') n.y += step;
        });
        save(); render();
    }
});

// ===== CLIPBOARD (Copy/Paste/Duplicate) =====
let clipboard = { nodes: [], connections: [] };
let pasteCount = 0; // track successive pastes for offset

function copySelected() {
    const toCopy = multiSelected.length > 0 ? multiSelected : (selectedId ? [selectedId] : []);
    if (toCopy.length === 0) { toast('Nothing to copy', 'warn'); return; }

    const copiedNodes = toCopy.map(id => {
        const n = findNode(id);
        return n ? JSON.parse(JSON.stringify(n)) : null;
    }).filter(n => n);

    const copiedIds = new Set(copiedNodes.map(n => n.id));
    const copiedConns = data.connections.filter(c => copiedIds.has(c.from) && copiedIds.has(c.to));

    clipboard = {
        nodes: copiedNodes,
        connections: JSON.parse(JSON.stringify(copiedConns))
    };
    pasteCount = 0;
    try { localStorage.setItem('roadmapEditorClipboard', JSON.stringify(clipboard)); } catch (e) { }
    toast('Copied ' + copiedNodes.length + ' node(s)', 'success');
}

function cutSelected() {
    const count = multiSelected.length > 0 ? multiSelected.length : (selectedId ? 1 : 0);
    copySelected();
    if (multiSelected.length > 0) deleteMultiSelected();
    else if (selectedId) btnDelete.click();
    if (count > 0) toast('Cut ' + count + ' node(s)', 'success');
}

function pasteClipboard() {
    if (isLocked) { toast('Canvas is locked', 'warn'); return; }
    let cb = JSON.parse(JSON.stringify(clipboard)); // deep copy so we can paste multiple times
    if (!cb || !cb.nodes || cb.nodes.length === 0) {
        try { cb = JSON.parse(localStorage.getItem('roadmapEditorClipboard')); } catch (e) { }
    }
    if (!cb || !cb.nodes || cb.nodes.length === 0) { toast('Clipboard is empty', 'warn'); return; }

    pushHistory();
    clearMultiSelect();
    deselectAll();

    const idMap = {};
    pasteCount++;
    const offset = 30 * pasteCount;

    // Deep copy nodes to avoid mutating the clipboard
    const newNodes = JSON.parse(JSON.stringify(cb.nodes));
    newNodes.forEach(n => {
        const oldId = n.id;
        const newId = genId();
        idMap[oldId] = newId;

        n.id = newId;
        n.x += offset;
        n.y += offset;
        if (n.parentId && idMap[n.parentId]) n.parentId = idMap[n.parentId];
        else if (n.parentId && !cb.nodes.find(cn => cn.id === n.parentId)) n.parentId = null;

        data.nodes.push(n);
        multiSelected.push(newId);
    });

    if (cb.connections) {
        cb.connections.forEach(c => {
            if (!idMap[c.from] || !idMap[c.to]) return;
            data.connections.push({
                id: genId(),
                from: idMap[c.from],
                to: idMap[c.to]
            });
        });
    }

    save();
    render();
    toast('Pasted ' + newNodes.length + ' node(s)', 'success');
}

function duplicateSelected() {
    if (isLocked) return;
    const targets = multiSelected.length > 0 ? multiSelected : (selectedId ? [selectedId] : []);
    if (targets.length === 0) { toast('Nothing to duplicate', 'warn'); return; }

    pushHistory();

    const srcNodes = targets.map(id => findNode(id)).filter(n => n);
    const srcIds = new Set(srcNodes.map(n => n.id));
    const srcConns = data.connections.filter(c => srcIds.has(c.from) && srcIds.has(c.to));

    const idMap = {};
    clearMultiSelect();
    deselectAll();

    srcNodes.forEach(orig => {
        const n = JSON.parse(JSON.stringify(orig));
        const newId = genId();
        idMap[orig.id] = newId;
        n.id = newId;
        n.x += 30;
        n.y += 30;
        if (n.parentId && idMap[n.parentId]) n.parentId = idMap[n.parentId];
        data.nodes.push(n);
        multiSelected.push(newId);
    });

    srcConns.forEach(c => {
        if (!idMap[c.from] || !idMap[c.to]) return;
        data.connections.push({ id: genId(), from: idMap[c.from], to: idMap[c.to] });
    });

    save(); render();
    toast('Duplicated ' + srcNodes.length + ' node(s)', 'success');
}


// ===== CONTEXT MENU =====
let ctxMenu = null;

function closeCtxMenu() {
    if (ctxMenu) { ctxMenu.remove(); ctxMenu = null; }
}

function buildCtxMenu(x, y, items) {
    closeCtxMenu();
    ctxMenu = document.createElement('div');
    ctxMenu.className = 'ctx-menu';
    ctxMenu.style.left = x + 'px';
    ctxMenu.style.top = y + 'px';

    items.forEach(item => {
        if (item === 'divider') {
            const d = document.createElement('div'); d.className = 'ctx-divider';
            ctxMenu.appendChild(d);
        } else if (item.type === 'section') {
            const s = document.createElement('div'); s.className = 'ctx-section';
            s.textContent = item.label; ctxMenu.appendChild(s);
        } else if (item.type === 'color') {
            const row = document.createElement('div'); row.className = 'ctx-color-row';
            const lbl = document.createElement('label'); lbl.textContent = item.label;
            const inp = document.createElement('input'); inp.type = 'color'; inp.value = item.value || '#3b82f6';
            inp.addEventListener('input', () => item.onChange(inp.value));
            inp.addEventListener('change', () => item.onChange(inp.value));
            row.appendChild(lbl); row.appendChild(inp);
            ctxMenu.appendChild(row);
        } else {
            const btn = document.createElement('button');
            btn.className = 'ctx-item' + (item.danger ? ' danger' : '') + (item.active ? ' active-item' : '');
            btn.innerHTML = (item.icon || '') + ' ' + item.label;
            btn.addEventListener('click', () => { item.action(); closeCtxMenu(); });
            ctxMenu.appendChild(btn);
        }
    });

    document.body.appendChild(ctxMenu);

    // Keep in bounds
    requestAnimationFrame(() => {
        const rect = ctxMenu.getBoundingClientRect();
        if (rect.right > window.innerWidth) ctxMenu.style.left = (x - rect.width) + 'px';
        if (rect.bottom > window.innerHeight) ctxMenu.style.top = (y - rect.height) + 'px';
    });
}

// Node right-click menu
function showNodeContextMenu(e, nodeId) {
    e.preventDefault(); e.stopPropagation();
    const n = findNode(nodeId);
    if (!n) return;
    if (!isLocked) selectNode(nodeId);
    const s = n.style || getDefaultStyle(n.type);

    buildCtxMenu(e.clientX, e.clientY, [
        { type: 'section', label: n.title },
        { icon: '✏️', label: 'Edit…', action: () => { selectNode(nodeId); openEditModal(n); } },
        {
            icon: '🌿', label: 'Add Branch', action: () => {
                if (isLocked) return;
                selectNode(nodeId);
                pushHistory();
                const branch = { id: genId(), title: 'New Topic', type: 'branch', x: n.x + 40 + Math.random() * 60, y: n.y + 120, parentId: n.id, definition: '', yt_link: '', style: getDefaultStyle('branch') };
                data.nodes.push(branch);
                save(); render(); selectNode(branch.id);
            }
        },
        'divider',
        { type: 'section', label: 'Color' },
        {
            type: 'color', label: 'Background', value: s.bg, onChange: (v) => {
                pushHistory();
                n.style = n.style || getDefaultStyle(n.type);
                n.style.bg = v;
                n.style.textColor = isLightColor(v) ? '#1a1a2e' : '#ffffff';
                save(); render(); selectNode(nodeId);
            }
        },
        'divider',
        { type: 'section', label: 'Shape' },
        { icon: s.shape === 'rounded' ? '✓' : '', label: '⬜ Rounded', active: s.shape === 'rounded', action: () => applyNodeStyle(nodeId, { shape: 'rounded' }) },
        { icon: s.shape === 'pill' ? '✓' : '', label: '💊 Pill', active: s.shape === 'pill', action: () => applyNodeStyle(nodeId, { shape: 'pill' }) },
        { icon: s.shape === 'square' ? '✓' : '', label: '🔲 Square', active: s.shape === 'square', action: () => applyNodeStyle(nodeId, { shape: 'square' }) },
        'divider',
        { type: 'section', label: 'Border' },
        { label: '— Solid', active: s.border === 'solid', action: () => applyNodeStyle(nodeId, { border: 'solid' }) },
        { label: '- - Dashed', active: s.border === 'dashed', action: () => applyNodeStyle(nodeId, { border: 'dashed' }) },
        { label: '✕ None', active: s.border === 'none', action: () => applyNodeStyle(nodeId, { border: 'none' }) },
        'divider',
        {
            icon: '🗑️', label: 'Delete node', danger: true, action: () => {
                if (isLocked) return;
                pushHistory();
                const idsToRemove = new Set([nodeId, ...getDescendants(nodeId).map(d => d.id)]);
                data.nodes = data.nodes.filter(n => !idsToRemove.has(n.id));
                data.connections = data.connections.filter(c => !idsToRemove.has(c.from) && !idsToRemove.has(c.to));
                selectedId = null; save(); render();
            }
        },
    ]);
}

function applyNodeStyle(nodeId, stylePatch) {
    const n = findNode(nodeId);
    if (!n) return;
    pushHistory();
    n.style = Object.assign(n.style || getDefaultStyle(n.type), stylePatch);
    save(); render(); selectNode(nodeId);
}

// Line right-click menu (stored for hitbox right-click)
function showLineContextMenu(e, lineId) {
    e.preventDefault(); e.stopPropagation();

    let isParentConn = lineId.startsWith('parent:');
    let targetObj = isParentConn ? findNode(lineId.replace('parent:', '')) : data.connections.find(c => c.id === lineId);
    let cur = (isParentConn ? targetObj?.lineStyle : targetObj?.style) || data.lineStyle;

    const lineTypes = [
        { value: 'curved-dash', label: '⋯ Curved Dotted' },
        { value: 'curved-solid', label: '— Curved Solid' },
        { value: 'straight-dash', label: '- - Straight Dashed' },
        { value: 'straight-solid', label: '— Straight Solid' },
        { value: 'orthogonal', label: '⌐ Orthogonal' },
    ];
    buildCtxMenu(e.clientX, e.clientY, [
        { type: 'section', label: 'Line Style (This line only)' },
        ...lineTypes.map(lt => ({
            icon: lt.value === cur ? '✓' : '',
            label: lt.label,
            active: cur === lt.value,
            action: () => {
                pushHistory();
                if (targetObj) {
                    if (isParentConn) targetObj.lineStyle = lt.value;
                    else targetObj.style = lt.value;
                }
                save(); drawLines();
            }
        })),
        'divider',
        {
            icon: '🗑️', label: 'Delete this line', danger: true, action: () => {
                if (isLocked) return;
                pushHistory();
                if (lineId.startsWith('parent:')) {
                    const child = findNode(lineId.replace('parent:', ''));
                    if (child) child.parentId = null;
                } else {
                    data.connections = data.connections.filter(c => c.id !== lineId);
                }
                selectedConnId = null; save(); render();
            }
        },
    ]);
}



// Close context menu on outside click
document.addEventListener('click', () => closeCtxMenu());
document.addEventListener('contextmenu', e => {
    if (!e.target.closest('.ctx-menu') && !e.target.closest('.node') && !e.target.closest('.connector-line-hitbox')) {
        closeCtxMenu();
    }
});

// ===== MULTI-SELECT (rubber-band) =====
let multiSelected = [];
let isRubberBanding = false;
let rbStart = null;
const selectionRect = document.getElementById('selectionRect');

function clearMultiSelect() {
    multiSelected = [];
    document.querySelectorAll('.node.multi-selected').forEach(el => el.classList.remove('multi-selected'));
}

canvasWrapper.addEventListener('pointerdown', e => {
    // Only start rubber-band on empty canvas area
    const isNode = e.target.closest('.node');
    const isHitbox = e.target.closest('.connector-line-hitbox');
    const isUI = e.target.closest('#sidebar') || e.target.closest('#toolbar') || e.target.closest('.detail-panel') || e.target.closest('.modal-overlay');

    if (isNode || isHitbox || isUI) return;
    if (e.button !== 0) return;
    if (connectMode || isLocked) return;

    // Shift+Left-click drag on empty canvas = rubber-band select
    panzoomInstance.setOptions({ disablePan: true });

    clearMultiSelect();
    deselectAll();

    const crect = canvasEl.getBoundingClientRect();
    const scale = panzoomInstance.getScale();

    rbStart = {
        clientX: e.clientX,
        clientY: e.clientY,
        canvasX: (e.clientX - crect.left) / scale,
        canvasY: (e.clientY - crect.top) / scale,
    };

    selectionRect.style.display = 'none';
    isRubberBanding = false;
}, { capture: true });

document.addEventListener('pointermove', e => {
    if (!rbStart) return;
    const dx = e.clientX - rbStart.clientX;
    const dy = e.clientY - rbStart.clientY;
    if (!isRubberBanding && Math.sqrt(dx * dx + dy * dy) > 6) isRubberBanding = true;
    if (!isRubberBanding) return;

    const crect = canvasEl.getBoundingClientRect();
    const scale = panzoomInstance.getScale();
    const curX = (e.clientX - crect.left) / scale;
    const curY = (e.clientY - crect.top) / scale;

    const rx = Math.min(rbStart.canvasX, curX);
    const ry = Math.min(rbStart.canvasY, curY);
    const rw = Math.abs(curX - rbStart.canvasX);
    const rh = Math.abs(curY - rbStart.canvasY);

    selectionRect.style.display = 'block';
    selectionRect.style.left = rx + 'px';
    selectionRect.style.top = ry + 'px';
    selectionRect.style.width = rw + 'px';
    selectionRect.style.height = rh + 'px';

    // Highlight nodes inside rect
    const rx2 = rx + rw, ry2 = ry + rh;
    multiSelected = data.nodes.filter(n => {
        const el = nodesEl.querySelector(`[data-id="${n.id}"]`);
        const nw = el ? el.offsetWidth : 140, nh = el ? el.offsetHeight : 44;
        return n.x + nw > rx && n.x < rx2 && n.y + nh > ry && n.y < ry2;
    }).map(n => n.id);

    document.querySelectorAll('.node').forEach(el => {
        el.classList.toggle('multi-selected', multiSelected.includes(el.dataset.id));
    });
});

document.addEventListener('pointerup', e => {
    if (rbStart) {
        if (isRubberBanding) {
            selectionRect.style.display = 'none';
            if (multiSelected.length === 1) {
                // If only one node selected, treat as normal selection
                selectNode(multiSelected[0]);
                clearMultiSelect();
            } else if (multiSelected.length > 0) {
                deselectAll();
                // Render already marked them mostly, just ensure no solo selection
                render();
            }
        }
        rbStart = null;
        isRubberBanding = false;
        panzoomInstance.setOptions({ disablePan: false });
    }
});

function deleteMultiSelected() {
    pushHistory();
    const idsToRemove = new Set(multiSelected);
    data.nodes = data.nodes.filter(n => !idsToRemove.has(n.id));
    data.connections = data.connections.filter(c => !idsToRemove.has(c.from) && !idsToRemove.has(c.to));
    multiSelected = []; selectedId = null;
    save(); render();
}

// Right-click on canvas area = group context menu if multi-selected
canvasWrapper.addEventListener('contextmenu', e => {
    if (e.target !== canvasWrapper && e.target.id !== 'canvas') return;
    if (multiSelected.length < 2) return;
    e.preventDefault();
    buildCtxMenu(e.clientX, e.clientY, [
        { type: 'section', label: `${multiSelected.length} nodes selected` },
        {
            type: 'color', label: 'Apply color', value: '#3b82f6', onChange: (v) => {
                pushHistory();
                multiSelected.forEach(id => {
                    const n = findNode(id); if (!n) return;
                    n.style = n.style || getDefaultStyle(n.type);
                    n.style.bg = v;
                    n.style.textColor = isLightColor(v) ? '#1a1a2e' : '#ffffff';
                });
                save(); render();
            }
        },
        'divider',
        { type: 'section', label: 'Apply shape' },
        { label: '⬜ Rounded', action: () => { pushHistory(); multiSelected.forEach(id => applyNodeStyleSilent(id, { shape: 'rounded' })); save(); render(); } },
        { label: '💊 Pill', action: () => { pushHistory(); multiSelected.forEach(id => applyNodeStyleSilent(id, { shape: 'pill' })); save(); render(); } },
        { label: '🔲 Square', action: () => { pushHistory(); multiSelected.forEach(id => applyNodeStyleSilent(id, { shape: 'square' })); save(); render(); } },
        'divider',
        { icon: '🗑️', label: 'Delete all selected', danger: true, action: deleteMultiSelected },
    ]);
});

function applyNodeStyleSilent(nodeId, patch) {
    const n = findNode(nodeId);
    if (!n) return;
    n.style = Object.assign(n.style || getDefaultStyle(n.type), patch);
}

// ===== UPDATED HTML EXPORT (responsive, editable config, fixed YouTube) =====
function generateStaticHTML(bgColor) {
    bgColor = bgColor || '#ffffff';
    const nodeSizes = {};
    data.nodes.forEach(n => {
        const el = nodesEl.querySelector(`[data-id="${n.id}"]`);
        nodeSizes[n.id] = el ? { w: el.offsetWidth, h: el.offsetHeight } : { w: 150, h: 44 };
    });

    // Compute bounding box first so we can offset everything
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    data.nodes.forEach(n => {
        const sz = nodeSizes[n.id] || { w: 150, h: 44 };
        minX = Math.min(minX, n.x);
        minY = Math.min(minY, n.y);
        maxX = Math.max(maxX, n.x + sz.w);
        maxY = Math.max(maxY, n.y + sz.h);
    });
    if (minX === Infinity) { minX = 0; minY = 0; maxX = 800; maxY = 600; }
    const pad = 60;
    const w = maxX - minX + pad * 2;
    const h = maxY - minY + pad * 2;
    const dx = minX - pad;
    const dy = minY - pad;

    function lineD(from, to, style) {
        const fw = nodeSizes[from.id]?.w || 150, fh = nodeSizes[from.id]?.h || 44;
        const tw = nodeSizes[to.id]?.w || 150, th = nodeSizes[to.id]?.h || 44;
        return getLinePath((from.x - dx) + fw / 2, (from.y - dy) + fh / 2, (to.x - dx) + tw / 2, (to.y - dy) + th / 2, style);
    }

    function localDashArray(style) {
        style = style || data.lineStyle || 'curved-dash';
        if (style.includes('solid') || style === 'orthogonal') return 'none';
        if (style.includes('straight-dash')) return '6 4';
        return '8 5';
    }

    let svgPaths = '';
    data.nodes.forEach(n => {
        if (!n.parentId) return;
        const p = findNode(n.parentId);
        if (!p) return;
        const s = n.lineStyle || data.lineStyle;
        svgPaths += `<path d="${lineD(p, n, s)}" stroke="#94a3b8" stroke-width="2" stroke-dasharray="${localDashArray(s)}" fill="none"/>\n`;
    });
    data.connections.forEach(c => {
        const f = findNode(c.from), t = findNode(c.to);
        if (!f || !t) return;
        const s = c.style || data.lineStyle;
        svgPaths += `<path d="${lineD(f, t, s)}" stroke="#94a3b8" stroke-width="2" stroke-dasharray="${localDashArray(s)}" fill="none"/>\n`;
    });

    const exportNodes = JSON.stringify(data.nodes.map(n => ({ id: n.id, title: n.title, definition: n.definition || '', yt_link: n.yt_link || '' }))).replace(/<\//g, '<\\/');
    const fullDataJSON = JSON.stringify(data).replace(/<\//g, '<\\/');

    let nodeDivs = '';
    data.nodes.forEach(n => {
        const s = n.style || getDefaultStyle(n.type);
        let br = '10px'; if (s.shape === 'pill') br = '100px'; if (s.shape === 'square') br = '4px';
        const border = s.border === 'none' ? 'none' : `2px ${s.border || 'solid'} rgba(0,0,0,0.12)`;
        nodeDivs += `<div class="rm-node" data-id="${n.id}" style="position:absolute;left:${n.x - dx}px;top:${n.y - dy}px;min-width:120px;max-width:240px;padding:11px 18px;border-radius:${br};font-size:13.5px;font-weight:600;text-align:center;background:${s.bg};color:${s.textColor};border:${border};box-shadow:0 1px 3px rgba(0,0,0,0.08);white-space:nowrap;cursor:pointer;">${n.title}</div>\n`;
    });

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Roadmap</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<style>
/* ============================================================
   EDITABLE CONFIGURATION
   Change these values to customize the look of your roadmap!
   --bg-color ........... Background color (use 'transparent' for none)
   --line-color ......... Color of connecting lines
   --line-width ......... Thickness of connecting lines
   --node-hover-shadow .. Shadow on node hover
   --popup-max-width .... Max width of the detail popup
   ============================================================ */
:root {
    --bg-color: ${bgColor};
    --line-color: #94a3b8;
    --line-width: 2;
    --node-hover-shadow: 0 6px 22px rgba(0,0,0,0.16);
    --popup-max-width: 540px;
}

*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
body {
    background: var(--bg-color);
    font-family: 'Inter', -apple-system, sans-serif;
    overflow: auto;
    min-height: 100vh;
}
.canvas-wrapper {
    width: 100%;
    overflow-x: auto;
    padding: 20px;
}
.canvas {
    position: relative;
    width: ${w}px;
    height: ${h}px;
    margin: 0 auto;
    transform-origin: top left;
}
.rm-node { transition: box-shadow .15s ease, transform .12s ease; }
.rm-node:hover {
    box-shadow: var(--node-hover-shadow) !important;
    transform: translateY(-2px);
}
.popup-overlay {
    display: none; position: fixed; inset: 0; z-index: 999;
    background: rgba(0,0,0,0.45); backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    align-items: center; justify-content: center;
}
.popup-overlay.show { display: flex; }
.popup-card {
    background: #fff; border-radius: 20px; width: 92%;
    max-width: var(--popup-max-width); max-height: 85vh;
    overflow: hidden; box-shadow: 0 24px 60px rgba(0,0,0,0.25);
    display: flex; flex-direction: column; animation: popIn .25s cubic-bezier(0.16,1,0.3,1);
}
.popup-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 20px 24px; border-bottom: 2px solid #f0f2f5;
    background: linear-gradient(135deg, #1a1a2e 0%, #2d2d50 100%);
}
.popup-header h3 { font-size: 18px; font-weight: 800; margin: 0; color: #fff; letter-spacing: 0.4px; }
.popup-close {
    background: rgba(255,255,255,0.1); border: 1.5px solid rgba(255,255,255,0.2);
    border-radius: 8px; width: 32px; height: 32px; display: flex;
    align-items: center; justify-content: center; font-size: 20px;
    cursor: pointer; color: #fff; transition: all .15s;
}
.popup-close:hover { background: #ef4444; border-color: #ef4444; }
.popup-body {
    padding: 24px; overflow-y: auto; flex: 1;
    font-size: 15px; line-height: 1.75; color: #1a1a2e;
    display: flex; flex-direction: column; gap: 0;
}
@keyframes popIn {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
}
.popup-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 18px 22px; border-bottom: 1px solid #e5e7eb; background: #f9fafb;
}
.popup-header h3 { font-size: 17px; font-weight: 700; margin: 0; color: #1a1a2e; }
.popup-close {
    background: none; border: none; font-size: 24px;
    cursor: pointer; color: #6b7280; transition: color .15s;
}
.popup-close:hover { color: #ef4444; }
.popup-body {
    padding: 24px; overflow-y: auto; flex: 1;
    font-size: 15px; line-height: 1.75; color: #1a1a2e; white-space: normal;
}
    .popup-body h3 { font-size: 17px; font-weight: 800; margin: 0 0 12px; color: #1a1a2e; }
.popup-body h4 { font-size: 14px; font-weight: 700; margin: 16px 0 8px; color: #374151; text-transform: uppercase; letter-spacing: 0.4px; }
.popup-body p { margin: 0 0 10px; }
.popup-body ul, .popup-body ol { margin: 0 0 10px 20px; padding: 0; }
.popup-body li { margin-bottom: 4px; }
.popup-body pre { background: #f1f5f9; border-radius: 8px; padding: 12px; overflow-x: auto; margin: 10px 0; }
.popup-body pre code { background: none; border: none; padding: 0; font-size: 13px; }
.popup-body code { background: #f0f2f5; padding: 2px 6px; border-radius: 4px; font-size: 13px; border: 1px solid #e5e7eb; }
.popup-body h4 { margin-bottom: 8px; font-size: 15px; }
.popup-body p { margin-bottom: 10px; }
.popup-body code { background: #f0f2f5; padding: 2px 6px; border-radius: 4px; font-size: 12.5px; }
.yt-link-btn {
    display: flex; align-items: center; gap: 10px;
    padding: 14px 20px; background: #1a1a2e; color: #fff;
    text-decoration: none; border-radius: 10px;
    font-size: 14px; font-weight: 600;
    transition: background .15s, transform .12s; cursor: pointer;
}
.yt-link-btn:hover { background: #2d2d44; transform: translateY(-1px); }
.yt-link-btn svg { flex-shrink: 0; }
</style>
</head>
<body>
<div class="canvas-wrapper" id="canvasWrapper">
<div class="canvas" id="roadmapCanvas">
<svg viewBox="0 0 ${w} ${h}" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:visible;">
${svgPaths}
</svg>
${nodeDivs}
</div>
</div>

<div class="popup-overlay" id="popup">
<div class="popup-card">
<div class="popup-header">
    <h3 id="popupTitle"></h3>
    <button class="popup-close" onclick="closePopup()">&times;</button>
</div>
<div class="popup-body">
    <div id="popupContent"></div>
    <div id="popupVideo" style="display:none;margin-top:20px">
        <a id="popupYtLink" href="#" target="_blank" rel="noopener noreferrer" class="yt-link-btn">
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            <span>Watch on YouTube</span>
        </a>
    </div>
</div>
</div>
</div>

` + '<' + 'script type="application/json" id="roadmapFullData">' + fullDataJSON + '<' + '/script>' + `

` + '<' + 'script>' + `
var nd = ` + exportNodes + `;

function fn(id) { for (var i = 0; i < nd.length; i++) { if (nd[i].id === id) return nd[i]; } return null; }

var nodes = document.querySelectorAll('.rm-node');
for (var i = 0; i < nodes.length; i++) {
    (function(el) {
        el.addEventListener('click', function() {
            var n = fn(el.getAttribute('data-id'));
            if (!n) return;
            document.getElementById('popupTitle').textContent = n.title;
            document.getElementById('popupContent').innerHTML = n.definition || '<p style="color:#9ca3af">No description.</p>';
            var v = document.getElementById('popupVideo');
            var lnk = document.getElementById('popupYtLink');
            if (n.yt_link) { v.style.display = 'block'; lnk.href = n.yt_link; }
            else { v.style.display = 'none'; }
            document.getElementById('popup').classList.add('show');
        });
    })(nodes[i]);
}

function closePopup() {
    document.getElementById('popup').classList.remove('show');
}
document.getElementById('popup').addEventListener('click', function(e) {
    if (e.target === this) closePopup();
});
document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closePopup(); });

(function() {
    var canvas = document.getElementById('roadmapCanvas');
    var wrapper = document.getElementById('canvasWrapper');
    var cw = ${w};
    var ch = ${h};
    function fitCanvas() {
        var viewW = wrapper.clientWidth;
        if (viewW < cw) {
            var s = viewW / cw;
            canvas.style.transform = 'scale(' + s + ')';
            canvas.style.transformOrigin = 'top left';
            wrapper.style.height = (ch * s + 40) + 'px';
        } else {
            canvas.style.transform = 'none';
            wrapper.style.height = 'auto';
        }
    }
    fitCanvas();
    window.addEventListener('resize', fitCanvas);
})();
` + '<' + '/script>' + `
</body>
</html>`;
}


// ===== BOOT =====
initFirstRoadmap();
initPanzoom();
render();
centerView();
maybeShowWelcome();

