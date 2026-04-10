import pdfParse from "pdf-parse";
import { readStoredFile } from "@/lib/storage-provider";
import type { StoredReport } from "@/lib/report-types";

export async function extractPdfText(report: StoredReport) {
  const buffer = await readStoredFile(report.fileKey, "upload");
  const parsed = await pdfParse(Buffer.from(buffer));

  return {
    text: parsed.text?.trim() || "",
    pageCount: parsed.numpages || 0,
    info: parsed.info || {},
  };
}
