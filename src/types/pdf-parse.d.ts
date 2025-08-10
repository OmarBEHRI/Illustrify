declare module 'pdf-parse' {
  interface PDFData {
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: any;
    version: string;
    text: string;
  }
  function pdf(dataBuffer: Buffer | Uint8Array | ArrayBuffer | string, options?: Record<string, unknown>): Promise<PDFData>;
  export default pdf;
}


