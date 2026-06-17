chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "saveAsJPEG",
    title: "Save Any image as JPEG",
    contexts: ["image"],
  });
});

// Helper function to clean and generate a safe filename
function getFilename(srcUrl) {
  const timestamp = Date.now();
  try {
    const url = new URL(srcUrl);
    const pathname = url.pathname;
    const lastSegment = pathname.substring(pathname.lastIndexOf("/") + 1);

    if (lastSegment && lastSegment.includes(".")) {
      const nameWithoutExt = lastSegment.substring(
        0,
        lastSegment.lastIndexOf("."),
      );
      // Remove special characters to ensure OS compatibility
      const cleanName = nameWithoutExt.replace(/[^a-zA-Z0-9-_]/g, "_");
      return `${cleanName || "image"}_${timestamp}.jpg`;
    }
  } catch (e) {
    // Fallback if URL parsing fails
  }
  return `downloaded_image_${timestamp}.jpg`;
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "saveAsJPEGPro" || !info.srcUrl) return;

  // 1. Ensure any lingering offscreen documents are closed safely
  if (await chrome.offscreen.hasDocument()) {
    await chrome.offscreen.closeDocument();
  }

  // 2. Open a fresh offscreen document
  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["DOM_PARSER"],
    justification: "Convert image to JPEG via Canvas API",
  });

  try {
    // 3. Fetch image data securely using extension privileges
    const response = await fetch(info.srcUrl);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const blob = await response.blob();

    const reader = new FileReader();
    reader.onloadend = () => {
      chrome.runtime
        .sendMessage({
          type: "convert-image",
          url: reader.result,
          filename: getFilename(info.srcUrl),
        })
        .catch(() => {
          // Handle runtime disconnects gracefully
        });
    };
    reader.readAsDataURL(blob);
  } catch (error) {
    console.error(
      "Production Log - Fetch failed, attempting direct download fallback:",
      error,
    );

    // Fallback: If canvas conversion completely fails, still try to download the original file
    chrome.downloads.download({
      url: info.srcUrl,
      saveAs: true,
    });

    if (await chrome.offscreen.hasDocument()) {
      chrome.offscreen.closeDocument();
    }
  }
});

chrome.runtime.onMessage.addListener(async (message) => {
  if (message.type === "download-jpeg") {
    chrome.downloads.download({
      url: message.dataUrl,
      filename: message.filename,
      saveAs: true,
    });
  }

  if (message.type === "download-jpeg" || message.type === "error-close") {
    if (await chrome.offscreen.hasDocument()) {
      chrome.offscreen.closeDocument();
    }
  }
});
