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
    viewerIframe = document.createElement('iframe');
    viewerIframe.src = '/pdfjs-viewer/form-viewer.html';
    viewerIframe.style.width = '100%';
    viewerIframe.style.height = '100%';
    viewerIframe.style.border = 'none';
    pdfViewerContainer.appendChild(viewerIframe);

    window.addEventListener('message', async (event) => {
      if (event.data.type === 'viewerReady') {
        viewerReady = true;
        // Use the original uploaded bytes so that XFA streams remain intact
        // and PDF.js can fully render XFA-based forms.
        const file = state.files[0];
        const pdfBytes = await readFileAsArrayBuffer(file);
        viewerIframe?.contentWindow?.postMessage(
          { type: 'loadPDF', data: pdfBytes },
          '*'
        );
      } else if (event.data.type === 'pdfLoaded') {
        hideLoader();
      } else if (event.data.type === 'downloadPDF') {
        const pdfData = new Uint8Array(event.data.data);
        downloadFile(
          new Blob([pdfData], { type: 'application/pdf' }),
          'filled-form.pdf'
        );
        showAlert('Success', 'Form has been filled and downloaded.');
      } else if (event.data.type === 'error') {
        showAlert('Error', event.data.message);
      }
    });

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

  try {
    const win: any = viewerIframe.contentWindow;
    const doc: Document | null = win?.document ?? null;

    // Prefer to trigger the same behavior as the toolbar's Download button
    const downloadBtn = doc?.getElementById('download') as HTMLButtonElement | null;
    if (downloadBtn) {
      downloadBtn.click();
      return;
    }

    // Fallback: use the postMessage-based getData flow
    win?.postMessage({ type: 'getData' }, '*');
  } catch (e) {
    console.error('Failed to trigger form download:', e);
    showAlert('Export failed', 'Could not export the filled form. Please try again.');
  }
}
