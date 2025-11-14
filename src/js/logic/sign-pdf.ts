import { showLoader, hideLoader, showAlert } from '../ui.js';
import { downloadFile } from '../utils/helpers.js';
import { state } from '../state.js';

const signState = {
  viewerIframe: null,
  viewerReady: false,
};


export async function setupSignTool() {
  document.getElementById('signature-editor').classList.remove('hidden');

  showLoader('Loading PDF viewer...');
  
  const container = document.getElementById('canvas-container-sign');
  if (container) {
    container.textContent = '';
    const iframe = document.createElement('iframe');
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    container.appendChild(iframe);
    signState.viewerIframe = iframe;

    const pdfBytes = await state.pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const blobUrl = URL.createObjectURL(blob);

    iframe.src = `/pdfjs-viewer/viewer.html?file=${encodeURIComponent(blobUrl)}`;
    
    iframe.onload = () => {
      hideLoader();
      signState.viewerReady = true;
      
      try {
        const viewerWindow = iframe.contentWindow;
        if (viewerWindow) {
          setTimeout(() => {
            const sigButton = viewerWindow.document.getElementById('editorSignature');
            if (sigButton) {
              sigButton.removeAttribute('hidden');
              const sigButtonElement = viewerWindow.document.getElementById('editorSignatureButton');
              if (sigButtonElement) {
                sigButtonElement.removeAttribute('disabled');
              }
            }
          }, 500);
        }
      } catch (e) {
        console.error('Could not enable signature button:', e);
      }
    };
  }
  
  const saveBtn = document.getElementById('process-btn');
  if (saveBtn) {
    saveBtn.style.display = 'none';
  }
}

export async function applyAndSaveSignatures() {
  if (!signState.viewerReady || !signState.viewerIframe) {
    showAlert('Viewer not ready', 'Please wait for the PDF viewer to load.');
  }
}
