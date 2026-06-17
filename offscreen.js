chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "convert-image") {
    convertImageToJpeg(message.url, message.filename);
  }
});

function convertImageToJpeg(imageUrl, filename) {
  const img = new Image();
  
  img.onload = function () {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    ctx.drawImage(img, 0, 0);

    // 1.0 Quality ensures production-grade uncompressed output
    const dataUrl = canvas.toDataURL('image/jpeg', 1.0);

    chrome.runtime.sendMessage({
      type: 'download-jpeg',
      dataUrl: dataUrl,
      filename: filename
    });
  };

  img.onerror = function () {
    chrome.runtime.sendMessage({ type: 'error-close' });
  };

  img.src = imageUrl;
}