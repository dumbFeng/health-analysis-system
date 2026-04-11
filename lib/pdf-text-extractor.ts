import pdfParse from "pdf-parse";
import { getStorageKeyFromPath, readStoredFile } from "@/lib/storage-provider";
import type { StoredReport } from "@/lib/report-types";

export async function extractPdfText(report: StoredReport) {
  const buffer = await readStoredFile(
    getStorageKeyFromPath(report.sourceFilePath, "upload"),
    "upload",
  );
  const parsed = await pdfParse(Buffer.from(buffer));

  return {
    text: parsed.text?.trim() || "",
    pageCount: parsed.numpages || 0,
    info: parsed.info || {},
  };
}
