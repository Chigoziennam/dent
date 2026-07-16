/// <reference types="vite/client" />

declare module 'html2pdf.js' {
  interface Html2Pdf {
    set(opts: Record<string, unknown>): Html2Pdf
    from(el: HTMLElement): Html2Pdf
    save(): Promise<void>
  }
  export default function html2pdf(): Html2Pdf
}
