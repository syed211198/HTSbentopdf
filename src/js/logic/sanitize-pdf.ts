import { showLoader, hideLoader, showAlert } from '../ui.js';
import { downloadFile } from '../utils/helpers.js';
import { state } from '../state.js';
import { removeMetadataFromDoc } from './remove-metadata.js';
import { removeAnnotationsFromDoc } from './remove-annotations.js';
import { flattenFormsInDoc } from './flatten.js';
import { PDFName } from 'pdf-lib';

export async function sanitizePdf() {
  if (!state.pdfDoc) {
    showAlert('Error', 'No PDF document loaded.');
    return;
  }

  showLoader('Sanitizing PDF...');
  try {
    const pdfDoc = state.pdfDoc;

    const shouldFlattenForms = (
      document.getElementById('flatten-forms') as HTMLInputElement
    ).checked;
    const shouldRemoveMetadata = (
      document.getElementById('remove-metadata') as HTMLInputElement
    ).checked;
    const shouldRemoveAnnotations = (
      document.getElementById('remove-annotations') as HTMLInputElement
    ).checked;
    const shouldRemoveJavascript = (
      document.getElementById('remove-javascript') as HTMLInputElement
    ).checked;
    const shouldRemoveEmbeddedFiles = (
      document.getElementById('remove-embedded-files') as HTMLInputElement
    ).checked;
    const shouldRemoveLayers = (
      document.getElementById('remove-layers') as HTMLInputElement
    ).checked;
    const shouldRemoveLinks = (
      document.getElementById('remove-links') as HTMLInputElement
    ).checked;
    const shouldRemoveStructureTree = (
      document.getElementById('remove-structure-tree') as HTMLInputElement
    ).checked;
    const shouldRemoveMarkInfo = (
      document.getElementById('remove-markinfo') as HTMLInputElement
    ).checked;
    const shouldRemoveFonts = (
      document.getElementById('remove-fonts') as HTMLInputElement
    ).checked;

    let changesMade = false;

    if (shouldFlattenForms) {
      try {
        flattenFormsInDoc(pdfDoc);
        changesMade = true;
      } catch (e) {
        console.warn(`Could not flatten forms: ${e.message}`);
        try {
          const catalogDict = pdfDoc.catalog.dict;
          if (catalogDict.has(PDFName.of('AcroForm'))) {
            catalogDict.delete(PDFName.of('AcroForm'));
            changesMade = true;
          }
        } catch (removeError) {
          console.warn('Could not remove AcroForm:', removeError.message);
        }
      }
    }

    if (shouldRemoveMetadata) {
      removeMetadataFromDoc(pdfDoc);
      changesMade = true;
    }

    if (shouldRemoveAnnotations) {
      removeAnnotationsFromDoc(pdfDoc);
      changesMade = true;
    }

    if (shouldRemoveJavascript) {
      try {
        if (pdfDoc.javaScripts && pdfDoc.javaScripts.length > 0) {
          pdfDoc.javaScripts = [];
          changesMade = true;
        }

        const catalogDict = pdfDoc.catalog.dict;

        const namesRef = catalogDict.get(PDFName.of('Names'));
        if (namesRef) {
          try {
            const namesDict = pdfDoc.context.lookup(namesRef);
            if (namesDict.has(PDFName.of('JavaScript'))) {
              namesDict.delete(PDFName.of('JavaScript'));
              changesMade = true;
            }
          } catch (e) {
            console.warn('Could not access Names/JavaScript:', e.message);
          }
        }

        if (catalogDict.has(PDFName.of('OpenAction'))) {
          catalogDict.delete(PDFName.of('OpenAction'));
          changesMade = true;
        }

        if (catalogDict.has(PDFName.of('AA'))) {
          catalogDict.delete(PDFName.of('AA'));
          changesMade = true;
        }

        const pages = pdfDoc.getPages();
        for (const page of pages) {
          try {
            const pageDict = page.node;
            if (pageDict.has(PDFName.of('AA'))) {
              pageDict.delete(PDFName.of('AA'));
              changesMade = true;
            }
          } catch (e) {
            console.warn('Could not remove page actions:', e.message);
          }
        }
      } catch (e) {
        console.warn(`Could not remove JavaScript: ${e.message}`);
      }
    }

    if (shouldRemoveEmbeddedFiles) {
      try {
        const catalogDict = pdfDoc.catalog.dict;

        const namesRef = catalogDict.get(PDFName.of('Names'));
        if (namesRef) {
          try {
            const namesDict = pdfDoc.context.lookup(namesRef);
            if (namesDict.has(PDFName.of('EmbeddedFiles'))) {
              namesDict.delete(PDFName.of('EmbeddedFiles'));
              changesMade = true;
            }
          } catch (e) {
            console.warn('Could not access Names/EmbeddedFiles:', e.message);
          }
        }

        if (catalogDict.has(PDFName.of('EmbeddedFiles'))) {
          catalogDict.delete(PDFName.of('EmbeddedFiles'));
          changesMade = true;
        }

        const pages = pdfDoc.getPages();
        for (const page of pages) {
          try {
            const annotRefs = page.node.Annots()?.asArray() || [];
            const annotsToKeep = [];

            for (const ref of annotRefs) {
              try {
                const annot = pdfDoc.context.lookup(ref);
                const subtype = annot
                  .get(PDFName.of('Subtype'))
                  ?.toString()
                  .substring(1);

                if (subtype !== 'FileAttachment') {
                  annotsToKeep.push(ref);
                } else {
                  changesMade = true;
                }
              } catch (e) {
                annotsToKeep.push(ref);
              }
            }

            if (annotsToKeep.length !== annotRefs.length) {
              if (annotsToKeep.length > 0) {
                const newAnnotsArray = pdfDoc.context.obj(annotsToKeep);
                page.node.set(PDFName.of('Annots'), newAnnotsArray);
              } else {
                page.node.delete(PDFName.of('Annots'));
              }
            }
          } catch (pageError) {
            console.warn(
              `Could not process page for attachments: ${pageError.message}`
            );
          }
        }

        if (pdfDoc.embeddedFiles && pdfDoc.embeddedFiles.length > 0) {
          pdfDoc.embeddedFiles = [];
          changesMade = true;
        }

        if (catalogDict.has(PDFName.of('Collection'))) {
          catalogDict.delete(PDFName.of('Collection'));
          changesMade = true;
        }
      } catch (e) {
        console.warn(`Could not remove embedded files: ${e.message}`);
      }
    }

    if (shouldRemoveLayers) {
      try {
        const catalogDict = pdfDoc.catalog.dict;

        if (catalogDict.has(PDFName.of('OCProperties'))) {
          catalogDict.delete(PDFName.of('OCProperties'));
          changesMade = true;
        }

        const pages = pdfDoc.getPages();
        for (const page of pages) {
          try {
            const pageDict = page.node;

            if (pageDict.has(PDFName.of('OCProperties'))) {
              pageDict.delete(PDFName.of('OCProperties'));
              changesMade = true;
            }

            const resourcesRef = pageDict.get(PDFName.of('Resources'));
            if (resourcesRef) {
              try {
                const resourcesDict = pdfDoc.context.lookup(resourcesRef);
                if (resourcesDict.has(PDFName.of('Properties'))) {
                  resourcesDict.delete(PDFName.of('Properties'));
                  changesMade = true;
                }
              } catch (e) {
                console.warn('Could not access Resources:', e.message);
              }
            }
          } catch (e) {
            console.warn('Could not remove page layers:', e.message);
          }
        }
      } catch (e) {
        console.warn(`Could not remove layers: ${e.message}`);
      }
    }

    if (shouldRemoveLinks) {
      try {
        const pages = pdfDoc.getPages();

        for (const page of pages) {
          try {
            const annotRefs = page.node.Annots()?.asArray() || [];
            const annotsToKeep = [];

            for (const ref of annotRefs) {
              try {
                const annot = pdfDoc.context.lookup(ref);
                const subtype = annot
                  .get(PDFName.of('Subtype'))
                  ?.toString()
                  .substring(1);

                let hasExternalLink = false;

                if (subtype === 'Link') {
                  const action = annot.get(PDFName.of('A'));
                  if (action) {
                    try {
                      const actionDict = pdfDoc.context.lookup(action);
                      const actionType = actionDict
                        .get(PDFName.of('S'))
                        ?.toString()
                        .substring(1);

                      if (actionType === 'URI' || actionType === 'Launch') {
                        hasExternalLink = true;
                        changesMade = true;
                      }
                    } catch (e) {
                      // Keep if we can't determine
                    }
                  }
                }

                if (!hasExternalLink) {
                  annotsToKeep.push(ref);
                }
              } catch (e) {
                // Keep annotation if we can't read it
                annotsToKeep.push(ref);
              }
            }

            if (annotsToKeep.length !== annotRefs.length) {
              if (annotsToKeep.length > 0) {
                const newAnnotsArray = pdfDoc.context.obj(annotsToKeep);
                page.node.set(PDFName.of('Annots'), newAnnotsArray);
              } else {
                page.node.delete(PDFName.of('Annots'));
              }
            }
          } catch (pageError) {
            console.warn(
              `Could not process page for links: ${pageError.message}`
            );
          }
        }
      } catch (e) {
        console.warn(`Could not remove links: ${e.message}`);
      }
    }

    if (shouldRemoveStructureTree) {
      try {
        const catalogDict = pdfDoc.catalog.dict;

        if (catalogDict.has(PDFName.of('StructTreeRoot'))) {
          catalogDict.delete(PDFName.of('StructTreeRoot'));
          changesMade = true;
        }

        const pages = pdfDoc.getPages();
        for (const page of pages) {
          try {
            const pageDict = page.node;
            if (pageDict.has(PDFName.of('StructParents'))) {
              pageDict.delete(PDFName.of('StructParents'));
              changesMade = true;
            }
          } catch (e) {
            console.warn('Could not remove page StructParents:', e.message);
          }
        }

        if (catalogDict.has(PDFName.of('ParentTree'))) {
          catalogDict.delete(PDFName.of('ParentTree'));
          changesMade = true;
        }
      } catch (e) {
        console.warn(`Could not remove structure tree: ${e.message}`);
      }
    }

    if (shouldRemoveMarkInfo) {
      try {
        const catalogDict = pdfDoc.catalog.dict;

        if (catalogDict.has(PDFName.of('MarkInfo'))) {
          catalogDict.delete(PDFName.of('MarkInfo'));
          changesMade = true;
        }

        if (catalogDict.has(PDFName.of('Marked'))) {
          catalogDict.delete(PDFName.of('Marked'));
          changesMade = true;
        }
      } catch (e) {
        console.warn(`Could not remove MarkInfo: ${e.message}`);
      }
    }

    if (shouldRemoveFonts) {
      try {
        const pages = pdfDoc.getPages();

        for (const page of pages) {
          try {
            const pageDict = page.node;
            const resourcesRef = pageDict.get(PDFName.of('Resources'));

            if (resourcesRef) {
              try {
                const resourcesDict = pdfDoc.context.lookup(resourcesRef);

                if (resourcesDict.has(PDFName.of('Font'))) {
                  resourcesDict.delete(PDFName.of('Font'));
                  changesMade = true;
                }
              } catch (e) {
                console.warn(
                  'Could not access Resources for fonts:',
                  e.message
                );
              }
            }
          } catch (e) {
            console.warn('Could not remove page fonts:', e.message);
          }
        }

        if (pdfDoc.fonts && pdfDoc.fonts.length > 0) {
          pdfDoc.fonts = [];
          changesMade = true;
        }
      } catch (e) {
        console.warn(`Could not remove fonts: ${e.message}`);
      }
    }

    if (!changesMade) {
      showAlert(
        'No Changes',
        'No items were selected for removal or none were found in the PDF.'
      );
      hideLoader();
      return;
    }

    const sanitizedPdfBytes = await pdfDoc.save();
    downloadFile(
      new Blob([sanitizedPdfBytes], { type: 'application/pdf' }),
      'sanitized.pdf'
    );
    showAlert('Success', 'PDF has been sanitized and downloaded.');
  } catch (e) {
    console.error('Sanitization Error:', e);
    showAlert('Error', `An error occurred during sanitization: ${e.message}`);
  } finally {
    hideLoader();
  }
}
