// Editor JS - Handle interactive cropping, scaling and custom saving.

document.addEventListener("DOMContentLoaded", async () => {
  // Elements
  const sourceImage = document.getElementById("sourceImage");
  const cropContainer = document.getElementById("cropContainer");
  const cropOverlay = document.getElementById("cropOverlay");
  const cropBox = document.getElementById("cropBox");
  
  const origResolution = document.getElementById("origResolution");
  const outputResolution = document.getElementById("outputResolution");
  
  const scaleSlider = document.getElementById("scaleSlider");
  const scaleValue = document.getElementById("scaleValue");
  const widthInput = document.getElementById("widthInput");
  const heightInput = document.getElementById("heightInput");
  const lockAspectCheckbox = document.getElementById("lockAspectCheckbox");
  
  const formatSelect = document.getElementById("formatSelect");
  const qualitySlider = document.getElementById("qualitySlider");
  const qualityValue = document.getElementById("qualityValue");
  const qualityControlSection = document.getElementById("qualityControlSection");
  
  const filenameInput = document.getElementById("filenameInput");
  const btnCancel = document.getElementById("btnCancel");
  const btnSave = document.getElementById("btnSave");
  
  // State
  let imageLoaded = false;
  let naturalW = 0;
  let naturalH = 0;
  let scale = 1.0;
  let activeRatio = "free"; // "free", "1:1", "16:9", etc.
  
  // Crop coordinates relative to displayed dimensions of image
  let cropX = 0;
  let cropY = 0;
  let cropW = 0;
  let cropH = 0;
  
  // Load target image
  try {
    const data = await chrome.storage.local.get("selectedImageUrl");
    if (data.selectedImageUrl) {
      sourceImage.src = data.selectedImageUrl;
      sourceImage.style.display = "block";
      
      // Seed filename
      setInitialFilename(data.selectedImageUrl);
    } else {
      alert("No image found to edit. Please close this tab and try again.");
    }
  } catch (err) {
    console.error("Error loading image from storage:", err);
  }

  // Once image is loaded
  sourceImage.onload = () => {
    naturalW = sourceImage.naturalWidth;
    naturalH = sourceImage.naturalHeight;
    origResolution.textContent = `${naturalW} × ${naturalH} px`;
    
    // Set container to match sourceImage layout
    resizeCropOverlay();
    
    // Default crop box covers entire image initially
    resetCropBox();
    
    imageLoaded = true;
    cropOverlay.style.display = "block";
    
    updateOutputResolution();
  };

  // Helper to set clean initial filename
  function setInitialFilename(srcUrl) {
    if (srcUrl.startsWith("data:")) {
      filenameInput.value = "image";
      return;
    }
    try {
      const url = new URL(srcUrl);
      const pathname = decodeURIComponent(url.pathname);
      const lastSegment = pathname.substring(pathname.lastIndexOf("/") + 1);
      if (lastSegment) {
        let name = lastSegment;
        if (lastSegment.includes(".")) {
          name = lastSegment.substring(0, lastSegment.lastIndexOf("."));
        }
        filenameInput.value = name.replace(/[^a-zA-Z0-9-_]/g, "_") || "image";
      } else {
        filenameInput.value = "image";
      }
    } catch (e) {
      filenameInput.value = "image";
    }
  }

  // Adjust crop overlay dimension to match sourceImage displayed size
  function resizeCropOverlay() {
    const rect = sourceImage.getBoundingClientRect();
    cropOverlay.style.width = `${sourceImage.clientWidth}px`;
    cropOverlay.style.height = `${sourceImage.clientHeight}px`;
    cropOverlay.style.top = `${sourceImage.offsetTop}px`;
    cropOverlay.style.left = `${sourceImage.offsetLeft}px`;
  }

  window.addEventListener("resize", () => {
    if (!imageLoaded) return;
    
    // Remember percentage crop before resizing window
    const pX = cropX / sourceImage.clientWidth;
    const pY = cropY / sourceImage.clientHeight;
    const pW = cropW / sourceImage.clientWidth;
    const pH = cropH / sourceImage.clientHeight;
    
    resizeCropOverlay();
    
    // Apply percentage crop back to new displayed dimensions
    cropX = pX * sourceImage.clientWidth;
    cropY = pY * sourceImage.clientHeight;
    cropW = pW * sourceImage.clientWidth;
    cropH = pH * sourceImage.clientHeight;
    
    drawCropBox();
  });

  // Reset crop box to full image or custom ratio
  function resetCropBox() {
    const dispW = sourceImage.clientWidth;
    const dispH = sourceImage.clientHeight;
    
    if (activeRatio === "free") {
      cropX = 0;
      cropY = 0;
      cropW = dispW;
      cropH = dispH;
    } else {
      const ratioVal = getRatioValue(activeRatio);
      
      if (dispW / dispH > ratioVal) {
        // Image is wider than ratio
        cropH = dispH;
        cropW = cropH * ratioVal;
        cropX = (dispW - cropW) / 2;
        cropY = 0;
      } else {
        // Image is taller than ratio
        cropW = dispW;
        cropH = cropW / ratioVal;
        cropX = 0;
        cropY = (dispH - cropH) / 2;
      }
    }
    drawCropBox();
    updateOutputResolution();
  }

  function getRatioValue(ratioStr) {
    if (ratioStr === "1:1") return 1.0;
    if (ratioStr === "16:9") return 16 / 9;
    if (ratioStr === "4:3") return 4 / 3;
    if (ratioStr === "2:3") return 2 / 3;
    return 1.0;
  }

  function drawCropBox() {
    cropBox.style.left = `${cropX}px`;
    cropBox.style.top = `${cropY}px`;
    cropBox.style.width = `${cropW}px`;
    cropBox.style.height = `${cropH}px`;
  }

  // Drag and Resize Events
  let isDragging = false;
  let isResizing = false;
  let startX, startY, startW, startH, startCropX, startCropY;
  let currentHandle = "";

  cropBox.addEventListener("mousedown", (e) => {
    if (e.target.classList.contains("handle")) {
      isResizing = true;
      currentHandle = e.target.dataset.handle;
      startX = e.clientX;
      startY = e.clientY;
      startW = cropW;
      startH = cropH;
      startCropX = cropX;
      startCropY = cropY;
    } else {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startCropX = cropX;
      startCropY = cropY;
    }
    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!imageLoaded) return;
    
    const dispW = sourceImage.clientWidth;
    const dispH = sourceImage.clientHeight;

    if (isDragging) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      
      cropX = startCropX + dx;
      cropY = startCropY + dy;
      
      // Bounds checks
      cropX = Math.max(0, Math.min(dispW - cropW, cropX));
      cropY = Math.max(0, Math.min(dispH - cropH, cropY));
      
      drawCropBox();
      updateOutputResolution();
    } else if (isResizing) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      
      let newX = startCropX;
      let newY = startCropY;
      let newW = startW;
      let newH = startH;
      
      const lockAspect = lockAspectCheckbox.checked;
      const ratioVal = activeRatio === "free" ? (startW / startH) : getRatioValue(activeRatio);

      // Handle raw resizing
      if (currentHandle.includes("r")) newW = startW + dx;
      if (currentHandle.includes("b")) newH = startH + dy;
      
      if (currentHandle.includes("l")) {
        newW = startW - dx;
        newX = startCropX + dx;
      }
      if (currentHandle.includes("t")) {
        newH = startH - dy;
        newY = startCropY + dy;
      }

      // Min size limits
      const minSize = 20;
      if (newW < minSize) {
        if (currentHandle.includes("l")) newX = startCropX + startW - minSize;
        newW = minSize;
      }
      if (newH < minSize) {
        if (currentHandle.includes("t")) newY = startCropY + startH - minSize;
        newH = minSize;
      }

      // Max outer boundaries limits (Free aspect ratio)
      if (!lockAspect) {
        if (newX < 0) { newW += newX; newX = 0; }
        if (newY < 0) { newH += newY; newY = 0; }
        if (newX + newW > dispW) newW = dispW - newX;
        if (newY + newH > dispH) newH = dispH - newY;
      } else {
        // Locked aspect ratio calculations
        if (currentHandle === "r" || currentHandle === "b" || currentHandle === "br") {
          newH = newW / ratioVal;
          if (newY + newH > dispH) {
            newH = dispH - newY;
            newW = newH * ratioVal;
          }
          if (newX + newW > dispW) {
            newW = dispW - newX;
            newH = newW / ratioVal;
          }
        } else if (currentHandle === "l" || currentHandle === "t" || currentHandle === "tl") {
          newH = newW / ratioVal;
          newX = startCropX + startW - newW;
          newY = startCropY + startH - newH;
          
          if (newX < 0 || newY < 0) {
            if (newX < 0) {
              newW = startCropX + startW;
              newH = newW / ratioVal;
            }
            if (newY < 0) {
              newH = startCropY + startH;
              newW = newH * ratioVal;
            }
            newX = startCropX + startW - newW;
            newY = startCropY + startH - newH;
          }
        } else if (currentHandle === "tr") {
          newH = newW / ratioVal;
          newY = startCropY + startH - newH;
          if (newY < 0) {
            newH = startCropY + startH;
            newW = newH * ratioVal;
            newY = 0;
          }
          if (newX + newW > dispW) {
            newW = dispW - newX;
            newH = newW / ratioVal;
            newY = startCropY + startH - newH;
          }
        } else if (currentHandle === "bl") {
          newH = newW / ratioVal;
          newX = startCropX + startW - newW;
          if (newX < 0) {
            newW = startCropX + startW;
            newH = newW / ratioVal;
            newX = 0;
          }
          if (newY + newH > dispH) {
            newH = dispH - newY;
            newW = newH * ratioVal;
            newX = startCropX + startW - newW;
          }
        }
      }

      cropX = newX;
      cropY = newY;
      cropW = newW;
      cropH = newH;
      
      drawCropBox();
      updateOutputResolution();
    }
  });

  document.addEventListener("mouseup", () => {
    isDragging = false;
    isResizing = false;
  });

  // Ratio Presets Click handler
  document.querySelectorAll(".btn-preset").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".btn-preset").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      
      activeRatio = btn.dataset.ratio;
      
      if (activeRatio === "free") {
        lockAspectCheckbox.checked = false;
      } else {
        lockAspectCheckbox.checked = true;
      }
      
      resetCropBox();
    });
  });

  lockAspectCheckbox.addEventListener("change", () => {
    if (lockAspectCheckbox.checked && activeRatio === "free") {
      // Custom aspect ratio lock based on current box shape
      activeRatio = `${cropW}:${cropH}`;
    } else if (!lockAspectCheckbox.checked) {
      activeRatio = "free";
      document.querySelectorAll(".btn-preset").forEach(b => b.classList.remove("active"));
      document.querySelector('[data-ratio="free"]').classList.add("active");
    }
  });

  // Scale Controls & Resolution Inputs
  scaleSlider.addEventListener("input", () => {
    scale = parseFloat(scaleSlider.value);
    scaleValue.textContent = `${scale.toFixed(2)}x`;
    
    updateResolutionInputs();
  });

  widthInput.addEventListener("input", () => {
    if (!imageLoaded) return;
    const targetW = parseInt(widthInput.value);
    if (isNaN(targetW) || targetW < 10) return;
    
    const cropNaturalW = (cropW / sourceImage.clientWidth) * naturalW;
    scale = targetW / cropNaturalW;
    scaleSlider.value = scale;
    scaleValue.textContent = `${scale.toFixed(2)}x`;
    
    if (lockAspectCheckbox.checked) {
      const ratio = cropW / cropH;
      const targetH = Math.round(targetW / ratio);
      heightInput.value = targetH;
    }
    updateOutputResolution();
  });

  heightInput.addEventListener("input", () => {
    if (!imageLoaded) return;
    const targetH = parseInt(heightInput.value);
    if (isNaN(targetH) || targetH < 10) return;
    
    const cropNaturalH = (cropH / sourceImage.clientHeight) * naturalH;
    scale = targetH / cropNaturalH;
    scaleSlider.value = scale;
    scaleValue.textContent = `${scale.toFixed(2)}x`;
    
    if (lockAspectCheckbox.checked) {
      const ratio = cropW / cropH;
      const targetW = Math.round(targetH * ratio);
      widthInput.value = targetW;
    }
    updateOutputResolution();
  });

  function updateResolutionInputs() {
    if (!imageLoaded) return;
    
    const cropNaturalW = (cropW / sourceImage.clientWidth) * naturalW;
    const cropNaturalH = (cropH / sourceImage.clientHeight) * naturalH;
    
    widthInput.value = Math.round(cropNaturalW * scale);
    heightInput.value = Math.round(cropNaturalH * scale);
    
    updateOutputResolution();
  }

  function updateOutputResolution() {
    if (!imageLoaded) return;
    
    const cropNaturalW = (cropW / sourceImage.clientWidth) * naturalW;
    const cropNaturalH = (cropH / sourceImage.clientHeight) * naturalH;
    
    const targetW = Math.round(cropNaturalW * scale);
    const targetH = Math.round(cropNaturalH * scale);
    
    outputResolution.textContent = `${targetW} × ${targetH} px`;
    
    // Update input boxes if not currently focused to avoid layout jumps
    if (document.activeElement !== widthInput) widthInput.value = targetW;
    if (document.activeElement !== heightInput) heightInput.value = targetH;
  }

  // Format Selection Controls
  formatSelect.addEventListener("change", () => {
    if (formatSelect.value === "image/png") {
      qualityControlSection.style.opacity = "0.2";
      qualityControlSection.style.pointerEvents = "none";
    } else {
      qualityControlSection.style.opacity = "1";
      qualityControlSection.style.pointerEvents = "auto";
    }
  });

  qualitySlider.addEventListener("input", () => {
    qualityValue.textContent = `${qualitySlider.value}%`;
  });

  // Action Handlers
  btnCancel.addEventListener("click", () => {
    window.close();
  });

  btnSave.addEventListener("click", async () => {
    if (!imageLoaded) return;
    
    // Show Loader
    const btnText = btnSave.querySelector(".btn-text");
    const btnLoader = btnSave.querySelector(".btn-loader");
    btnText.style.display = "none";
    btnLoader.style.display = "inline";
    btnSave.disabled = true;

    try {
      const cropNaturalX = (cropX / sourceImage.clientWidth) * naturalW;
      const cropNaturalY = (cropY / sourceImage.clientHeight) * naturalH;
      const cropNaturalW = (cropW / sourceImage.clientWidth) * naturalW;
      const cropNaturalH = (cropH / sourceImage.clientHeight) * naturalH;

      const targetW = parseInt(widthInput.value) || Math.round(cropNaturalW * scale);
      const targetH = parseInt(heightInput.value) || Math.round(cropNaturalH * scale);
      
      const format = formatSelect.value;
      const quality = format === "image/png" ? undefined : parseFloat(qualitySlider.value) / 100;
      
      // Create Canvas
      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");

      // Fill white background for JPEG
      if (format === "image/jpeg") {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, targetW, targetH);
      }

      // Draw cropped & scaled image
      ctx.drawImage(
        sourceImage, 
        cropNaturalX, cropNaturalY, cropNaturalW, cropNaturalH, // Source
        0, 0, targetW, targetH // Destination
      );

      // Convert Canvas to Blob
      canvas.toBlob((blob) => {
        if (!blob) {
          throw new Error("Canvas exports failed.");
        }
        
        // Trigger Download
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        
        // Find correct extension
        let ext = ".jpg";
        if (format === "image/png") ext = ".png";
        if (format === "image/webp") ext = ".webp";
        
        const cleanName = filenameInput.value.replace(/[^a-zA-Z0-9-_]/g, "_") || "image";
        a.download = `${cleanName}${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Cleanup
        setTimeout(() => {
          URL.revokeObjectURL(blobUrl);
          btnText.style.display = "inline";
          btnLoader.style.display = "none";
          btnSave.disabled = false;
        }, 100);
      }, format, quality);
      
    } catch (err) {
      console.error("Save failed:", err);
      alert("Error occurred while generating image: " + err.message);
      btnText.style.display = "inline";
      btnLoader.style.display = "none";
      btnSave.disabled = false;
    }
  });
});
