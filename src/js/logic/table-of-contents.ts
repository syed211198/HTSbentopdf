const worker = new Worker('/workers/table-of-contents.worker.js');

let pdfFile: File | null = null;

const dropZone = document.getElementById('drop-zone') as HTMLElement;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const generateBtn = document.getElementById(
  'generate-btn'
) as HTMLButtonElement;
const tocTitleInput = document.getElementById('toc-title') as HTMLInputElement;
const fontSizeSelect = document.getElementById(
  'font-size'
) as HTMLSelectElement;
const fontFamilySelect = document.getElementById(
  'font-family'
) as HTMLSelectElement;
const addBookmarkCheckbox = document.getElementById(
  'add-bookmark'
) as HTMLInputElement;
const statusMessage = document.getElementById('status-message') as HTMLElement;
const fileDisplayArea = document.getElementById(
  'file-display-area'
) as HTMLElement;
const backToToolsBtn = document.getElementById(
  'back-to-tools'
) as HTMLButtonElement;

interface GenerateTOCMessage {
  command: 'generate-toc';
  pdfData: ArrayBuffer;
  title: string;
  fontSize: number;
  fontFamily: number;
  addBookmark: boolean;
}

interface TOCSuccessResponse {
  status: 'success';
  pdfBytes: ArrayBuffer;
}

interface TOCErrorResponse {
  status: 'error';
  message: string;
}

type TOCWorkerResponse = TOCSuccessResponse | TOCErrorResponse;

// Show status message
function showStatus(
  message: string,
  type: 'success' | 'error' | 'info' = 'info'
) {
  statusMessage.textContent = message;
  statusMessage.className = `mt-4 p-3 rounded-lg text-sm ${
    type === 'success'
      ? 'bg-green-900 text-green-200'
      : type === 'error'
        ? 'bg-red-900 text-red-200'
        : 'bg-blue-900 text-blue-200'
  }`;
  statusMessage.classList.remove('hidden');
}

// Hide status message
function hideStatus() {
  statusMessage.classList.add('hidden');
}

// Format bytes helper
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// Render file display
function renderFileDisplay(file: File) {
  fileDisplayArea.innerHTML = '';
  fileDisplayArea.classList.remove('hidden');

  const fileDiv = document.createElement('div');
  fileDiv.className =
    'flex items-center justify-between bg-gray-700 p-3 rounded-lg text-sm';

  const nameSpan = document.createElement('span');
  nameSpan.className = 'truncate font-medium text-gray-200';
  nameSpan.textContent = file.name;

  const sizeSpan = document.createElement('span');
  sizeSpan.className = 'flex-shrink-0 ml-4 text-gray-400';
  sizeSpan.textContent = formatBytes(file.size);

  fileDiv.append(nameSpan, sizeSpan);
  fileDisplayArea.appendChild(fileDiv);
}

// Handle file selection
function handleFileSelect(file: File) {
  if (file.type !== 'application/pdf') {
    showStatus('Please select a PDF file.', 'error');
    return;
  }

  pdfFile = file;
  generateBtn.disabled = false;
  renderFileDisplay(file);
  showStatus(`File selected: ${file.name}`, 'success');
}

// Drag and drop handlers
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('border-blue-500');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('border-blue-500');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('border-blue-500');
  const file = e.dataTransfer?.files[0];
  if (file) {
    handleFileSelect(file);
  }
});

fileInput.addEventListener('change', (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    handleFileSelect(file);
  }
});

// Generate table of contents
async function generateTableOfContents() {
  if (!pdfFile) {
    showStatus('Please select a PDF file first.', 'error');
    return;
  }

  try {
    generateBtn.disabled = true;
    showStatus('Reading file (Main Thread)...', 'info');

    const arrayBuffer = await pdfFile.arrayBuffer();

    showStatus('Generating table of contents...', 'info');

    const title = tocTitleInput.value || 'Table of Contents';
    const fontSize = parseInt(fontSizeSelect.value, 10);
    const fontFamily = parseInt(fontFamilySelect.value, 10);
    const addBookmark = addBookmarkCheckbox.checked;

    const message: GenerateTOCMessage = {
      command: 'generate-toc',
      pdfData: arrayBuffer,
      title,
      fontSize,
      fontFamily,
      addBookmark,
    };

    worker.postMessage(message, [arrayBuffer]);
  } catch (error) {
    console.error('Error reading file:', error);
    showStatus(
      `Error reading file: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
      'error'
    );
    generateBtn.disabled = false;
  }
}

// Handle messages from worker
worker.onmessage = (e: MessageEvent<TOCWorkerResponse>) => {
  generateBtn.disabled = false;

  if (e.data.status === 'success') {
    const pdfBytesBuffer = e.data.pdfBytes;
    const pdfBytes = new Uint8Array(pdfBytesBuffer);

    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download =
      pdfFile?.name.replace('.pdf', '_with_toc.pdf') || 'output_with_toc.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showStatus(
      'Table of contents generated successfully! Download started.',
      'success'
    );

    hideStatus();
    pdfFile = null;
    fileInput.value = '';
    fileDisplayArea.innerHTML = '';
    fileDisplayArea.classList.add('hidden');
    generateBtn.disabled = true;
  } else if (e.data.status === 'error') {
    const errorMessage = e.data.message || 'Unknown error occurred in worker.';
    console.error('Worker Error:', errorMessage);
    showStatus(`Error: ${errorMessage}`, 'error');
  }
};

worker.onerror = (error) => {
  console.error('Worker error:', error);
  showStatus('Worker error occurred. Check console for details.', 'error');
  generateBtn.disabled = false;
};

// Back to tools button
if (backToToolsBtn) {
  backToToolsBtn.addEventListener('click', () => {
    window.location.href = '../../index.html#tools-header';
  });
}

generateBtn.addEventListener('click', generateTableOfContents);
