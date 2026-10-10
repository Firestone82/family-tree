/** pdf.js's worker module, loaded on the main thread when a PDF is opened (see core/services/background-import.ts). */
declare module 'pdfjs-dist/build/pdf.worker.min.mjs' {
  export const WorkerMessageHandler: unknown;
}
