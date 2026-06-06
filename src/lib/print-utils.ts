/* ========== SHARED PRINT UTILITY ========== */
/*
 * Handles printing across the application.
 * In Electron: uses native IPC print dialog (bagaAPI.printHtml)
 * In Browser: opens a new window with print dialog
 */

const isElectron = typeof window !== 'undefined' && !!(window as any).bagaAPI?.printHtml;

/**
 * Trigger print for HTML content.
 * Works in both Electron (native dialog) and Browser (new window).
 */
export function triggerPrint(html: string): void {
  if (isElectron) {
    // Electron: use native print dialog via IPC
    (window as any).bagaAPI.printHtml(html).then((result: any) => {
      if (!result.success) {
        // Only show error for real failures (timeout, load error)
        // "Print dialog shown" is a success — user handled the dialog
        const isRealError = result.reason && !result.reason.includes('shown');
        console.error('Print failed:', result.reason);
        if (isRealError) {
          alert('Print failed: ' + (result.reason || 'Unknown error'));
        }
      }
    }).catch((err: any) => {
      console.error('Print IPC error:', err);
    });
  } else {
    // Browser fallback: open new window
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      setTimeout(() => w.print(), 500);
    } else {
      alert('Please allow popups to print.');
    }
  }
}

/**
 * Get HTML for print with logo support.
 * Replaces {LOGO} placeholder with actual hospital logo.
 */
export function injectLogo(html: string): string {
  // Logo is handled via the srcDoc/iframe preview, or the Electron IPC print
  // This is a placeholder for future logo injection into print templates
  return html;
}
