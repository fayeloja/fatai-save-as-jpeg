chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    // Parent context menu
    chrome.contextMenus.create({
      id: "saveAsFormat",
      title: "Save Image As...",
      contexts: ["image"],
    });

    // Child context menus for different formats
    chrome.contextMenus.create({
      id: "saveAsPNG",
      parentId: "saveAsFormat",
      title: "PNG",
      contexts: ["image"],
    });

    chrome.contextMenus.create({
      id: "saveAsJPEG",
      parentId: "saveAsFormat",
      title: "JPEG",
      contexts: ["image"],
    });

    chrome.contextMenus.create({
      id: "saveAsWebP",
      parentId: "saveAsFormat",
      title: "WebP",
      contexts: ["image"],
    });

    // Option to open interactive editor
    chrome.contextMenus.create({
      id: "saveWithOptions",
      parentId: "saveAsFormat",
      title: "Custom Crop & Scale...",
      contexts: ["image"],
    });
  });
});

// Helper function to convert Uint8Array to base64 in chunks (avoiding call stack size exceeded)
function uint8ArrayToBase64(uint8) {
  let binary = "";
  const len = uint8.byteLength;
  const chunk = 8192;
  for (let i = 0; i < len; i += chunk) {
    binary += String.fromCharCode.apply(null, uint8.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// Helper function to clean and generate a safe filename with the target extension
function getFilename(srcUrl, targetExt) {
  if (srcUrl.startsWith("data:")) {
    return `image${targetExt}`;
  }
  try {
    const url = new URL(srcUrl);
    // 1. Try to find a filename in the query parameters
    for (const [key, value] of url.searchParams.entries()) {
      if (value && value.includes(".") && (key.toLowerCase().includes("file") || key.toLowerCase().includes("name") || key.toLowerCase().includes("img"))) {
        const decodedValue = decodeURIComponent(value);
        const cleanName = decodedValue.substring(0, decodedValue.lastIndexOf(".")).replace(/[^a-zA-Z0-9-_]/g, "_");
        if (cleanName) {
          return `${cleanName}${targetExt}`;
        }
      }
    }

    // 2. Fall back to pathname
    const pathname = decodeURIComponent(url.pathname);
    const lastSegment = pathname.substring(pathname.lastIndexOf("/") + 1);

    if (lastSegment) {
      let nameWithoutExt = lastSegment;
      if (lastSegment.includes(".")) {
        nameWithoutExt = lastSegment.substring(0, lastSegment.lastIndexOf("."));
      }
      const cleanName = nameWithoutExt.replace(/[^a-zA-Z0-9-_]/g, "_");
      if (cleanName) {
        return `${cleanName}${targetExt}`;
      }
    }
  } catch (e) {
    // Fallback if URL parsing fails
  }
  return `image${targetExt}`;
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "saveWithOptions" && info.srcUrl) {
    chrome.storage.local.set({ selectedImageUrl: info.srcUrl }, () => {
      chrome.tabs.create({ url: chrome.runtime.getURL("editor.html") });
    });
    return;
  }

  const allowedMenus = ["saveAsPNG", "saveAsJPEG", "saveAsWebP"];
  if (!allowedMenus.includes(info.menuItemId) || !info.srcUrl) return;

  // Determine target format settings
  let targetMime = "image/png";
  let targetExt = ".png";
  let fillBackground = false;
  let quality = undefined;

  if (info.menuItemId === "saveAsJPEG") {
    targetMime = "image/jpeg";
    targetExt = ".jpg";
    fillBackground = true;
    quality = 1.0;
  } else if (info.menuItemId === "saveAsWebP") {
    targetMime = "image/webp";
    targetExt = ".webp";
    quality = 1.0;
  }

  try {
    // 1. Fetch image data securely using extension privileges
    const response = await fetch(info.srcUrl);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const blob = await response.blob();

    // 2. Create ImageBitmap from Blob
    const imageBitmap = await createImageBitmap(blob);

    // 3. Draw on OffscreenCanvas
    const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
    const ctx = canvas.getContext("2d");

    if (fillBackground) {
      // Fill white background for transparent images on JPEG conversion
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Draw the image
    ctx.drawImage(imageBitmap, 0, 0);

    // 4. Convert canvas to target format blob with maximum quality
    const convertedBlob = await canvas.convertToBlob({
      type: targetMime,
      quality: quality,
    });

    // 5. Convert target format blob to Data URL
    const buffer = await convertedBlob.arrayBuffer();
    const base64 = uint8ArrayToBase64(new Uint8Array(buffer));
    const dataUrl = `data:${targetMime};base64,${base64}`;

    // 6. Trigger the download with clean filename and target extension
    chrome.downloads.download({
      url: dataUrl,
      filename: getFilename(info.srcUrl, targetExt),
      saveAs: true,
    });

    // Clean up memory
    imageBitmap.close();
  } catch (error) {
    console.error(
      `Conversion to ${targetExt} failed, attempting direct download fallback:`,
      error,
    );

    // Fallback: If canvas conversion completely fails, still try to download the original file
    chrome.downloads.download({
      url: info.srcUrl,
      saveAs: true,
    });
  }
});
