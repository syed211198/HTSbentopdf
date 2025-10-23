import { showLoader, hideLoader, showAlert } from '../ui.js';
import { downloadFile, readFileAsArrayBuffer } from '../utils/helpers.js';
import { state } from '../state.js';
import createModule from '@neslinesli93/qpdf-wasm';

let qpdfInstance: any = null;

async function initializeQpdf() {
  if (qpdfInstance) {
    return qpdfInstance;
  }
  showLoader('Initializing encryption engine...');
  try {
    qpdfInstance = await createModule({
      locateFile: () => '/qpdf.wasm',
    });
  } catch (error) {
    console.error('Failed to initialize qpdf-wasm:', error);
    showAlert(
      'Initialization Error',
      'Could not load the encryption engine. Please refresh the page and try again.'
    );
    throw error;
  } finally {
    hideLoader();
  }
  return qpdfInstance;
}

export async function encrypt() {
  const file = state.files[0];
  const userPassword =
    (document.getElementById('user-password-input') as HTMLInputElement)
      ?.value || '';
  const ownerPassword =
    (document.getElementById('owner-password-input') as HTMLInputElement)
      ?.value || '';

  if (!userPassword) {
    showAlert('Input Required', 'Please enter a user password.');
    return;
  }

  const inputPath = '/input.pdf';
  const outputPath = '/output.pdf';
  let qpdf: any;

  try {
    showLoader('Initializing encryption...');
    qpdf = await initializeQpdf();

    showLoader('Reading PDF...');
    const fileBuffer = await readFileAsArrayBuffer(file);
    const uint8Array = new Uint8Array(fileBuffer as ArrayBuffer);

    qpdf.FS.writeFile(inputPath, uint8Array);

    showLoader('Encrypting PDF with 256-bit AES...');

    const args = [
      inputPath,
      '--encrypt',
      userPassword,
      ownerPassword, // Can be empty
      '256',
    ];

    if (ownerPassword) {
      args.push(
        '--modify=none',
        '--extract=n', 
        '--print=none', 
        '--accessibility=n', 
        '--annotate=n', 
        '--assemble=n', 
        '--form=n', 
        '--modify-other=n', 
      );
    }

    if (!ownerPassword) {
      args.push('--allow-insecure');
    }

    args.push('--', outputPath);

    try {
      qpdf.callMain(args);
    } catch (qpdfError: any) {
      console.error('qpdf execution error:', qpdfError);
      throw new Error(
        'Encryption failed: ' + (qpdfError.message || 'Unknown error')
      );
    }

    showLoader('Preparing download...');
    const outputFile = qpdf.FS.readFile(outputPath, { encoding: 'binary' });

    if (!outputFile || outputFile.length === 0) {
      throw new Error('Encryption resulted in an empty file.');
    }

    const blob = new Blob([outputFile], { type: 'application/pdf' });
    downloadFile(blob, `encrypted-${file.name}`);

    hideLoader();

    let successMessage = 'PDF encrypted successfully with 256-bit AES!';
    if (!ownerPassword) {
      successMessage +=
        ' Note: Without an owner password, the PDF has no usage restrictions.';
    }

    showAlert('Success', successMessage);
  } catch (error: any) {
    console.error('Error during PDF encryption:', error);
    hideLoader();
    showAlert(
      'Encryption Failed',
      `An error occurred: ${error.message || 'The PDF might be corrupted.'}`
    );
  } finally {
    try {
      if (qpdf?.FS) {
        try {
          qpdf.FS.unlink(inputPath);
        } catch (e) {
          console.warn('Failed to unlink input file:', e);
        }
        try {
          qpdf.FS.unlink(outputPath);
        } catch (e) {
          console.warn('Failed to unlink output file:', e);
        }
      }
    } catch (cleanupError) {
      console.warn('Failed to cleanup WASM FS:', cleanupError);
    }
  }
}
