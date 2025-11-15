import { showLoader, hideLoader, showAlert } from '../ui.js';
import { downloadFile, readFileAsArrayBuffer } from '../utils/helpers.js';
import { state } from '../state.js';

let viewerIframe: HTMLIFrameElement | null = null;
let viewerReady = false;


export async function setupFormFiller() {
  if (!state.files || !state.files[0]) return;

  showLoader('Loading PDF form...');
  const pdfViewerContainer = document.getElementById('pdf-viewer-container');

  if (!pdfViewerContainer) {
    console.error('PDF viewer container not found');
    hideLoader();
    return;
  }

  try {
    pdfViewerContainer.innerHTML = '';
    
    const file = state.files[0];
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const blob = new Blob([arrayBuffer as ArrayBuffer], { type: 'application/pdf' });
    const blobUrl = URL.createObjectURL(blob);

    viewerIframe = document.createElement('iframe');
    viewerIframe.src = `/pdfjs-viewer/viewer.html?file=${encodeURIComponent(blobUrl)}`;
    viewerIframe.style.width = '100%';
    viewerIframe.style.height = '100%';
    viewerIframe.style.border = 'none';
    
    viewerIframe.onload = () => {
      viewerReady = true;
      hideLoader();
    };
    
    pdfViewerContainer.appendChild(viewerIframe);

    const formFillerOptions = document.getElementById('form-filler-options');
    if (formFillerOptions) formFillerOptions.classList.remove('hidden');
  } catch (e) {
    console.error('Critical error setting up form filler:', e);
    showAlert(
      'Error',
      'Failed to load PDF form viewer.'
    );
    hideLoader();
  }
}

export async function processAndDownloadForm() {
  if (!viewerIframe || !viewerReady) {
    showAlert('Viewer not ready', 'Please wait for the form to finish loading.');
    return;
  }

  // The full PDF.js viewer has its own download button in the toolbar
  // Users can use that to download or the print button to print to PDF
  showAlert(
    'Download Form',
    'Use the Download button in the PDF viewer toolbar above, or use Print to save as PDF.'
  );
}
