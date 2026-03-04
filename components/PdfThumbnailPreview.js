'use client';

import { useEffect, useRef, useState } from 'react';

const PDFJS_SCRIPT_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs';

let pdfJsLoadingPromise;

function ensurePdfJsLoaded() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Window is unavailable'));
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);

  if (!pdfJsLoadingPromise) {
    pdfJsLoadingPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.type = 'module';
      script.src = PDFJS_SCRIPT_SRC;

      script.onload = () => {
        if (window.pdfjsLib) {
          resolve(window.pdfjsLib);
        } else {
          reject(new Error('pdf.js loaded without window.pdfjsLib'));
        }
      };

      script.onerror = () => reject(new Error('Failed to load pdf.js script'));
      document.head.appendChild(script);
    });
  }

  return pdfJsLoadingPromise;
}

export function PdfThumbnailPreview({ fileUrl, label }) {
  const containerRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [thumbnailSrc, setThumbnailSrc] = useState('');
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || isVisible) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '120px 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible || !fileUrl || thumbnailSrc || hasError) return;

    let isActive = true;
    let loadingTask;

    async function renderThumbnail() {
      try {
        const pdfjsLib = await ensurePdfJsLoaded();
        const workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

        loadingTask = pdfjsLib.getDocument(fileUrl);
        const pdfDocument = await loadingTask.promise;
        const firstPage = await pdfDocument.getPage(1);
        const viewport = firstPage.getViewport({ scale: 1 });
        const maxWidth = 160;
        const scale = viewport.width > 0 ? maxWidth / viewport.width : 1;
        const scaledViewport = firstPage.getViewport({ scale });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas context unavailable');

        canvas.width = Math.max(1, Math.floor(scaledViewport.width));
        canvas.height = Math.max(1, Math.floor(scaledViewport.height));

        await firstPage.render({ canvasContext: context, viewport: scaledViewport }).promise;

        if (isActive) setThumbnailSrc(canvas.toDataURL('image/png'));
      } catch (error) {
        console.error('PDF thumbnail generation failed:', error);
        if (isActive) setHasError(true);
      }
    }

    renderThumbnail();

    return () => {
      isActive = false;
      if (loadingTask) loadingTask.destroy();
    };
  }, [fileUrl, hasError, isVisible, thumbnailSrc]);

  return (
    <div className="field-pdf-preview-wrap" ref={containerRef}>
      {thumbnailSrc ? (
        <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="field-pdf-thumbnail-link" aria-label={`Open ${label} PDF`}>
          <img src={thumbnailSrc} alt={`${label} PDF preview`} className="field-pdf-thumbnail" />
        </a>
      ) : null}

      <a className="button secondary field-file-btn" href={fileUrl} target="_blank" rel="noopener noreferrer">
        Open PDF
      </a>
    </div>
  );
}
