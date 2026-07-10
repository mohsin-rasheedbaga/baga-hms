/**
 * BAGA HMS — Native ESC/POS Thermal Printer Module
 *
 * Supports any ESC/POS-compatible Bluetooth or USB thermal printer.
 * Tested with Scangle SGT-B58V (58mm Bluetooth thermal printer).
 *
 * Uses Windows COM port (serial port) directly via fs — NO external
 * driver or serialport npm package required. Windows treats COM ports
 * as files, so we can write raw ESC/POS bytes directly.
 *
 * Features:
 * - Auto-detect printer on available COM ports
 * - 58mm formatting (384 dots wide, 32 chars Font A)
 * - Text formatting (bold, double, align, underline)
 * - Barcode (CODE128, CODE39, EAN13)
 * - QR Code
 * - Logo/Bitmap image (raster bit image)
 * - Print queue with retry
 * - Auto-reconnect on disconnect
 * - Robust error handling
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ============================================================
// ESC/POS COMMAND CONSTANTS
// ============================================================
const ESC = 0x1B;
const GS = 0x1D;
const LF = 0x0A;

// Print modes
const FONT_A = 0x00;    // Normal font (32 chars/line on 58mm)
const FONT_B = 0x01;    // Small font (42 chars/line on 58mm)
const EMPHASIZED = 0x08; // Bold
const DOUBLE_H = 0x10;  // Double width
const DOUBLE_V = 0x20;  // Double height
const UNDERLINE = 0x80; // Underline

// Alignments
const ALIGN_LEFT = 0;
const ALIGN_CENTER = 1;
const ALIGN_RIGHT = 2;

// Barcode types
const BARCODE_CODE128 = 73;
const BARCODE_CODE39 = 69;
const BARCODE_EAN13 = 67;

// Cut modes
const CUT_FULL = 0x00;
const CUT_PARTIAL = 0x01;

// 58mm printer: 384 dots wide
const PRINT_WIDTH_58 = 384;
const PRINT_WIDTH_80 = 576;

// ============================================================
// PRINTER STATE
// ============================================================
let printerConfig = {
  comPort: '',           // e.g. 'COM3' — empty = auto-detect
  baudRate: 9600,       // 9600 or 115200
  width: 58,            // 58mm or 80mm
  charset: 0,           // 0 = PC437 (default)
  autoCut: true,        // Auto cut after print
  cashDrawer: false,    // Pulse cash drawer before print
  enabled: false,       // Is thermal printer enabled?
  lineSpacing: 30,      // Default line spacing
};

let printQueue = [];
let isPrinting = false;
let lastError = null;

// ============================================================
// COM PORT DETECTION (Windows)
// ============================================================

/**
 * List all available COM ports on Windows using PowerShell.
 * Returns array of { port: 'COM3', description: '...', isPrinter: bool }
 */
function listComPorts() {
  try {
    if (process.platform !== 'win32') {
      return { success: false, ports: [], error: 'COM ports only supported on Windows' };
    }

    // Use PowerShell to enumerate COM ports from registry
    const output = execSync(
      `powershell -NoProfile -Command "Get-WmiObject Win32_SerialPort | Select-Object DeviceID, Description | ConvertTo-Json"`,
      { encoding: 'utf8', timeout: 10000 }
    ).trim();

    const ports = [];
    if (output) {
      let data;
      try { data = JSON.parse(output); } catch { data = []; }
      if (!Array.isArray(data)) data = [data];
      for (const item of data) {
        if (item.DeviceID) {
          ports.push({
            port: item.DeviceID,
            description: item.Description || '',
            isPrinter: isLikelyPrinter(item.Description || ''),
          });
        }
      }
    }

    // Also check via mode command (fallback for Bluetooth COM ports)
    try {
      const modeOutput = execSync('mode', { encoding: 'utf8', timeout: 5000 });
      const comMatches = modeOutput.match(/COM\d+/g);
      if (comMatches) {
        for (const com of [...new Set(comMatches)]) {
          if (!ports.find(p => p.port === com)) {
            ports.push({ port: com, description: 'Serial Port', isPrinter: false });
          }
        }
      }
    } catch {}

    // Also check registry for Bluetooth COM ports (Incoming)
    try {
      const regOutput = execSync(
        `powershell -NoProfile -Command "Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Ports' | Select-Object * -ExcludeProperty PS* | ConvertTo-Json"`,
        { encoding: 'utf8', timeout: 10000 }
      );
      if (regOutput) {
        const lines = regOutput.split('\n');
        for (const line of lines) {
          const match = line.match(/"(COM\d+)/i);
          if (match && !ports.find(p => p.port === match[1])) {
            ports.push({ port: match[1], description: 'Bluetooth Serial', isPrinter: true });
          }
        }
      }
    } catch {}

    return { success: true, ports };
  } catch (err) {
    return { success: false, ports: [], error: err.message };
  }
}

/**
 * Check if a COM port description looks like a thermal printer.
 */
function isLikelyPrinter(description) {
  const lower = (description || '').toLowerCase();
  return lower.includes('printer') ||
         lower.includes('thermal') ||
         lower.includes('bluetooth') ||
         lower.includes('serial') ||
         lower.includes('sgt') ||
         lower.includes('esc');
}

/**
 * Auto-detect the most likely printer COM port.
 * Returns { port, description } or null if not found.
 */
function autoDetectPrinter() {
  const result = listComPorts();
  if (!result.success || result.ports.length === 0) return null;

  // Prefer ports that look like printers
  const printerPorts = result.ports.filter(p => p.isPrinter);
  if (printerPorts.length > 0) {
    return { port: printerPorts[0].port, description: printerPorts[0].description };
  }

  // Fall back to any COM port (excluding COM1 which is often system)
  const nonSystemPorts = result.ports.filter(p => p.port !== 'COM1');
  if (nonSystemPorts.length > 0) {
    return { port: nonSystemPorts[0].port, description: nonSystemPorts[0].description };
  }

  return null;
}

// ============================================================
// LOW-LEVEL COM PORT WRITE
// ============================================================

/**
 * Write raw bytes to a COM port.
 * On Windows, COM ports can be opened as files: \\.\COM3
 */
function writeToComPort(comPort, data) {
  return new Promise((resolve, reject) => {
    const portPath = `\\\\.\\${comPort}`;
    try {
      // Open COM port for writing
      const fd = fs.openSync(portPath, 'rs');
      // Write data
      fs.writeSync(fd, data, 0, data.length, 0);
      // Small delay to let printer process
      setTimeout(() => {
        try { fs.closeSync(fd); } catch (e) {}
        resolve(true);
      }, 100);
    } catch (err) {
      reject(new Error(`Failed to write to ${comPort}: ${err.message}`));
    }
  });
}

/**
 * Try to write to COM port with retry.
 */
async function writeWithRetry(comPort, data, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await writeToComPort(comPort, data);
      return true;
    } catch (err) {
      lastError = err.message;
      console.error(`[Printer] Write attempt ${attempt + 1}/${retries + 1} failed:`, err.message);
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 500)); // Wait 500ms before retry
      }
    }
  }
  return false;
}

// ============================================================
// ESC/POS COMMAND BUILDERS
// ============================================================

/**
 * Build ESC/POS command buffer from a sequence of commands.
 * Each command is either:
 *   - A Buffer
 *   - A string (converted to bytes)
 *   - A number (single byte)
 *   - An array of numbers (bytes)
 */
function buildBuffer(...commands) {
  const parts = [];
  for (const cmd of commands) {
    if (Buffer.isBuffer(cmd)) {
      parts.push(cmd);
    } else if (typeof cmd === 'string') {
      parts.push(Buffer.from(cmd, 'ascii'));
    } else if (typeof cmd === 'number') {
      parts.push(Buffer.from([cmd]));
    } else if (Array.isArray(cmd)) {
      parts.push(Buffer.from(cmd));
    }
  }
  return Buffer.concat(parts);
}

/** Initialize printer */
function cmdInit() {
  return Buffer.from([ESC, 0x40]);
}

/** Set print density/darkness (0-8, higher = darker) */
function cmdDensity(level) {
  // ESC 7 n — Set print density
  // n = 0 (lightest) to 8 (darkest)
  // Some printers use ESC \x7B n, others use GS ! n
  // The most common is ESC 7 n for thermal density
  const density = Math.min(Math.max(level || 8, 0), 8);
  return Buffer.from([ESC, 0x37, density]);
}

/** Set print speed (lower = slower = darker print) */
function cmdPrintSpeed(speed) {
  // GS ( K <parameters> — some printers support speed control
  // Lower speed = darker print
  // 0 = fastest (lightest), 1 = normal, 2 = slow (darkest)
  return Buffer.from([GS, 0x21, speed || 0x01]);
}

/** Enable double-strike (darker text on impact printers, also works on some thermal) */
function cmdDoubleStrike(enable) {
  return Buffer.from([ESC, 0x47, enable ? 0x01 : 0x00]);
}

/** Set emphasized (bold) mode — stays on until turned off */
function cmdSetEmphasized(enable) {
  return Buffer.from([ESC, 0x45, enable ? 0x01 : 0x00]);
}

/** Set underline mode */
function cmdSetUnderline(enable) {
  return Buffer.from([ESC, 0x2D, enable ? 0x01 : 0x00]);
}

/** Set print mode */
function cmdPrintMode(mode) {
  return Buffer.from([ESC, 0x21, mode]);
}

/** Set alignment */
function cmdAlign(alignment) {
  return Buffer.from([ESC, 0x61, alignment]);
}

/** Set line spacing */
function cmdLineSpacing(lines) {
  return Buffer.from([ESC, 0x33, lines]);
}

/** Print and feed n lines */
function cmdFeedLines(n) {
  return Buffer.from([ESC, 0x64, n]);
}

/** Print and feed n dots */
function cmdFeedDots(n) {
  return Buffer.from([ESC, 0x4A, n]);
}

/** Cut paper */
function cmdCut(mode) {
  return Buffer.from([GS, 0x56, mode || CUT_PARTIAL]);
}

/** Pulse cash drawer */
function cmdCashDrawer() {
  return Buffer.from([ESC, 0x70, 0x00, 0x19, 0x78]);
}

/** Set character set */
function cmdCharset(charset) {
  return Buffer.from([ESC, 0x52, charset]);
}

/** Print barcode (CODE128) */
function cmdBarcode(data, type) {
  const typeCode = type || BARCODE_CODE128;
  const dataBytes = Buffer.from(data, 'ascii');
  const len = dataBytes.length;
  // GS k m d1...dn n
  return Buffer.from([GS, 0x6B, typeCode, ...dataBytes, 0x00]);
}

/** Print QR Code */
function cmdQRCode(data, size) {
  const moduleSize = size || 6; // 1-16
  const errorCorrection = 0x31; // 30%
  const dataBytes = Buffer.from(data, 'utf8');
  const len = dataBytes.length;
  const lenL = len & 0xFF;
  const lenH = (len >> 8) & 0xFF;

  return Buffer.concat([
    // Set QR module size
    Buffer.from([GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, moduleSize]),
    // Set error correction
    Buffer.from([GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, errorCorrection]),
    // Store data
    Buffer.from([GS, 0x28, 0x6B, lenL + 3, lenH, 0x31, 0x50, 0x30, ...dataBytes]),
    // Print
    Buffer.from([GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x30]),
  ]);
}

/**
 * Convert a 1-bit monochrome image to ESC/POS raster bit image format.
 * Input: Buffer of image data (1 byte per pixel, 0=white, 1=black)
 * width: image width in pixels
 * height: image height in pixels
 */
function cmdRasterImage(imageData, width, height) {
  // Each row is (width + 7) / 8 bytes, padded to full bytes
  const bytesPerRow = Math.ceil(width / 8);
  const header = Buffer.from([
    GS, 0x76, 0x30, 0x00,  // GS v 0 mode 0
    (bytesPerRow) & 0xFF, ((bytesPerRow) >> 8) & 0xFF,  // width in bytes
    height & 0xFF, (height >> 8) & 0xFF,  // height
  ]);

  const rows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(bytesPerRow, 0x00);
    for (let x = 0; x < width; x++) {
      const pixelIndex = y * width + x;
      const pixel = imageData[pixelIndex];
      if (pixel > 0) {
        const byteIndex = Math.floor(x / 8);
        const bitIndex = 7 - (x % 8);
        row[byteIndex] |= (1 << bitIndex);
      }
    }
    rows.push(row);
  }

  return Buffer.concat([header, ...rows]);
}

/**
 * Convert a base64 PNG/JPEG image to ESC/POS raster image.
 * Uses Electron's nativeImage for decoding.
 */
function imageToRaster(base64Data) {
  try {
    const { nativeImage } = require('electron');
    // Remove data URL prefix if present
    const base64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const img = nativeImage.createFromBuffer(Buffer.from(base64, 'base64'));
    const size = img.getSize();

    if (size.width === 0 || size.height === 0) return null;

    // Resize to fit printer width (max 384 for 58mm)
    const maxWidth = printerConfig.width === 58 ? 384 : 576;
    let targetWidth = Math.min(size.width, maxWidth);
    let targetHeight = Math.round(size.height * (targetWidth / size.width));

    // Resize image
    const resized = img.resize({ width: targetWidth, height: targetHeight });
    const bitmap = resized.bitmap(); // RGBA buffer

    // Convert RGBA to 1-bit monochrome (threshold at 128)
    const monoData = Buffer.alloc(targetWidth * targetHeight, 0);
    for (let i = 0; i < targetWidth * targetHeight; i++) {
      const r = bitmap[i * 4];
      const g = bitmap[i * 4 + 1];
      const b = bitmap[i * 4 + 2];
      const a = bitmap[i * 4 + 3];
      // If pixel is mostly dark (and not transparent), it's black
      const brightness = (r + g + b) / 3;
      if (a > 128 && brightness < 128) {
        monoData[i] = 1;
      }
    }

    return cmdRasterImage(monoData, targetWidth, targetHeight);
  } catch (err) {
    console.error('[Printer] Image conversion failed:', err.message);
    return null;
  }
}

// ============================================================
// RECEIPT BUILDER — High-level receipt construction
// ============================================================

/**
 * Receipt builder for creating ESC/POS receipts.
 * Usage:
 *   const rb = createReceiptBuilder();
 *   rb.init();
 *   rb.setText('Hello World', ALIGN_CENTER, EMPHASIZED | DOUBLE_H);
 *   rb.feed(2);
 *   rb.cut();
 *   const buffer = rb.build();
 */
function createReceiptBuilder() {
  const commands = [];

  return {
    init() {
      commands.push(cmdInit());
      commands.push(cmdCharset(printerConfig.charset));
      // Set MAXIMUM darkness for full black print
      commands.push(cmdDensity(8));          // Maximum density (darkest)
      commands.push(cmdPrintSpeed(2));       // Slowest speed (darkest print)
      commands.push(cmdDoubleStrike(true));  // Double-strike for darker
      commands.push(cmdSetEmphasized(true)); // Bold mode ON (stays on)
      commands.push(cmdLineSpacing(printerConfig.lineSpacing));
    },

    setText(text, align, mode) {
      if (align !== undefined) commands.push(cmdAlign(align));
      if (mode !== undefined) commands.push(cmdPrintMode(mode));
      commands.push(Buffer.from(text + '\n', 'utf8'));
      // After each line, reset print mode but KEEP bold (emphasized) on
      // This ensures all text is full black/bold
      if (mode !== undefined) {
        commands.push(cmdPrintMode(FONT_A)); // Reset size
        commands.push(cmdSetEmphasized(true)); // Keep bold ON
      }
    },

    text(text) {
      commands.push(Buffer.from(text, 'utf8'));
    },

    line(text, align, mode) {
      this.setText(text, align, mode);
    },

    /** Add a dashed separator line */
    separator() {
      const chars = printerConfig.width === 58 ? 32 : 48;
      commands.push(cmdAlign(ALIGN_CENTER));
      commands.push(Buffer.from('-'.repeat(chars) + '\n', 'ascii'));
    },

    /** Add a double separator line */
    doubleSeparator() {
      const chars = printerConfig.width === 58 ? 32 : 48;
      commands.push(cmdAlign(ALIGN_CENTER));
      commands.push(Buffer.from('='.repeat(chars) + '\n', 'ascii'));
    },

    /** Add blank line(s) */
    feed(n) {
      commands.push(cmdFeedLines(n || 1));
    },

    /** Add barcode */
    barcode(data, type) {
      commands.push(cmdAlign(ALIGN_CENTER));
      commands.push(cmdBarcode(data, type));
      commands.push(Buffer.from([LF]));
    },

    /** Add QR code */
    qrcode(data, size) {
      commands.push(cmdAlign(ALIGN_CENTER));
      commands.push(cmdQRCode(data, size));
      commands.push(Buffer.from([LF]));
    },

    /** Add logo/image from base64 */
    image(base64Data) {
      const imgCmd = imageToRaster(base64Data);
      if (imgCmd) {
        commands.push(cmdAlign(ALIGN_CENTER));
        commands.push(imgCmd);
        commands.push(Buffer.from([LF]));
      }
    },

    /** Cut paper */
    cut(mode) {
      if (printerConfig.autoCut) {
        commands.push(cmdFeedLines(3)); // Feed before cut
        commands.push(cmdCut(mode || CUT_PARTIAL));
      }
    },

    /** Pulse cash drawer */
    cashDrawer() {
      if (printerConfig.cashDrawer) {
        commands.push(cmdCashDrawer());
      }
    },

    /** Set print mode */
    setMode(mode) {
      commands.push(cmdPrintMode(mode));
    },

    /** Set alignment */
    setAlign(align) {
      commands.push(cmdAlign(align));
    },

    /** Build final buffer */
    build() {
      return Buffer.concat(commands.map(cmd => Buffer.isBuffer(cmd) ? cmd : Buffer.from(cmd)));
    },

    /** Get raw commands array */
    getCommands() {
      return commands;
    },
  };
}

// ============================================================
// PRINT QUEUE — Sequential printing with retry
// ============================================================

/**
 * Add a print job to the queue and process it.
 */
async function enqueuePrint(job) {
  printQueue.push(job);
  if (!isPrinting) {
    processQueue();
  }
}

/**
 * Process the print queue sequentially.
 */
async function processQueue() {
  if (isPrinting || printQueue.length === 0) return;
  isPrinting = true;

  while (printQueue.length > 0) {
    const job = printQueue.shift();
    try {
      const port = printerConfig.comPort || (autoDetectPrinter()?.port || '');
      if (!port) {
        console.error('[Printer] No COM port available');
        lastError = 'No COM port detected';
        continue;
      }

      const success = await writeWithRetry(port, job.data, 2);
      if (success) {
        console.log('[Printer] Print job completed:', job.type);
      } else {
        console.error('[Printer] Print job failed after retries:', job.type);
      }
    } catch (err) {
      console.error('[Printer] Print job error:', err.message);
      lastError = err.message;
    }
  }

  isPrinting = false;
}

// ============================================================
// PUBLIC API
// ============================================================

/**
 * Get current printer configuration.
 */
function getConfig() {
  return { ...printerConfig };
}

/**
 * Update printer configuration.
 */
function setConfig(newConfig) {
  printerConfig = { ...printerConfig, ...newConfig };
  return getConfig();
}

/**
 * Test print — sends "Hello BAGA HMS" to verify printer connectivity.
 */
async function testPrint() {
  try {
    const port = printerConfig.comPort || (autoDetectPrinter()?.port || '');
    if (!port) {
      return { success: false, error: 'No COM port detected. Please set COM port in Settings.' };
    }

    const rb = createReceiptBuilder();
    rb.init();
    rb.feed(1);
    rb.setText('BAGA HMS', ALIGN_CENTER, EMPHASIZED | DOUBLE_H | DOUBLE_V);
    rb.setText('Printer Test', ALIGN_CENTER, EMPHASIZED);
    rb.separator();
    rb.setText(`Port: ${port}`, ALIGN_CENTER);
    rb.setText(`Width: ${printerConfig.width}mm`, ALIGN_CENTER);
    rb.setText(`Date: ${new Date().toLocaleString()}`, ALIGN_CENTER);
    rb.separator();
    rb.setText('Hello BAGA HMS!', ALIGN_CENTER, DOUBLE_H);
    rb.setText('Printer is working correctly.', ALIGN_CENTER);
    rb.feed(2);
    rb.qrcode('BAGA-HMS-TEST', 6);
    rb.feed(1);
    rb.barcode('BAGA123', BARCODE_CODE128);
    rb.feed(2);
    rb.cut();

    const data = rb.build();
    const success = await writeWithRetry(port, data, 2);

    if (success) {
      return { success: true, port, message: 'Test print sent successfully!' };
    } else {
      return { success: false, error: `Failed to write to ${port}. Check if printer is connected and COM port is correct.` };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Print a receipt from HTML content.
 * Converts common HTML receipt elements to ESC/POS commands.
 */
async function printReceipt(htmlContent, options) {
  try {
    if (!printerConfig.enabled) {
      return { success: false, error: 'Thermal printer is not enabled. Enable it in Settings.' };
    }

    const port = printerConfig.comPort || (autoDetectPrinter()?.port || '');
    if (!port) {
      return { success: false, error: 'No COM port detected.' };
    }

    // Build receipt from HTML
    const rb = createReceiptBuilder();
    rb.init();
    rb.cashDrawer();

    // Parse HTML and convert to ESC/POS
    // Strip HTML tags but preserve text content and structure
    const text = htmlContent
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi, (match, src) => {
        // If it's a base64 image, add it as raster image
        if (src.startsWith('data:image')) {
          rb.image(src);
        }
        return '';
      })
      .replace(/<\/?(div|p|table|tr|td|th|thead|tbody|tfoot)[^>]*>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<hr[^>]*>/gi, '\n---\n')
      .replace(/<\/?(b|strong)[^>]*>/gi, '')
      .replace(/<\/?(i|em)[^>]*>/gi, '')
      .replace(/<h[1-6][^>]*>/gi, '\n')
      .replace(/<\/h[1-6]>/gi, '\n')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/<[^>]+>/g, '') // Remove remaining tags
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n'); // Collapse multiple newlines

    // Split into lines and process
    const lines = text.split('\n');
    const maxWidth = printerConfig.width === 58 ? 32 : 48;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === '') {
        rb.feed(1);
        continue;
      }
      if (trimmed === '---' || trimmed === '-' .repeat(maxWidth) || trimmed === '=' .repeat(maxWidth)) {
        rb.separator();
        continue;
      }
      // Check if line looks like a title (all caps, short)
      if (trimmed === trimmed.toUpperCase() && trimmed.length < maxWidth && trimmed.length > 3) {
        rb.setText(trimmed, ALIGN_CENTER, EMPHASIZED | DOUBLE_H);
      } else if (trimmed.length > maxWidth) {
        // Wrap long lines — ALL text is bold (emphasized stays on from init)
        const words = trimmed.split(' ');
        let currentLine = '';
        for (const word of words) {
          if ((currentLine + ' ' + word).length > maxWidth) {
            rb.setText(currentLine, ALIGN_LEFT, EMPHASIZED);
            currentLine = word;
          } else {
            currentLine = currentLine ? currentLine + ' ' + word : word;
          }
        }
        if (currentLine) rb.setText(currentLine, ALIGN_LEFT, EMPHASIZED);
      } else {
        // ALL text is bold/EMPHASIZED for full black print
        rb.setText(trimmed, ALIGN_LEFT, EMPHASIZED);
      }
    }

    rb.feed(2);
    rb.cut();

    const data = rb.build();

    // Add to print queue
    await enqueuePrint({ type: options?.type || 'receipt', data });

    return { success: true, message: 'Print job queued' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Get printer status.
 */
function getStatus() {
  const detected = autoDetectPrinter();
  return {
    enabled: printerConfig.enabled,
    comPort: printerConfig.comPort || detected?.port || '',
    detectedPort: detected?.port || '',
    detectedDescription: detected?.description || '',
    width: printerConfig.width,
    baudRate: printerConfig.baudRate,
    queueLength: printQueue.length,
    isPrinting: isPrinting,
    lastError: lastError,
    autoCut: printerConfig.autoCut,
  };
}

/**
 * Detect and auto-configure printer.
 */
function detectPrinter() {
  const result = listComPorts();
  const detected = autoDetectPrinter();
  if (detected) {
    printerConfig.comPort = detected.port;
  }
  return {
    success: true,
    detected: detected,
    ports: result.ports,
    config: getConfig(),
  };
}

// ============================================================
// EXPORTS
// ============================================================
module.exports = {
  // Configuration
  getConfig,
  setConfig,
  getStatus,
  detectPrinter,
  listComPorts,
  // Printing
  testPrint,
  printReceipt,
  enqueuePrint,
  // Receipt builder
  createReceiptBuilder,
  // Constants
  ALIGN_LEFT,
  ALIGN_CENTER,
  ALIGN_RIGHT,
  FONT_A,
  FONT_B,
  EMPHASIZED,
  DOUBLE_H,
  DOUBLE_V,
  UNDERLINE,
  BARCODE_CODE128,
  BARCODE_CODE39,
  BARCODE_EAN13,
  CUT_FULL,
  CUT_PARTIAL,
};
