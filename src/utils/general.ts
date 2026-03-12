export function base64ToFile(
  base64: string,
  filename: string,
  type?: string,
): File {
  // Handle case where base64 might not have data URI prefix
  if (!base64.includes(",")) {
    // If no comma found, assume it's missing the data URI prefix
    const mimeType =
      type || (filename.endsWith(".png") ? "image/png" : "image/jpeg");
    base64 = `data:${mimeType};base64,${base64}`;
  }

  const arr = base64.split(",");
  if (!arr[0]) {
    throw new Error("Invalid base64 string");
  }
  // Extract MIME type from the data URI, or use provided type
  const mime =
    type || arr[0].match(/:(.*?);/)?.[1] || "application/octet-stream";

  if (!arr[1]) {
    throw new Error("Invalid base64 string, no data found");
  }
  // Decode base64
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }

  return new File([u8arr], filename, { type: mime });
}

// ----------------------------
// File Serialization Helpers
// ----------------------------
export function fileToBase64(fileObj: any): Promise<string> {
  return new Promise((resolve, reject) => {
    // If it's a proper Blob/File
    if (fileObj instanceof Blob) {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(fileObj);
    }
    // If we have a file path (which appears to be in your object)
    else if (fileObj && fileObj.webkitRelativePath) {
      fetch(fileObj.webkitRelativePath)
        .then((response) => response.blob())
        .then((blob) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        })
        .catch(reject);
    }
    // Last resort: try to convert to Blob
    else if (fileObj && fileObj.type) {
      try {
        const blob = new Blob([fileObj], { type: fileObj.type });
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      } catch (error) {
        reject(error);
      }
    } else {
      reject(new Error("Unable to process file object"));
    }
  });
}
