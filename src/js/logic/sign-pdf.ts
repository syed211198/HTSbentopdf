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

      // PDF.js expects the file URL in the query string, while
      // the annotation extension reads its options from the URL hash.
      const viewerBase = '/pdfjs-annotation-viewer/web/viewer.html';
      const query = new URLSearchParams({ file: blobUrl });
      const hash = new URLSearchParams({
        // Annotation extension params (must be in the hash, not the query)
        ae_username: 'Bento User',
        ae_default_editor_active: 'true',
        ae_default_sidebar_open: 'true',
        // We intentionally do NOT set ae_post_url because Bento uses
        // client-side export only (no backend save endpoint).
      });

      iframe.src = `${viewerBase}?${query.toString()}#${hash.toString()}`;
    
    iframe.onload = () => {
      hideLoader();
      signState.viewerReady = true;
      
      try {
        const viewerWindow: any = iframe.contentWindow;
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

            // Make the annotation extension's "Save" button behave like
            // "Export PDF" (purely client-side) instead of POSTing to
            // ae_post_url, which we don't use in Bento.
            const ext = viewerWindow.pdfjsAnnotationExtensionInstance;
            if (ext && typeof ext.exportPdf === 'function') {
              ext.saveData = async () => {
                try {
                  await ext.exportPdf();
                } catch (err) {
                  console.error('Failed to export annotated PDF via Save button:', err);
                  viewerWindow.alert?.('Failed to export the signed PDF. Please try again.');
                }
              };
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
    return;
  }

  try {
    const viewerWindow: any = signState.viewerIframe.contentWindow;
    if (!viewerWindow || !viewerWindow.pdfjsAnnotationExtensionInstance) {
      showAlert('Annotations not ready', 'Please wait for the annotation tools to finish loading.');
      return;
    }

    // Trigger the extension's Export PDF flow so annotations are baked into the downloaded file.
    await viewerWindow.pdfjsAnnotationExtensionInstance.exportPdf();
  } catch (error) {
    console.error('Failed to export annotated PDF:', error);
    showAlert('Export failed', 'Could not export the PDF with annotations. Please try again.');
  }
}
