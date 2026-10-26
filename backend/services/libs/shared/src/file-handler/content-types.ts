/**
 * Extension to MIME type. Shared between the file handlers, which stamp it on
 * the blob at upload time, and the Graph email backend, which has to declare a
 * contentType on every attachment it inlines. Kept in one place so an addition
 * here cannot leave one of the two guessing application/octet-stream.
 */
const CONTENT_TYPES = {
  csv: "text/csv",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  json: "application/json",
  pdf: "application/pdf",
  png: "image/png",
  txt: "text/plain",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export function contentTypeForPath(path: string): string {
  const extension = path.split(".").pop()?.toLowerCase();
  return CONTENT_TYPES[extension] || "application/octet-stream";
}
