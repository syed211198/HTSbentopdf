// @ts-nocheck
// TODO: @ALAM - remove ts-nocheck and fix types later, possibly convert this into an npm package

import { PDFDocument, PDFName, PDFString, PDFNumber, PDFArray } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import Sortable from 'sortablejs';
import { createIcons, icons } from 'lucide';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

const modalContainer = document.getElementById('modal-container');

// Destination picking state
let isPickingDestination = false;
let currentPickingCallback = null;
let destinationMarker = null;

function showInputModal(title, fields = [], defaultValues = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'active-modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'modal-content';
    modal.id = 'active-modal';

    const fieldsHTML = fields
      .map((field) => {
        if (field.type === 'text') {
          return `
                            <div class="mb-4">
                                <label class="block text-sm font-medium text-gray-700 mb-2">${field.label}</label>
                                <input type="text" id="modal-${field.name}" value="${escapeHTML(defaultValues[field.name] || '')}" 
                                    class="w-full px-3 py-2 border border-gray-300 rounded-lg" 
                                    placeholder="${field.placeholder || ''}" />
                            </div>
                        `;
        } else if (field.type === 'select') {
          return `
                            <div class="mb-4">
                                <label class="block text-sm font-medium text-gray-700 mb-2">${field.label}</label>
                                <select id="modal-${field.name}" class="w-full px-3 py-2 border border-gray-300 rounded-lg">
                                    ${field.options
                                      .map(
                                        (opt) => `
                                        <option value="${opt.value}" ${defaultValues[field.name] === opt.value ? 'selected' : ''}>
                                            ${opt.label}
                                        </option>
                                    `
                                      )
                                      .join('')}
                                </select>
                                ${field.name === 'color' ? '<input type="color" id="modal-color-picker" class="hidden w-full h-10 mt-2 rounded cursor-pointer border border-gray-300" value="#000000" />' : ''}
                            </div>
                        `;
        } else if (field.type === 'destination') {
          const hasDestination =
            defaultValues.destX !== null && defaultValues.destX !== undefined;
          return `
                            <div class="mb-4">
                                <label class="block text-sm font-medium text-gray-700 mb-2">${field.label}</label>
                                <div class="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
                                    <div class="flex items-center gap-2">
                                        <label class="flex items-center gap-1 text-xs">
                                            <input type="checkbox" id="modal-use-destination" class="w-4 h-4" ${hasDestination ? 'checked' : ''}>
                                            <span>Set custom destination</span>
                                        </label>
                                    </div>
                                    <div id="destination-controls" class="${hasDestination ? '' : 'hidden'} space-y-2">
                                        <div class="grid grid-cols-2 gap-2">
                                            <div>
                                                <label class="text-xs text-gray-600">Page</label>
                                                <input type="number" id="modal-dest-page" min="1" max="${field.maxPages || 1}" value="${defaultValues.destPage || field.page || 1}" 
                                                    class="w-full px-2 py-1 border border-gray-300 rounded text-sm" />
                                            </div>
                                            <div>
                                                <label class="text-xs text-gray-600">Zoom (%)</label>
                                                <select id="modal-dest-zoom" class="w-full px-2 py-1 border border-gray-300 rounded text-sm">
                                                    <option value="">Inherit</option>
                                                    <option value="0">Fit Page</option>
                                                    <option value="50">50%</option>
                                                    <option value="75">75%</option>
                                                    <option value="100">100%</option>
                                                    <option value="125">125%</option>
                                                    <option value="150">150%</option>
                                                    <option value="200">200%</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div class="grid grid-cols-2 gap-2">
                                            <div>
                                                <label class="text-xs text-gray-600">X Position</label>
                                                <input type="number" id="modal-dest-x" value="0" step="10"
                                                    class="w-full px-2 py-1 border border-gray-300 rounded text-sm" />
                                            </div>
                                            <div>
                                                <label class="text-xs text-gray-600">Y Position</label>
                                                <input type="number" id="modal-dest-y" value="0" step="10"
                                                    class="w-full px-2 py-1 border border-gray-300 rounded text-sm" />
                                            </div>
                                        </div>
                                        <button id="modal-pick-destination" class="w-full px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs flex items-center justify-center gap-1">
                                            <i data-lucide="crosshair" class="w-3 h-3"></i> Click on PDF to Pick Location
                                        </button>
                                        <p class="text-xs text-gray-500 italic">Click the button above, then click on the PDF where you want the bookmark to jump to</p>
                                    </div>
                                </div>
                            </div>
                        `;
        } else if (field.type === 'preview') {
          return `
                            <div class="mb-4">
                                <label class="block text-sm font-medium text-gray-700 mb-2">${field.label}</label>
                                <div id="modal-preview" class="style-preview bg-gray-50">
                                    <span id="preview-text" style="font-size: 16px;">Preview Text</span>
                                </div>
                            </div>
                        `;
        }
        return '';
      })
      .join('');

    modal.innerHTML = `
                    <div class="p-6">
                        <h3 class="text-xl font-bold text-gray-800 mb-4">${title}</h3>
                        <div class="mb-6">
                            ${fieldsHTML}
                        </div>
                        <div class="flex gap-2 justify-end">
                            <button id="modal-cancel" class="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300">Cancel</button>
                            <button id="modal-confirm" class="px-4 py-2 rounded bg-blue-500 hover:bg-blue-600 text-white">Confirm</button>
                        </div>
                    </div>
                `;

    overlay.appendChild(modal);
    modalContainer.appendChild(overlay);

    function updatePreview() {
      const previewText = modal.querySelector('#preview-text');
      if (previewText) {
        const titleInput = modal.querySelector('#modal-title');
        const colorSelect = modal.querySelector('#modal-color');
        const styleSelect = modal.querySelector('#modal-style');
        const colorPicker = modal.querySelector('#modal-color-picker');

        const title = titleInput ? titleInput.value : 'Preview Text';
        const color = colorSelect ? colorSelect.value : '';
        const style = styleSelect ? styleSelect.value : '';

        previewText.textContent = title || 'Preview Text';

        const colorMap = {
          red: '#dc2626',
          blue: '#2563eb',
          green: '#16a34a',
          yellow: '#ca8a04',
          purple: '#9333ea',
        };

        // Handle custom color
        if (color === 'custom' && colorPicker) {
          previewText.style.color = colorPicker.value;
        } else {
          previewText.style.color = colorMap[color] || '#000';
        }

        previewText.style.fontWeight =
          style === 'bold' || style === 'bold-italic' ? 'bold' : 'normal';
        previewText.style.fontStyle =
          style === 'italic' || style === 'bold-italic' ? 'italic' : 'normal';
      }
    }

    const titleInput = modal.querySelector('#modal-title');
    const colorSelect = modal.querySelector('#modal-color');
    const styleSelect = modal.querySelector('#modal-style');

    if (titleInput) titleInput.addEventListener('input', updatePreview);

    if (colorSelect) {
      colorSelect.addEventListener('change', (e) => {
        const colorPicker = modal.querySelector('#modal-color-picker');
        if (e.target.value === 'custom' && colorPicker) {
          colorPicker.classList.remove('hidden');
          setTimeout(() => colorPicker.click(), 100);
        } else if (colorPicker) {
          colorPicker.classList.add('hidden');
        }
        updatePreview();
      });
    }

    const colorPicker = modal.querySelector('#modal-color-picker');
    if (colorPicker) {
      colorPicker.addEventListener('input', updatePreview);
    }

    if (styleSelect) styleSelect.addEventListener('change', updatePreview);

    // Destination toggle handler
    const useDestCheckbox = modal.querySelector('#modal-use-destination');
    const destControls = modal.querySelector('#destination-controls');
    const pickDestBtn = modal.querySelector('#modal-pick-destination');

    if (useDestCheckbox && destControls) {
      useDestCheckbox.addEventListener('change', (e) => {
        destControls.classList.toggle('hidden', !e.target.checked);
      });

      // Populate existing destination values
      if (defaultValues.destX !== null && defaultValues.destX !== undefined) {
        const destPageInput = modal.querySelector('#modal-dest-page');
        const destXInput = modal.querySelector('#modal-dest-x');
        const destYInput = modal.querySelector('#modal-dest-y');
        const destZoomSelect = modal.querySelector('#modal-dest-zoom');

        if (destPageInput && defaultValues.destPage !== undefined) {
          destPageInput.value = defaultValues.destPage;
        }
        if (destXInput && defaultValues.destX !== null) {
          destXInput.value = Math.round(defaultValues.destX);
        }
        if (destYInput && defaultValues.destY !== null) {
          destYInput.value = Math.round(defaultValues.destY);
        }
        if (destZoomSelect && defaultValues.zoom !== null) {
          destZoomSelect.value = defaultValues.zoom || '';
        }
      }
    }

    // Visual destination picker
    if (pickDestBtn) {
      pickDestBtn.addEventListener('click', () => {
        startDestinationPicking((page, x, y) => {
          const destPageInput = modal.querySelector('#modal-dest-page');
          const destXInput = modal.querySelector('#modal-dest-x');
          const destYInput = modal.querySelector('#modal-dest-y');

          if (destPageInput) destPageInput.value = page;
          if (destXInput) destXInput.value = Math.round(x);
          if (destYInput) destYInput.value = Math.round(y);

          // Minimize modal to corner
          const modalOverlay = document.getElementById('active-modal-overlay');
          const activeModal = document.getElementById('active-modal');
          if (modalOverlay && activeModal) {
            modalOverlay.style.background = 'transparent';
            modalOverlay.style.pointerEvents = 'none';
            activeModal.classList.add('modal-minimized');
            activeModal.style.pointerEvents = 'auto';
          }
        });
      });
    }

    updatePreview();

    modal.querySelector('#modal-cancel').addEventListener('click', () => {
      cancelDestinationPicking();
      modalContainer.removeChild(overlay);
      resolve(null);
    });

    modal.querySelector('#modal-confirm').addEventListener('click', () => {
      const result = {};
      fields.forEach((field) => {
        if (field.type !== 'preview' && field.type !== 'destination') {
          const input = modal.querySelector(`#modal-${field.name}`);
          result[field.name] = input.value;
        }
      });

      // Handle custom color
      const colorSelect = modal.querySelector('#modal-color');
      const colorPicker = modal.querySelector('#modal-color-picker');
      if (colorSelect && colorSelect.value === 'custom' && colorPicker) {
        result.color = colorPicker.value;
      }

      // Handle destination
      const useDestCheckbox = modal.querySelector('#modal-use-destination');
      if (useDestCheckbox && useDestCheckbox.checked) {
        const destPageInput = modal.querySelector('#modal-dest-page');
        const destXInput = modal.querySelector('#modal-dest-x');
        const destYInput = modal.querySelector('#modal-dest-y');
        const destZoomSelect = modal.querySelector('#modal-dest-zoom');

        result.destPage = destPageInput ? parseInt(destPageInput.value) : null;
        result.destX = destXInput ? parseFloat(destXInput.value) : null;
        result.destY = destYInput ? parseFloat(destYInput.value) : null;
        result.zoom =
          destZoomSelect && destZoomSelect.value ? destZoomSelect.value : null;
      } else {
        result.destPage = null;
        result.destX = null;
        result.destY = null;
        result.zoom = null;
      }

      cancelDestinationPicking();
      modalContainer.removeChild(overlay);
      resolve(result);
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        cancelDestinationPicking();
        modalContainer.removeChild(overlay);
        resolve(null);
      }
    });

    setTimeout(() => {
      const firstInput = modal.querySelector('input, select');
      if (firstInput) firstInput.focus();
    }, 0);

    createIcons({ icons });
  });
}
// Destination picking functions
function startDestinationPicking(callback) {
  isPickingDestination = true;
  currentPickingCallback = callback;

  const canvasWrapper = document.getElementById('pdf-canvas-wrapper');
  const pickingBanner = document.getElementById('picking-mode-banner');

  canvasWrapper.classList.add('picking-mode');
  pickingBanner.classList.remove('hidden');

  // Switch to viewer on mobile
  if (window.innerWidth < 1024) {
    document.getElementById('show-viewer-btn').click();
  }

  createIcons({ icons });
}

function cancelDestinationPicking() {
  isPickingDestination = false;
  currentPickingCallback = null;

  const canvasWrapper = document.getElementById('pdf-canvas-wrapper');
  const pickingBanner = document.getElementById('picking-mode-banner');

  canvasWrapper.classList.remove('picking-mode');
  pickingBanner.classList.add('hidden');

  // Remove any existing marker
  if (destinationMarker) {
    destinationMarker.remove();
    destinationMarker = null;
  }

  // Restore modal if minimized
  const modalOverlay = document.getElementById('active-modal-overlay');
  const activeModal = document.getElementById('active-modal');
  if (modalOverlay && activeModal) {
    modalOverlay.style.background = 'rgba(0, 0, 0, 0.5)';
    modalOverlay.style.pointerEvents = 'auto';
    activeModal.classList.remove('modal-minimized');
  }
}

// Setup canvas click handler for destination picking
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('pdf-canvas');
  const canvasWrapper = document.getElementById('pdf-canvas-wrapper');
  const cancelPickingBtn = document.getElementById('cancel-picking-btn');

  // Coordinate tooltip
  let coordTooltip = null;

  canvasWrapper.addEventListener('mousemove', (e) => {
    if (!isPickingDestination) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Create or update tooltip
    if (!coordTooltip) {
      coordTooltip = document.createElement('div');
      coordTooltip.className = 'coordinate-tooltip';
      canvasWrapper.appendChild(coordTooltip);
    }

    coordTooltip.textContent = `X: ${Math.round(x)}, Y: ${Math.round(y)}`;
    coordTooltip.style.left = e.clientX - rect.left + 15 + 'px';
    coordTooltip.style.top = e.clientY - rect.top + 15 + 'px';
  });

  canvasWrapper.addEventListener('mouseleave', () => {
    if (coordTooltip) {
      coordTooltip.remove();
      coordTooltip = null;
    }
  });

  canvas.addEventListener('click', (e) => {
    if (!isPickingDestination || !currentPickingCallback) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Remove old marker
    if (destinationMarker) {
      destinationMarker.remove();
    }

    // Create visual marker
    destinationMarker = document.createElement('div');
    destinationMarker.className = 'destination-marker';
    destinationMarker.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2">
                        <circle cx="12" cy="12" r="10" fill="#3b82f6" fill-opacity="0.2"/>
                        <path d="M12 2 L12 22 M2 12 L22 12"/>
                        <circle cx="12" cy="12" r="2" fill="#3b82f6"/>
                    </svg>
                `;
    destinationMarker.style.left =
      x + rect.left - canvasWrapper.offsetLeft + 'px';
    destinationMarker.style.top = y + rect.top - canvasWrapper.offsetTop + 'px';
    canvasWrapper.appendChild(destinationMarker);

    // Call callback with coordinates
    currentPickingCallback(currentPage, x, y);

    // End picking mode
    setTimeout(() => {
      cancelDestinationPicking();
    }, 500);
  });

  if (cancelPickingBtn) {
    cancelPickingBtn.addEventListener('click', () => {
      cancelDestinationPicking();
    });
  }
});

function showConfirmModal(message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'modal-content';

    modal.innerHTML = `
                    <div class="p-6">
                        <h3 class="text-xl font-bold text-gray-800 mb-4">Confirm Action</h3>
                        <p class="text-gray-600 mb-6">${message}</p>
                        <div class="flex gap-2 justify-end">
                            <button id="modal-cancel" class="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300">Cancel</button>
                            <button id="modal-confirm" class="px-4 py-2 rounded bg-blue-500 hover:bg-blue-600 text-white">Confirm</button>
                        </div>
                    </div>
                `;

    overlay.appendChild(modal);
    modalContainer.appendChild(overlay);

    modal.querySelector('#modal-cancel').addEventListener('click', () => {
      modalContainer.removeChild(overlay);
      resolve(false);
    });

    modal.querySelector('#modal-confirm').addEventListener('click', () => {
      modalContainer.removeChild(overlay);
      resolve(true);
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        modalContainer.removeChild(overlay);
        resolve(false);
      }
    });
  });
}

function showAlertModal(title, message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'modal-content';

    modal.innerHTML = `
                    <div class="p-6">
                        <h3 class="text-xl font-bold text-gray-800 mb-4">${title}</h3>
                        <p class="text-gray-600 mb-6">${message}</p>
                        <div class="flex justify-end">
                            <button id="modal-ok" class="px-4 py-2 rounded bg-blue-500 hover:bg-blue-600 text-white">OK</button>
                        </div>
                    </div>
                `;

    overlay.appendChild(modal);
    modalContainer.appendChild(overlay);

    modal.querySelector('#modal-ok').addEventListener('click', () => {
      modalContainer.removeChild(overlay);
      resolve(true);
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        modalContainer.removeChild(overlay);
        resolve(true);
      }
    });
  });
}

const fileInput = document.getElementById('file-input');
const csvInput = document.getElementById('csv-input');
const jsonInput = document.getElementById('json-input');
const autoExtractCheckbox = document.getElementById('auto-extract-checkbox');
const appEl = document.getElementById('app');
const uploaderEl = document.getElementById('uploader');
const canvas = document.getElementById('pdf-canvas');
const ctx = canvas.getContext('2d');
const pageIndicator = document.getElementById('page-indicator');
const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');
const gotoPageInput = document.getElementById('goto-page');
const gotoBtn = document.getElementById('goto-btn');
const addTopLevelBtn = document.getElementById('add-top-level-btn');
const titleInput = document.getElementById('bookmark-title');
const treeList = document.getElementById('bookmark-tree-list');
const noBookmarksEl = document.getElementById('no-bookmarks');
const downloadBtn = document.getElementById('download-btn');
const undoBtn = document.getElementById('undo-btn');
const redoBtn = document.getElementById('redo-btn');
const resetBtn = document.getElementById('reset-btn');
const deleteAllBtn = document.getElementById('delete-all-btn');
const searchInput = document.getElementById('search-bookmarks');
const importDropdownBtn = document.getElementById('import-dropdown-btn');
const exportDropdownBtn = document.getElementById('export-dropdown-btn');
const importDropdown = document.getElementById('import-dropdown');
const exportDropdown = document.getElementById('export-dropdown');
const importCsvBtn = document.getElementById('import-csv-btn');
const exportCsvBtn = document.getElementById('export-csv-btn');
const importJsonBtn = document.getElementById('import-json-btn');
const exportJsonBtn = document.getElementById('export-json-btn');
const csvImportHidden = document.getElementById('csv-import-hidden');
const jsonImportHidden = document.getElementById('json-import-hidden');
const extractExistingBtn = document.getElementById('extract-existing-btn');
const currentPageDisplay = document.getElementById('current-page-display');
const filenameDisplay = document.getElementById('filename-display');
const batchModeCheckbox = document.getElementById('batch-mode-checkbox');
const batchOperations = document.getElementById('batch-operations');
const selectedCountDisplay = document.getElementById('selected-count');
const batchColorSelect = document.getElementById('batch-color-select');
const batchStyleSelect = document.getElementById('batch-style-select');
const batchDeleteBtn = document.getElementById('batch-delete-btn');
const selectAllBtn = document.getElementById('select-all-btn');
const deselectAllBtn = document.getElementById('deselect-all-btn');
const expandAllBtn = document.getElementById('expand-all-btn');
const collapseAllBtn = document.getElementById('collapse-all-btn');

const showViewerBtn = document.getElementById('show-viewer-btn');
const showBookmarksBtn = document.getElementById('show-bookmarks-btn');
const viewerSection = document.getElementById('viewer-section');
const bookmarksSection = document.getElementById('bookmarks-section');

// Handle responsive view switching
function handleResize() {
  if (window.innerWidth >= 1024) {
    viewerSection.classList.remove('hidden');
    bookmarksSection.classList.remove('hidden');
    showViewerBtn.classList.remove('bg-blue-50', 'text-blue-600');
    showBookmarksBtn.classList.remove('bg-blue-50', 'text-blue-600');
  }
}

window.addEventListener('resize', handleResize);

showViewerBtn.addEventListener('click', () => {
  viewerSection.classList.remove('hidden');
  bookmarksSection.classList.add('hidden');
  showViewerBtn.classList.add('bg-blue-50', 'text-blue-600');
  showBookmarksBtn.classList.remove('bg-blue-50', 'text-blue-600');
});

showBookmarksBtn.addEventListener('click', () => {
  viewerSection.classList.add('hidden');
  bookmarksSection.classList.remove('hidden');
  showBookmarksBtn.classList.add('bg-blue-50', 'text-blue-600');
  showViewerBtn.classList.remove('bg-blue-50', 'text-blue-600');
});

// Dropdown toggles
importDropdownBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  importDropdown.classList.toggle('hidden');
  exportDropdown.classList.add('hidden');
});

exportDropdownBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  exportDropdown.classList.toggle('hidden');
  importDropdown.classList.add('hidden');
});

document.addEventListener('click', () => {
  importDropdown.classList.add('hidden');
  exportDropdown.classList.add('hidden');
});

let pdfLibDoc = null;
let pdfJsDoc = null;
let currentPage = 1;
let originalFileName = '';
let bookmarkTree = [];
let history = [];
let historyIndex = -1;
let searchQuery = '';
let csvBookmarks = null;
let jsonBookmarks = null;
let batchMode = false;
let selectedBookmarks = new Set();
let collapsedNodes = new Set();

const colorClasses = {
  red: 'bg-red-100 border-red-300',
  blue: 'bg-blue-100 border-blue-300',
  green: 'bg-green-100 border-green-300',
  yellow: 'bg-yellow-100 border-yellow-300',
  purple: 'bg-purple-100 border-purple-300',
};

function saveState() {
  history = history.slice(0, historyIndex + 1);
  history.push(JSON.parse(JSON.stringify(bookmarkTree)));
  historyIndex++;
  updateUndoRedoButtons();
}

function undo() {
  if (historyIndex > 0) {
    historyIndex--;
    bookmarkTree = JSON.parse(JSON.stringify(history[historyIndex]));
    renderBookmarkTree();
    updateUndoRedoButtons();
  }
}

function redo() {
  if (historyIndex < history.length - 1) {
    historyIndex++;
    bookmarkTree = JSON.parse(JSON.stringify(history[historyIndex]));
    renderBookmarkTree();
    updateUndoRedoButtons();
  }
}

function updateUndoRedoButtons() {
  undoBtn.disabled = historyIndex <= 0;
  redoBtn.disabled = historyIndex >= history.length - 1;
}

undoBtn.addEventListener('click', undo);
redoBtn.addEventListener('click', redo);

// Reset button - goes back to uploader
resetBtn.addEventListener('click', async () => {
  const confirmed = await showConfirmModal(
    'Reset and go back to file uploader? All unsaved changes will be lost.'
  );
  if (confirmed) {
    resetToUploader();
  }
});

// Delete all bookmarks button
deleteAllBtn.addEventListener('click', async () => {
  if (bookmarkTree.length === 0) {
    await showAlertModal('Info', 'No bookmarks to delete.');
    return;
  }

  const confirmed = await showConfirmModal(
    `Delete all ${bookmarkTree.length} bookmark(s)?`
  );
  if (confirmed) {
    bookmarkTree = [];
    selectedBookmarks.clear();
    updateSelectedCount();
    saveState();
    renderBookmarkTree();
  }
});

function resetToUploader() {
  pdfLibDoc = null;
  pdfJsDoc = null;
  currentPage = 1;
  originalFileName = '';
  bookmarkTree = [];
  history = [];
  historyIndex = -1;
  searchQuery = '';
  csvBookmarks = null;
  jsonBookmarks = null;
  batchMode = false;
  selectedBookmarks.clear();
  collapsedNodes.clear();

  fileInput.value = '';
  csvInput.value = '';
  jsonInput.value = '';

  appEl.classList.add('hidden');
  uploaderEl.classList.remove('hidden');

  // Reset mobile view
  viewerSection.classList.remove('hidden');
  bookmarksSection.classList.add('hidden');
  showViewerBtn.classList.add('bg-blue-50', 'text-blue-600');
  showBookmarksBtn.classList.remove('bg-blue-50', 'text-blue-600');
}

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey) {
    if (e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo();
    } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
      e.preventDefault();
      redo();
    }
  }
});

batchModeCheckbox.addEventListener('change', (e) => {
  batchMode = e.target.checked;
  if (!batchMode) {
    selectedBookmarks.clear();
    updateSelectedCount();
  }
  batchOperations.classList.toggle(
    'hidden',
    !batchMode || selectedBookmarks.size === 0
  );
  renderBookmarkTree();
});

function updateSelectedCount() {
  selectedCountDisplay.textContent = selectedBookmarks.size;
  if (batchMode) {
    batchOperations.classList.toggle('hidden', selectedBookmarks.size === 0);
  }
}

selectAllBtn.addEventListener('click', () => {
  const getAllIds = (nodes) => {
    let ids = [];
    nodes.forEach((node) => {
      ids.push(node.id);
      if (node.children.length > 0) {
        ids = ids.concat(getAllIds(node.children));
      }
    });
    return ids;
  };

  getAllIds(bookmarkTree).forEach((id) => selectedBookmarks.add(id));
  updateSelectedCount();
  renderBookmarkTree();
});

deselectAllBtn.addEventListener('click', () => {
  selectedBookmarks.clear();
  updateSelectedCount();
  renderBookmarkTree();
});

batchColorSelect.addEventListener('change', (e) => {
  if (e.target.value && selectedBookmarks.size > 0) {
    const color = e.target.value === 'null' ? null : e.target.value;
    applyToSelected((node) => (node.color = color));
    e.target.value = '';
  }
});

batchStyleSelect.addEventListener('change', (e) => {
  if (e.target.value && selectedBookmarks.size > 0) {
    const style = e.target.value === 'null' ? null : e.target.value;
    applyToSelected((node) => (node.style = style));
    e.target.value = '';
  }
});

batchDeleteBtn.addEventListener('click', async () => {
  if (selectedBookmarks.size === 0) return;

  const confirmed = await showConfirmModal(
    `Delete ${selectedBookmarks.size} bookmark(s)?`
  );
  if (!confirmed) return;

  const remove = (nodes) => {
    return nodes.filter((node) => {
      if (selectedBookmarks.has(node.id)) return false;
      node.children = remove(node.children);
      return true;
    });
  };

  bookmarkTree = remove(bookmarkTree);
  selectedBookmarks.clear();
  updateSelectedCount();
  saveState();
  renderBookmarkTree();
});

function applyToSelected(fn) {
  const update = (nodes) => {
    return nodes.map((node) => {
      if (selectedBookmarks.has(node.id)) {
        fn(node);
      }
      node.children = update(node.children);
      return node;
    });
  };

  bookmarkTree = update(bookmarkTree);
  saveState();
  renderBookmarkTree();
}

expandAllBtn.addEventListener('click', () => {
  collapsedNodes.clear();
  renderBookmarkTree();
});

collapseAllBtn.addEventListener('click', () => {
  const collapseAll = (nodes) => {
    nodes.forEach((node) => {
      if (node.children.length > 0) {
        collapsedNodes.add(node.id);
        collapseAll(node.children);
      }
    });
  };
  collapseAll(bookmarkTree);
  renderBookmarkTree();
});

fileInput.addEventListener('change', loadPDF);

async function loadPDF(e) {
  const file = e ? e.target.files[0] : fileInput.files[0];
  if (!file) return;

  originalFileName = file.name.replace('.pdf', '');
  filenameDisplay.textContent = originalFileName;
  const arrayBuffer = await file.arrayBuffer();

  currentPage = 1;
  bookmarkTree = [];
  history = [];
  historyIndex = -1;
  selectedBookmarks.clear();
  collapsedNodes.clear();

  pdfLibDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
  });
  pdfJsDoc = await loadingTask.promise;

  gotoPageInput.max = pdfJsDoc.numPages;

  appEl.classList.remove('hidden');
  uploaderEl.classList.add('hidden');

  if (autoExtractCheckbox.checked) {
    const extracted = await extractExistingBookmarks(pdfLibDoc);
    if (extracted.length > 0) {
      bookmarkTree = extracted;
    }
  }

  if (csvBookmarks) {
    bookmarkTree = csvBookmarks;
    csvBookmarks = null;
  } else if (jsonBookmarks) {
    bookmarkTree = jsonBookmarks;
    jsonBookmarks = null;
  }

  saveState();
  renderBookmarkTree();
  renderPage(currentPage);
  createIcons({ icons });
}

csvInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const text = await file.text();
  csvBookmarks = parseCSV(text);

  await showAlertModal(
    'CSV Loaded',
    `Loaded ${csvBookmarks.length} bookmarks from CSV. Now upload your PDF.`
  );
});

jsonInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const text = await file.text();
  try {
    jsonBookmarks = JSON.parse(text);
    await showAlertModal(
      'JSON Loaded',
      'Loaded bookmarks from JSON. Now upload your PDF.'
    );
  } catch (err) {
    await showAlertModal('Error', 'Invalid JSON format');
  }
});

async function renderPage(num) {
  if (!pdfJsDoc) return;

  const page = await pdfJsDoc.getPage(num);
  const viewport = page.getViewport({ scale: 1.5 });

  canvas.height = viewport.height;
  canvas.width = viewport.width;

  await page.render({ canvasContext: ctx, viewport: viewport }).promise;

  pageIndicator.textContent = `Page ${num} / ${pdfJsDoc.numPages}`;
  gotoPageInput.value = num;
  currentPage = num;
  currentPageDisplay.textContent = num;
}

prevPageBtn.addEventListener('click', () => {
  if (currentPage > 1) renderPage(currentPage - 1);
});

nextPageBtn.addEventListener('click', () => {
  if (currentPage < pdfJsDoc.numPages) renderPage(currentPage + 1);
});

gotoBtn.addEventListener('click', () => {
  const page = parseInt(gotoPageInput.value);
  if (page >= 1 && page <= pdfJsDoc.numPages) {
    renderPage(page);
  }
});

gotoPageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') gotoBtn.click();
});

searchInput.addEventListener('input', (e) => {
  searchQuery = e.target.value.toLowerCase();
  renderBookmarkTree();
});

function removeNodeById(nodes, id) {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].id === id) {
      nodes.splice(i, 1);
      return true;
    }
    if (removeNodeById(nodes[i].children, id)) return true;
  }
  return false;
}

function flattenBookmarks(nodes, level = 0) {
  let result = [];
  for (const node of nodes) {
    result.push({ ...node, level });
    if (node.children.length > 0) {
      result = result.concat(flattenBookmarks(node.children, level + 1));
    }
  }
  return result;
}

function matchesSearch(node, query) {
  if (!query) return true;
  if (node.title.toLowerCase().includes(query)) return true;
  return node.children.some((child) => matchesSearch(child, query));
}

function makeSortable(element, parentNode = null, isTopLevel = false) {
  new Sortable(element, {
    group: isTopLevel
      ? 'top-level-only'
      : 'nested-level-' + (parentNode ? parentNode.id : 'none'),
    animation: 150,
    handle: '[data-drag-handle]',
    ghostClass: 'sortable-ghost',
    dragClass: 'sortable-drag',
    forceFallback: true,
    fallbackTolerance: 3,
    onEnd: function (evt) {
      try {
        if (evt.oldIndex === evt.newIndex) {
          renderBookmarkTree();
          return;
        }

        const treeCopy = JSON.parse(JSON.stringify(bookmarkTree));

        if (isTopLevel) {
          const movedItem = treeCopy.splice(evt.oldIndex, 1)[0];
          treeCopy.splice(evt.newIndex, 0, movedItem);
          bookmarkTree = treeCopy;
        } else if (parentNode) {
          const parent = findNodeInTree(treeCopy, parentNode.id);
          if (parent && parent.children) {
            const movedChild = parent.children.splice(evt.oldIndex, 1)[0];
            parent.children.splice(evt.newIndex, 0, movedChild);
            bookmarkTree = treeCopy;
          } else {
            renderBookmarkTree();
            return;
          }
        }

        saveState();
        renderBookmarkTree();
      } catch (err) {
        console.error('Error in drag and drop:', err);
        if (historyIndex > 0) {
          bookmarkTree = JSON.parse(JSON.stringify(history[historyIndex]));
        }
        renderBookmarkTree();
      }
    },
  });
}

function findNodeInTree(nodes, id) {
  if (!nodes || !Array.isArray(nodes)) return null;

  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    if (node.children && node.children.length > 0) {
      const found = findNodeInTree(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

function getStyleClasses(style) {
  if (style === 'bold') return 'font-bold';
  if (style === 'italic') return 'italic';
  if (style === 'bold-italic') return 'font-bold italic';
  return '';
}

function getTextColor(color) {
  if (!color) return '';

  // Custom hex colors will use inline styles instead
  if (color.startsWith('#')) {
    return '';
  }

  const colorMap = {
    red: 'text-red-600',
    blue: 'text-blue-600',
    green: 'text-green-600',
    yellow: 'text-yellow-600',
    purple: 'text-purple-600',
  };
  return colorMap[color] || '';
}

function renderBookmarkTree() {
  treeList.innerHTML = '';
  const filtered = searchQuery
    ? bookmarkTree.filter((n) => matchesSearch(n, searchQuery))
    : bookmarkTree;

  if (filtered.length === 0) {
    noBookmarksEl.classList.remove('hidden');
  } else {
    noBookmarksEl.classList.add('hidden');
    for (const node of filtered) {
      treeList.appendChild(createNodeElement(node));
    }
    makeSortable(treeList, null, true);
  }

  createIcons({ icons });
  updateSelectedCount();
}

function createNodeElement(node, level = 0) {
  if (!node || !node.id) {
    console.error('Invalid node:', node);
    return document.createElement('li');
  }

  const li = document.createElement('li');
  li.dataset.bookmarkId = node.id;
  li.className = 'group';

  const hasChildren =
    node.children && Array.isArray(node.children) && node.children.length > 0;
  const isCollapsed = collapsedNodes.has(node.id);
  const isSelected = selectedBookmarks.has(node.id);
  const isMatch =
    !searchQuery || node.title.toLowerCase().includes(searchQuery);
  const highlight = isMatch && searchQuery ? 'bg-yellow-100' : '';
  const colorClass = node.color ? colorClasses[node.color] || '' : '';
  const styleClass = getStyleClasses(node.style);
  const textColorClass = getTextColor(node.color);

  const div = document.createElement('div');
  div.className = `flex items-center gap-2 p-2 rounded border border-grey-200 ${colorClass} ${highlight} ${isSelected ? 'ring-2 ring-blue-500' : ''} hover:bg-gray-50`;

  if (batchMode) {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = isSelected;
    checkbox.className = 'w-4 h-4 flex-shrink-0';
    checkbox.addEventListener('click', (e) => {
      e.stopPropagation();
      if (selectedBookmarks.has(node.id)) {
        selectedBookmarks.delete(node.id);
      } else {
        selectedBookmarks.add(node.id);
      }
      updateSelectedCount();
      checkbox.checked = selectedBookmarks.has(node.id);
      batchOperations.classList.toggle(
        'hidden',
        !batchMode || selectedBookmarks.size === 0
      );
    });
    div.appendChild(checkbox);
  }

  const dragHandle = document.createElement('div');
  dragHandle.dataset.dragHandle = 'true';
  dragHandle.className = 'cursor-move flex-shrink-0';
  dragHandle.innerHTML =
    '<i data-lucide="grip-vertical" class="w-4 h-4 text-gray-400"></i>';
  div.appendChild(dragHandle);

  if (hasChildren) {
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'p-0 flex-shrink-0';
    toggleBtn.innerHTML = isCollapsed
      ? '<i data-lucide="chevron-right" class="w-4 h-4"></i>'
      : '<i data-lucide="chevron-down" class="w-4 h-4"></i>';
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (collapsedNodes.has(node.id)) {
        collapsedNodes.delete(node.id);
      } else {
        collapsedNodes.add(node.id);
      }
      renderBookmarkTree();
    });
    div.appendChild(toggleBtn);
  } else {
    const spacer = document.createElement('div');
    spacer.className = 'w-4 flex-shrink-0';
    div.appendChild(spacer);
  }

  const titleDiv = document.createElement('div');
  titleDiv.className = 'flex-1 min-w-0 cursor-pointer';
  const customColorStyle =
    node.color && node.color.startsWith('#')
      ? `style="color: ${node.color}"`
      : '';
  const hasDestination =
    node.destX !== null || node.destY !== null || node.zoom !== null;
  const destinationIcon = hasDestination
    ? '<i data-lucide="crosshair" class="w-3 h-3 inline-block ml-1 text-blue-500"></i>'
    : '';

  titleDiv.innerHTML = `
                <span class="text-sm block ${styleClass} ${textColorClass}" ${customColorStyle}>${escapeHTML(node.title)}${destinationIcon}</span>
                <span class="text-xs text-gray-500">Page ${node.page}</span>
            `;

  titleDiv.addEventListener('click', () => {
    renderPage(node.page);
    if (window.innerWidth < 1024) {
      showViewerBtn.click();
    }
  });
  div.appendChild(titleDiv);

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'flex gap-1 flex-shrink-0';

  const addChildBtn = document.createElement('button');
  addChildBtn.className = 'p-1 hover:bg-gray-200 rounded';
  addChildBtn.title = 'Add child';
  addChildBtn.innerHTML = '<i data-lucide="plus" class="w-4 h-4"></i>';
  addChildBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const result = await showInputModal('Add Child Bookmark', [
      {
        type: 'text',
        name: 'title',
        label: 'Title',
        placeholder: 'Enter bookmark title',
      },
    ]);
    if (result && result.title) {
      node.children.push({
        id: Date.now() + Math.random(),
        title: result.title,
        page: currentPage,
        children: [],
        color: null,
        style: null,
        destX: null,
        destY: null,
        zoom: null,
      });
      collapsedNodes.delete(node.id);
      saveState();
      renderBookmarkTree();
    }
  });
  actionsDiv.appendChild(addChildBtn);

  const editBtn = document.createElement('button');
  editBtn.className = 'p-1 hover:bg-gray-200 rounded';
  editBtn.title = 'Edit';
  editBtn.innerHTML = '<i data-lucide="edit-2" class="w-4 h-4"></i>';
  editBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const result = await showInputModal(
      'Edit Bookmark',
      [
        {
          type: 'text',
          name: 'title',
          label: 'Title',
          placeholder: 'Enter bookmark title',
        },
        {
          type: 'select',
          name: 'color',
          label: 'Color',
          options: [
            { value: '', label: 'None' },
            { value: 'red', label: 'Red' },
            { value: 'blue', label: 'Blue' },
            { value: 'green', label: 'Green' },
            { value: 'yellow', label: 'Yellow' },
            { value: 'purple', label: 'Purple' },
            { value: 'custom', label: 'Custom...' },
          ],
        },
        {
          type: 'select',
          name: 'style',
          label: 'Style',
          options: [
            { value: '', label: 'Normal' },
            { value: 'bold', label: 'Bold' },
            { value: 'italic', label: 'Italic' },
            { value: 'bold-italic', label: 'Bold & Italic' },
          ],
        },
        {
          type: 'destination',
          label: 'Destination',
          page: node.page,
          maxPages: pdfJsDoc ? pdfJsDoc.numPages : 1,
        },
        { type: 'preview', label: 'Preview' },
      ],
      {
        title: node.title,
        color: node.color || '',
        style: node.style || '',
        destPage: node.page,
        destX: node.destX,
        destY: node.destY,
        zoom: node.zoom,
      }
    );

    if (result) {
      node.title = result.title;
      node.color = result.color || null;
      node.style = result.style || null;

      // Update destination
      if (result.destPage !== null && result.destPage !== undefined) {
        node.page = result.destPage;
        node.destX = result.destX;
        node.destY = result.destY;
        node.zoom = result.zoom;
      }

      saveState();
      renderBookmarkTree();
    }
  });
  actionsDiv.appendChild(editBtn);

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'p-1 hover:bg-gray-200 rounded text-red-600';
  deleteBtn.title = 'Delete';
  deleteBtn.innerHTML = '<i data-lucide="trash-2" class="w-4 h-4"></i>';
  deleteBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const confirmed = await showConfirmModal(`Delete "${node.title}"?`);
    if (confirmed) {
      removeNodeById(bookmarkTree, node.id);
      saveState();
      renderBookmarkTree();
    }
  });
  actionsDiv.appendChild(deleteBtn);

  div.appendChild(actionsDiv);
  li.appendChild(div);

  if (hasChildren && !isCollapsed) {
    const childContainer = document.createElement('ul');
    childContainer.className = 'child-container space-y-2';

    const nodeCopy = JSON.parse(JSON.stringify(node));

    for (const child of node.children) {
      if (child && child.id) {
        childContainer.appendChild(createNodeElement(child, level + 1));
      }
    }
    li.appendChild(childContainer);

    makeSortable(childContainer, nodeCopy, false);
  }

  return li;
}

addTopLevelBtn.addEventListener('click', async () => {
  const title = titleInput.value.trim();
  if (!title) {
    await showAlertModal('Error', 'Please enter a title.');
    return;
  }

  bookmarkTree.push({
    id: Date.now(),
    title: title,
    page: currentPage,
    children: [],
    color: null,
    style: null,
    destX: null,
    destY: null,
    zoom: null,
  });

  saveState();
  renderBookmarkTree();
  titleInput.value = '';
});

titleInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') addTopLevelBtn.click();
});

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

importCsvBtn.addEventListener('click', () => {
  csvImportHidden.click();
  importDropdown.classList.add('hidden');
});

csvImportHidden.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const text = await file.text();
  const imported = parseCSV(text);

  if (imported.length > 0) {
    bookmarkTree = imported;
    saveState();
    renderBookmarkTree();
    await showAlertModal('Success', `Imported ${imported.length} bookmarks!`);
  }

  csvImportHidden.value = '';
});

exportCsvBtn.addEventListener('click', () => {
  exportDropdown.classList.add('hidden');

  if (bookmarkTree.length === 0) {
    showAlertModal('Error', 'No bookmarks to export!');
    return;
  }

  const flat = flattenBookmarks(bookmarkTree);
  const csv =
    'title,page,level\n' +
    flat
      .map((b) => `"${b.title.replace(/"/g, '""')}",${b.page},${b.level}`)
      .join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${originalFileName}-bookmarks.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

function parseCSV(text) {
  const lines = text.trim().split('\n').slice(1);
  const bookmarks = [];
  const stack = [{ children: bookmarks, level: -1 }];

  for (const line of lines) {
    const match =
      line.match(/^"(.+)",(\d+),(\d+)$/) || line.match(/^([^,]+),(\d+),(\d+)$/);
    if (!match) continue;

    const [, title, page, level] = match;
    const bookmark = {
      id: Date.now() + Math.random(),
      title: title.replace(/""/g, '"'),
      page: parseInt(page),
      children: [],
      color: null,
      style: null,
      destX: null,
      destY: null,
      zoom: null,
    };

    const lvl = parseInt(level);
    while (stack[stack.length - 1].level >= lvl) stack.pop();
    stack[stack.length - 1].children.push(bookmark);
    stack.push({ ...bookmark, level: lvl });
  }

  return bookmarks;
}

importJsonBtn.addEventListener('click', () => {
  jsonImportHidden.click();
  importDropdown.classList.add('hidden');
});

jsonImportHidden.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const text = await file.text();
  try {
    const imported = JSON.parse(text);
    bookmarkTree = imported;
    saveState();
    renderBookmarkTree();
    await showAlertModal('Success', 'Bookmarks imported from JSON!');
  } catch (err) {
    await showAlertModal('Error', 'Invalid JSON format');
  }

  jsonImportHidden.value = '';
});

exportJsonBtn.addEventListener('click', () => {
  exportDropdown.classList.add('hidden');

  if (bookmarkTree.length === 0) {
    showAlertModal('Error', 'No bookmarks to export!');
    return;
  }

  const json = JSON.stringify(bookmarkTree, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${originalFileName}-bookmarks.json`;
  a.click();
  URL.revokeObjectURL(url);
});

extractExistingBtn.addEventListener('click', async () => {
  if (!pdfLibDoc) return;

  const extracted = await extractExistingBookmarks(pdfLibDoc);
  if (extracted.length > 0) {
    const confirmed = await showConfirmModal(
      `Found ${extracted.length} existing bookmarks. Replace current bookmarks?`
    );
    if (confirmed) {
      bookmarkTree = extracted;
      saveState();
      renderBookmarkTree();
    }
  } else {
    await showAlertModal('Info', 'No existing bookmarks found in this PDF.');
  }
});

async function extractExistingBookmarks(doc) {
  try {
    const outlines = doc.catalog.lookup(PDFName.of('Outlines'));
    if (!outlines) return [];

    const pages = doc.getPages();

    // Helper to resolve references
    function resolveRef(obj) {
      if (!obj) return null;
      if (obj.lookup) return obj;
      if (obj.objectNumber !== undefined && doc.context) {
        return doc.context.lookup(obj);
      }
      return obj;
    }

    // Build named destinations map
    const namedDests = new Map();
    try {
      const names = doc.catalog.lookup(PDFName.of('Names'));
      if (names) {
        const dests = names.lookup(PDFName.of('Dests'));
        if (dests) {
          const namesArray = dests.lookup(PDFName.of('Names'));
          if (namesArray && namesArray.array) {
            for (let i = 0; i < namesArray.array.length; i += 2) {
              const name = namesArray.array[i];
              const dest = namesArray.array[i + 1];
              namedDests.set(name.decodeText(), resolveRef(dest));
            }
          }
        }
      }
    } catch (e) {
      console.error('Error building named destinations:', e);
    }

    function findPageIndex(pageRef) {
      if (!pageRef) return 0;
      
      try {
        const resolved = resolveRef(pageRef);
        
        // Try to match by object number
        if (pageRef.objectNumber !== undefined) {
          const idx = pages.findIndex(p => p.ref.objectNumber === pageRef.objectNumber);
          if (idx !== -1) return idx;
        }

        // Try to match by reference string
        if (pageRef.toString) {
          const idx = pages.findIndex(p => p.ref.toString() === pageRef.toString());
          if (idx !== -1) return idx;
        }

        // Try to match by page dictionary
        if (resolved && resolved.get) {
          const idx = pages.findIndex(p => {
            const pageDict = doc.context.lookup(p.ref);
            return pageDict === resolved;
          });
          if (idx !== -1) return idx;
        }
      } catch (e) {
        console.error('Error finding page:', e);
      }

      return 0;
    }

    function getDestination(item) {
      if (!item) return null;

      // Try Dest entry first
      let dest = item.lookup(PDFName.of('Dest'));
      
      // If no Dest, try Action/D
      if (!dest) {
        const action = resolveRef(item.lookup(PDFName.of('A')));
        if (action) {
          dest = action.lookup(PDFName.of('D'));
        }
      }

      // Handle named destinations
      if (dest && !dest.array) {
        const name = dest.decodeText ? dest.decodeText() : dest.toString();
        dest = namedDests.get(name);
      }

      return resolveRef(dest);
    }

    function traverse(item) {
      if (!item) return null;
      item = resolveRef(item);
      if (!item) return null;

      const title = item.lookup(PDFName.of('Title'));
      const dest = getDestination(item);
      const colorObj = item.lookup(PDFName.of('C'));
      const flagsObj = item.lookup(PDFName.of('F'));

      let pageIndex = 0;
      let destX = null;
      let destY = null;
      let zoom = null;

      if (dest && dest.array) {
        const pageRef = dest.array[0];
        pageIndex = findPageIndex(pageRef);

        if (dest.array.length > 2) {
          const xObj = resolveRef(dest.array[2]);
          const yObj = resolveRef(dest.array[3]);
          const zoomObj = resolveRef(dest.array[4]);

          if (xObj && xObj.numberValue !== undefined) destX = xObj.numberValue;
          if (yObj && yObj.numberValue !== undefined) destY = yObj.numberValue;
          if (zoomObj && zoomObj.numberValue !== undefined) {
            zoom = String(Math.round(zoomObj.numberValue * 100));
          }
        }
      }

      // Rest of the color and style processing remains the same
      let color = null;
      if (colorObj && colorObj.array) {
        const [r, g, b] = colorObj.array;
        if (r > 0.8 && g < 0.3 && b < 0.3) color = 'red';
        else if (r < 0.3 && g < 0.3 && b > 0.8) color = 'blue';
        else if (r < 0.3 && g > 0.8 && b < 0.3) color = 'green';
        else if (r > 0.8 && g > 0.8 && b < 0.3) color = 'yellow';
        else if (r > 0.5 && g < 0.5 && b > 0.5) color = 'purple';
      }

      let style = null;
      if (flagsObj) {
        const flags = flagsObj.numberValue || 0;
        const isBold = (flags & 2) !== 0;
        const isItalic = (flags & 1) !== 0;
        if (isBold && isItalic) style = 'bold-italic';
        else if (isBold) style = 'bold';
        else if (isItalic) style = 'italic';
      }

      const bookmark = {
        id: Date.now() + Math.random(),
        title: title ? title.decodeText() : 'Untitled',
        page: pageIndex + 1,
        children: [],
        color,
        style,
        destX,
        destY,
        zoom
      };

      // Process children (make sure to resolve refs)
      let child = resolveRef(item.lookup(PDFName.of('First')));
      while (child) {
        const childBookmark = traverse(child);
        if (childBookmark) bookmark.children.push(childBookmark);
        child = resolveRef(child.lookup(PDFName.of('Next')));
      }

      return bookmark;
    }

    const result = [];
    let first = resolveRef(outlines.lookup(PDFName.of('First')));
    while (first) {
      const bookmark = traverse(first);
      if (bookmark) result.push(bookmark);
      first = resolveRef(first.lookup(PDFName.of('Next')));
    }

    return result;
  } catch (err) {
    console.error('Error extracting bookmarks:', err);
    return [];
  }
}

downloadBtn.addEventListener('click', async () => {
  const pages = pdfLibDoc.getPages();
  const outlinesDict = pdfLibDoc.context.obj({});
  const outlinesRef = pdfLibDoc.context.register(outlinesDict);

  function createOutlineItems(nodes, parentRef) {
    const items = [];

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const itemDict = pdfLibDoc.context.obj({});
      const itemRef = pdfLibDoc.context.register(itemDict);

      itemDict.set(PDFName.of('Title'), PDFString.of(node.title));
      itemDict.set(PDFName.of('Parent'), parentRef);

      // const pageIndex = Math.max(0, Math.min(node.page - 2, pages.length - 1));
      const pageIndex =
        node.destX !== null && node.destY !== null
          ? Math.max(0, Math.min(node.page - 2, pages.length - 1))
          : Math.max(0, Math.min(node.page - 1, pages.length - 1));
      const pageRef = pages[pageIndex].ref;

      // Handle custom destination with zoom and position
      let destArray;
      if (node.destX !== null || node.destY !== null || node.zoom !== null) {
        const x = node.destX !== null ? PDFNumber.of(node.destX) : null;
        const y = node.destY !== null ? PDFNumber.of(node.destY) : null;

        let zoom = null;
        if (node.zoom !== null && node.zoom !== '' && node.zoom !== '0') {
          // Convert percentage to decimal (100% = 1.0)
          zoom = PDFNumber.of(parseFloat(node.zoom) / 100);
        }

        destArray = pdfLibDoc.context.obj([
          pageRef,
          PDFName.of('XYZ'),
          x,
          y,
          zoom,
        ]);
      } else {
        destArray = pdfLibDoc.context.obj([
          pageRef,
          PDFName.of('XYZ'),
          null,
          null,
          null,
        ]);
      }

      itemDict.set(PDFName.of('Dest'), destArray);

      // Add color to PDF
      if (node.color) {
        let rgb;

        if (node.color.startsWith('#')) {
          // Custom hex color - convert to RGB
          const hex = node.color.replace('#', '');
          const r = parseInt(hex.substr(0, 2), 16) / 255;
          const g = parseInt(hex.substr(2, 2), 16) / 255;
          const b = parseInt(hex.substr(4, 2), 16) / 255;
          rgb = [r, g, b];
        } else {
          // Predefined colors
          const colorMap = {
            red: [1.0, 0.0, 0.0],
            blue: [0.0, 0.0, 1.0],
            green: [0.0, 1.0, 0.0],
            yellow: [1.0, 1.0, 0.0],
            purple: [0.5, 0.0, 0.5],
          };
          rgb = colorMap[node.color];
        }

        if (rgb) {
          const colorArray = pdfLibDoc.context.obj(rgb);
          itemDict.set(PDFName.of('C'), colorArray);
        }
      }

      // Add style flags to PDF
      if (node.style) {
        let flags = 0;
        if (node.style === 'italic') flags = 1;
        else if (node.style === 'bold') flags = 2;
        else if (node.style === 'bold-italic') flags = 3;

        if (flags > 0) {
          itemDict.set(PDFName.of('F'), PDFNumber.of(flags));
        }
      }

      if (node.children.length > 0) {
        const childItems = createOutlineItems(node.children, itemRef);
        if (childItems.length > 0) {
          itemDict.set(PDFName.of('First'), childItems[0].ref);
          itemDict.set(
            PDFName.of('Last'),
            childItems[childItems.length - 1].ref
          );
          itemDict.set(
            PDFName.of('Count'),
            pdfLibDoc.context.obj(childItems.length)
          );
        }
      }

      if (i > 0) {
        itemDict.set(PDFName.of('Prev'), items[i - 1].ref);
        items[i - 1].dict.set(PDFName.of('Next'), itemRef);
      }

      items.push({ ref: itemRef, dict: itemDict });
    }

    return items;
  }

  try {
    const topLevelItems = createOutlineItems(bookmarkTree, outlinesRef);

    if (topLevelItems.length > 0) {
      outlinesDict.set(PDFName.of('Type'), PDFName.of('Outlines'));
      outlinesDict.set(PDFName.of('First'), topLevelItems[0].ref);
      outlinesDict.set(
        PDFName.of('Last'),
        topLevelItems[topLevelItems.length - 1].ref
      );
      outlinesDict.set(
        PDFName.of('Count'),
        pdfLibDoc.context.obj(topLevelItems.length)
      );
    }

    pdfLibDoc.catalog.set(PDFName.of('Outlines'), outlinesRef);

    const pdfBytes = await pdfLibDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${originalFileName}-bookmarked.pdf`;
    a.click();
    URL.revokeObjectURL(url);

    await showAlertModal('Success', 'PDF saved successfully!');

    // Reset to uploader after successful save
    setTimeout(() => {
      resetToUploader();
    }, 500);
  } catch (err) {
    console.error(err);
    await showAlertModal(
      'Error',
      'Error saving PDF. Check console for details.'
    );
  }
});
