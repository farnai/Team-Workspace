import path from "path";

export const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024; // 25 MB

/**
 * Known binary file signatures (Magic Bytes)
 */
const MAGIC_SIGNATURES: { mime: string; ext: string[]; check: (buf: Buffer) => boolean }[] = [
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  {
    mime: "image/png",
    ext: [".png"],
    check: (buf) =>
      buf.length >= 8 &&
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47 &&
      buf[4] === 0x0d &&
      buf[5] === 0x0a &&
      buf[6] === 0x1a &&
      buf[7] === 0x0a,
  },
  // JPEG / JPG: FF D8 FF
  {
    mime: "image/jpeg",
    ext: [".jpg", ".jpeg"],
    check: (buf) => buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
  },
  // GIF: 47 49 46 38
  {
    mime: "image/gif",
    ext: [".gif"],
    check: (buf) =>
      buf.length >= 4 &&
      buf[0] === 0x47 &&
      buf[1] === 0x49 &&
      buf[2] === 0x46 &&
      buf[3] === 0x38,
  },
  // WebP: RIFF .... WEBP
  {
    mime: "image/webp",
    ext: [".webp"],
    check: (buf) =>
      buf.length >= 12 &&
      buf.toString("ascii", 0, 4) === "RIFF" &&
      buf.toString("ascii", 8, 12) === "WEBP",
  },
  // PDF: %PDF
  {
    mime: "application/pdf",
    ext: [".pdf"],
    check: (buf) => buf.length >= 4 && buf.toString("ascii", 0, 4) === "%PDF",
  },
  // ZIP / DOCX / XLSX: PK\x03\x04
  {
    mime: "application/zip",
    ext: [".zip", ".docx", ".xlsx", ".pptx"],
    check: (buf) =>
      buf.length >= 4 &&
      buf[0] === 0x50 &&
      buf[1] === 0x4b &&
      buf[2] === 0x03 &&
      buf[3] === 0x04,
  },
];

/**
 * Dangerous file extensions that must always be rejected
 */
const DANGEROUS_EXTENSIONS = new Set([
  ".exe",
  ".bat",
  ".cmd",
  ".sh",
  ".php",
  ".vbs",
  ".msi",
  ".jar",
  ".ps1",
  ".scr",
  ".dll",
  ".com",
  ".pif",
  ".reg",
  ".hta",
  ".cpl",
  ".html",
  ".htm",
  ".xhtml",
  ".svg",
  ".js",
  ".mjs",
  ".cjs",
]);

/**
 * Check if the buffer starts with executable PE/DOS magic bytes (MZ = 0x4D 0x5A)
 * or ELF magic bytes (\x7fELF = 0x7F 0x45 0x4C 0x46)
 */
export function containsExecutableSignature(buffer: Buffer): boolean {
  if (buffer.length >= 2 && buffer[0] === 0x4d && buffer[1] === 0x5a) {
    return true; // DOS/Windows PE Executable
  }
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x7f &&
    buffer[1] === 0x45 &&
    buffer[2] === 0x4c &&
    buffer[3] === 0x46
  ) {
    return true; // Linux ELF Executable
  }
  return false;
}

/**
 * Verify file signature against extension and declared MIME type.
 * Returns true if valid and safe, false if rejected or malicious.
 */
export function validateFileIntegrity(
  buffer: Buffer,
  declaredName: string,
  declaredMime: string
): { isValid: boolean; error?: string } {
  const ext = (path.extname(declaredName) || "").toLowerCase();

  // 1. Reject dangerous extensions
  if (DANGEROUS_EXTENSIONS.has(ext)) {
    return {
      isValid: false,
      error: "ამ ტიპის ფაილის ატვირთვა აკრძალულია უსაფრთხოების წესების შესაბამისად",
    };
  }

  // 2. Reject executable signatures even if disguised as another extension
  if (containsExecutableSignature(buffer)) {
    return {
      isValid: false,
      error: "აღმოჩენილია საშიში შესრულებადი ფაილის ბინარული ხელმოწერა",
    };
  }

  // 3. For images & PDFs, verify true magic bytes
  const matchingSig = MAGIC_SIGNATURES.find(
    (s) => s.ext.includes(ext) || s.mime === declaredMime
  );

  if (matchingSig) {
    if (!matchingSig.check(buffer)) {
      return {
        isValid: false,
        error: "ფაილის შიგთავსი არ შეესაბამება მითითებულ ფორმატს (Invalid file signature)",
      };
    }
  }

  // 4. For plain text files (.txt, .csv, .md, .json)
  if ([".txt", ".csv", ".json", ".md"].includes(ext)) {
    // Check for null bytes which indicate binary disguised as text
    for (let i = 0; i < Math.min(buffer.length, 512); i++) {
      if (buffer[i] === 0) {
        return {
          isValid: false,
          error: "ტექსტური ფაილი შეიცავს დაუშვებელ ბინარულ მონაცემებს",
        };
      }
    }
  }

  return { isValid: true };
}

/**
 * Verify that the target path resolves strictly inside the allowed root directory
 * to prevent directory traversal attacks.
 */
export function isPathContained(targetPath: string, rootDir: string): boolean {
  const resolvedTarget = path.resolve(targetPath);
  const resolvedRoot = path.resolve(rootDir);
  return (
    resolvedTarget.startsWith(resolvedRoot + path.sep) || resolvedTarget === resolvedRoot
  );
}
