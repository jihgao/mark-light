const editor = document.getElementById('editor');
const preview = document.getElementById('preview');
const previewPane = document.getElementById('preview-pane');
const divider = document.getElementById('divider');
const lineNumbers = document.getElementById('line-numbers');
const statusFile = document.getElementById('status-file');
const statusInfo = document.getElementById('status-info');
const statusWords = document.getElementById('status-words');
const container = document.getElementById('container');
const dragOverlay = document.getElementById('drag-overlay');

let currentFile = null;
let isModified = false;
let viewMode = 'split'; // 'split' | 'editor' | 'preview'
let lineNumbersVisible = true;
let theme = 'system'; // 'light' | 'dark' | 'system'

// -- Markdown conversion --
function renderMarkdown() {
  const text = editor.value;
  preview.innerHTML = marked.parse(text || '');
}

// -- Line numbers --
function updateLineNumbers() {
  const lines = editor.value.split('\n').length;
  let html = '';
  for (let i = 1; i <= lines; i++) {
    html += i + '<br>';
  }
  lineNumbers.innerHTML = html;
}

// -- Cursor position --
function updateCursorInfo() {
  const text = editor.value.substring(0, editor.selectionStart);
  const lines = text.split('\n');
  const ln = lines.length;
  const col = lines[lines.length - 1].length + 1;
  statusInfo.textContent = `Ln ${ln}, Col ${col}`;
}

// -- Word count --
function updateWordCount() {
  const words = editor.value.trim() ? editor.value.trim().split(/\s+/).length : 0;
  statusWords.textContent = `${words} word${words !== 1 ? 's' : ''}`;
}

// -- Status bar --
function updateStatusBar() {
  const modified = isModified ? ' *' : '';
  const name = currentFile ? currentFile.split(/[/\\]/).pop() : 'Untitled';
  statusFile.textContent = name + modified;
  updateLineNumbers();
  updateCursorInfo();
  updateWordCount();
  updateWindowTitle();
}

// -- Window title --
function updateWindowTitle() {
  const dirty = isModified ? '* ' : '';
  const name = currentFile ? currentFile.split(/[/\\]/).pop() : 'Untitled';
  document.title = `${dirty}${name} — MarkLight`;
}

// -- Editor events --
editor.addEventListener('input', () => {
  isModified = true;
  updateStatusBar();
  renderMarkdown();
});

editor.addEventListener('click', updateCursorInfo);
editor.addEventListener('keyup', updateCursorInfo);

// Scroll sync: line numbers
editor.addEventListener('scroll', () => {
  lineNumbers.style.transform = `translateY(${-editor.scrollTop}px)`;
});

// -- Tab key support --
editor.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault();
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    editor.value = editor.value.substring(0, start) + '    ' + editor.value.substring(end);
    editor.selectionStart = editor.selectionEnd = start + 4;
    editor.dispatchEvent(new Event('input'));
  }
});

// -- Keyboard shortcuts --
document.addEventListener('keydown', (e) => {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const mod = isMac ? e.metaKey : e.ctrlKey;

  if (mod && e.key === 's') {
    e.preventDefault();
    e.shiftKey ? handleSaveAs() : handleSave();
  } else if (mod && e.key === 'o') {
    e.preventDefault();
    handleOpen();
  } else if (mod && e.key === 'n') {
    e.preventDefault();
    handleNew();
  } else if (mod && e.key === 'p') {
    e.preventDefault();
    togglePreview();
  } else if (mod && e.key === 'l') {
    e.preventDefault();
    toggleLineNumbers();
  }
});

// -- Menu handler (from Rust) --
window.__handleMenu = (action) => {
  switch (action) {
    case 'new': handleNew(); break;
    case 'open': handleOpen(); break;
    case 'save': handleSave(); break;
    case 'save_as': handleSaveAs(); break;
    case 'select_all': editor.select(); break;
    case 'toggle_preview': togglePreview(); break;
    case 'toggle_line_numbers': toggleLineNumbers(); break;
    case 'layout_split': setViewMode('split'); break;
    case 'layout_editor': setViewMode('editor'); break;
    case 'layout_preview': setViewMode('preview'); break;
    case 'theme_light': setTheme('light'); break;
    case 'theme_dark': setTheme('dark'); break;
    case 'theme_system': setTheme('system'); break;
  }
};

// -- View modes --
function setViewMode(mode) {
  viewMode = mode;
  document.getElementById('editor-pane').style.flex = '';
  document.getElementById('preview-pane').style.flex = '';
  container.classList.remove('view-editor', 'view-preview');
  if (mode === 'editor') container.classList.add('view-editor');
  if (mode === 'preview') container.classList.add('view-preview');
}

function togglePreview() {
  if (viewMode === 'split') {
    setViewMode('editor');
  } else {
    setViewMode('split');
  }
}

// -- Line numbers toggle --
function toggleLineNumbers() {
  lineNumbersVisible = !lineNumbersVisible;
  container.classList.toggle('lines-hidden', !lineNumbersVisible);
}

// -- Theme system --
function setTheme(t) {
  theme = t;
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('marklight-theme', t);
}

// -- File operations via Tauri Dialog plugin --
async function handleOpen() {
  if (isModified && !confirm('Discard unsaved changes?')) return;

  const { open } = window.__TAURI__.dialog;
  const selected = await open({
    multiple: false,
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }]
  });

  if (selected) {
    const { readTextFile } = window.__TAURI__.fs;
    const content = await readTextFile(selected);
    editor.value = content;
    currentFile = selected;
    isModified = false;
    updateStatusBar();
    renderMarkdown();
  }
}

async function handleSave() {
  if (!currentFile) {
    await handleSaveAs();
    return;
  }
  const { writeTextFile } = window.__TAURI__.fs;
  await writeTextFile(currentFile, editor.value);
  isModified = false;
  updateStatusBar();
}

async function handleSaveAs() {
  const { save } = window.__TAURI__.dialog;
  const selected = await save({
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown', 'txt'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (selected) {
    const { writeTextFile } = window.__TAURI__.fs;
    await writeTextFile(selected, editor.value);
    currentFile = selected;
    isModified = false;
    updateStatusBar();
  }
}

function handleNew() {
  if (isModified && !confirm('Discard unsaved changes?')) return;
  editor.value = '';
  currentFile = null;
  isModified = false;
  updateStatusBar();
  renderMarkdown();
}

// -- Divider drag resize with overlay --
let isDragging = false;
divider.addEventListener('mousedown', (e) => {
  isDragging = true;
  divider.style.background = 'var(--accent)';
  dragOverlay.style.display = 'block';
});

document.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  const rect = container.getBoundingClientRect();
  const offset = e.clientX - rect.left;
  const total = rect.width;
  const pct = Math.max(20, Math.min(80, (offset / total) * 100));
  document.getElementById('editor-pane').style.flex = `0 0 ${pct}%`;
  document.getElementById('preview-pane').style.flex = `0 0 ${100 - pct}%`;
});

document.addEventListener('mouseup', () => {
  if (isDragging) {
    isDragging = false;
    divider.style.background = '';
    dragOverlay.style.display = 'none';
  }
});

// -- Window close warning --
window.addEventListener('beforeunload', (e) => {
  if (isModified) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// -- Init --
const savedTheme = localStorage.getItem('marklight-theme') || 'system';
setTheme(savedTheme);
updateStatusBar();
renderMarkdown();
