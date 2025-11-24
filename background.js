chrome.action.onClicked.addListener((tab) => {
    // Inject CSS to change cursor to "wait"
    chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        css: "body { cursor: wait !important; }"
    });

    // Extract images from the page
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractImagesForGallery
    }, (results) => {
        if (results && results[0]?.result?.length > 0) {
            const images = results[0].result;
            const galleryHtml = createGalleryHtml(images);
            const galleryUrl = `data:text/html;charset=utf-8,${encodeURIComponent(galleryHtml)}`;

            // Open the popup window
            chrome.windows.create({
                url: galleryUrl,
                type: 'popup',
                width: 900,
                height: 700
            }, () => {
                // Remove the "wait" cursor after the popup opens
                chrome.scripting.removeCSS({
                    target: { tabId: tab.id },
                    css: "body { cursor: wait !important; }"
                });
            });
        } else {
            console.log('No images found.');
            chrome.scripting.removeCSS({
                target: { tabId: tab.id },
                css: "body { cursor: wait !important; }"
            });
        }
    });
});

function extractImagesForGallery() {
    const images = [];
    document.querySelectorAll('figure').forEach((figure) => {
        const img = figure.querySelector('img');
        const caption = figure.querySelector('figcaption');
        if (img && caption) {
            images.push({ src: img.src, caption: caption.textContent.replace("Image caption,","").trim() });
        }
    });
    return images;
}

function createGalleryHtml(images) {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Gallery Viewer</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 0;
                    background: #222;
                    color: white;
                    text-align: center;
                }

                /* Loading Spinner */
                .loading-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.9);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    flex-direction: column;
                    color: white;
                    font-size: 20px;
                    z-index: 9999;
                }

                .spinner {
                    border: 4px solid rgba(255, 255, 255, 0.3);
                    border-top: 4px solid white;
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    animation: spin 1s linear infinite;
                    margin-top: 10px;
                }

                @keyframes spin {
                    0% {
                        transform: rotate(0deg);
                    }
                    100% {
                        transform: rotate(360deg);
                    }
                }

                .gallery-container {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); /* Responsive columns */
                    grid-auto-rows: minmax(200px, auto);
                    grid-auto-flow: dense; /* Key for packing items tightly */
                    gap: 10px;
                    padding: 16px;
                    justify-content: center;
                    z-index: 1000;
                }

                .gallery-item {
                    cursor: pointer;
                    transition: transform 0.3s ease;
                    display: flex; /* Use flexbox for alignment within grid item */
                    justify-content: center; /* Center image horizontally */
                    align-items: center; /* Center image vertically */
                }

                .gallery-item:hover {
                    transform: scale(1.05);
                }

                .gallery-item img {
                    max-width: 100%; /* Image width limited to container */
                    max-height: 100%; /* Image height limited to container */
                    object-fit: contain; /* Maintain aspect ratio, fit within container */
                    border-radius: 8px;
                    border: 2px solid white;
                }
                
                .lightbox { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.8); justify-content: center; align-items: center; flex-direction: column; display: flex; z-index: 9999; }
                /* Lightbox Content */
                .lightbox-content {
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000; /* Ensure elements inside are clickable */
                }

                .lightbox-stage {
                    width: 100%;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 16px;
                }

                .lightbox-viewport {
                    position: relative;
                    width: 90%;
                    max-width: 1000px;
                    max-height: 75vh;
                    overflow: hidden;
                    background: transparent;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    cursor: zoom-in;
                }

                .lightbox-viewport.is-zoomed {
                    cursor: grab;
                }

                #lightbox-img {
                    max-width: 100%;
                    max-height: 70vh;
                    object-fit: contain;
                    transition: transform 0.1s ease-out;
                    transform-origin: center center;
                    user-select: none;
                    touch-action: none;
                    border: 5px solid white;
                    border-radius: 8px;
                    background: #000;
                    display: block;
                    box-sizing: border-box;
                }

                #lightbox-img.dragging {
                    cursor: grabbing;
                }

                .zoom-controls {
                    display: none;
                    gap: 10px;
                    align-items: center;
                    justify-content: center;
                    flex-wrap: wrap;
                }

                .zoom-controls.is-active {
                    display: flex;
                }

                .zoom-button {
                    background: rgba(255, 255, 255, 0.2);
                    border: 1px solid rgba(255, 255, 255, 0.4);
                    border-radius: 4px;
                    color: white;
                    font-size: 16px;
                    padding: 6px 12px;
                    cursor: pointer;
                    transition: background 0.2s ease;
                }

                .zoom-button:hover {
                    background: rgba(255, 255, 255, 0.35);
                }

                .zoom-indicator {
                    min-width: 48px;
                    text-align: center;
                    font-size: 14px;
                    font-weight: bold;
                }
               /* Dots Navigation */
                .dot-container {
                    display: flex;
                    gap: 6px;
                    justify-content: center;
                    margin-bottom: 4px;
                }

                .dot {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: gray;
                    opacity: 0.5;
                    transition: opacity 0.3s, background 0.3s;
                }

                .dot.active {
                    background: white;
                    opacity: 1;
                }
                .lightbox-caption { background: rgba(0, 0, 0, 0.7); color: white; padding: 10px; margin-top: 10px; border-radius: 5px; max-width: 70%; }
                .lightbox-nav { position: fixed; top: 50%; transform: translateY(-50%); font-size: 50px; color: white; cursor: pointer; z-index: 10001; }
                .prev { left: 20px; }
                .next { right: 20px; }
                .close { position: fixed; top: 10px; right: 20px; font-size: 30px; cursor: pointer; z-index: 10002;}
                .caption-toggle { position: absolute; bottom: 10px; right: 10px; background: rgba(0,0,0,0.5); padding: 5px; cursor: pointer; border-radius: 5px; }
            </style>
        </head>
        <body>
            <!-- Loading Spinner -->
            <div class="loading-overlay" id="loading">
                <div>Loading Gallery...</div>
                <div class="spinner"></div>
            </div>

            <div class="gallery-container" id="gallery-container">
                ${images.map(({ src, caption }, index) => `
                    <div class="gallery-item" onclick="openLightbox(${index})">
                        <img src="${src}" alt="${caption}" onload="checkImagesLoaded()">
                    </div>
                `).join('')}
            </div>

            <script>
                let imagesLoaded = 0;
                const totalImages = ${images.length};

                function checkImagesLoaded() {
                    imagesLoaded++;
                    if (imagesLoaded >= totalImages) {
                        document.getElementById("loading").style.display = "none";
                        closeLightbox();
                        document.getElementById("gallery-container").style.opacity = "1";
                    }
                }
            </script>

            <!-- Lightbox -->
            <div class="lightbox" id="lightbox">
                <div class="lightbox-content">
                    <span class="close" onclick="closeLightbox()">&times;</span>
                    <div class="lightbox-stage">
                        <div class="dot-container" id="dot-container"></div>
                        <div class="lightbox-viewport" id="lightbox-viewport">
                            <img id="lightbox-img" src="" alt="" draggable="false">
                        </div>
                        <div class="zoom-controls" id="zoom-controls" aria-label="Zoom controls">
                            <button class="zoom-button" type="button" onclick="zoomOut()">-</button>
                            <button class="zoom-button" type="button" onclick="resetZoom()">Reset</button>
                            <button class="zoom-button" type="button" onclick="zoomIn()">+</button>
                            <span class="zoom-indicator" id="zoom-indicator">100%</span>
                        </div>
                    </div>
                    <div class="lightbox-caption" id="lightbox-caption"></div>
                </div>
                <div class="caption-toggle" onclick="toggleCaption()">ℹ Caption on/off</div>
                <span class="lightbox-nav prev" onclick="prevImage()">⟨</span>
                <span class="lightbox-nav next" onclick="nextImage()">⟩</span>
            </div>

            <script>
                const images = ${JSON.stringify(images)};
                let currentIndex = 0;
                const lightboxImg = document.getElementById("lightbox-img");
                const lightboxViewport = document.getElementById("lightbox-viewport");
                const zoomIndicator = document.getElementById("zoom-indicator");
                const zoomControls = document.getElementById("zoom-controls");
                const MIN_ZOOM = 1;
                const MAX_ZOOM = 4;
                const ZOOM_STEP = 0.25;
                let zoomLevel = MIN_ZOOM;
                let panX = 0;
                let panY = 0;
                let isDraggingImage = false;
                let activePointerId = null;
                let dragStartX = 0;
                let dragStartY = 0;
                let suppressNextClick = false;

                if (lightboxImg) {
                    lightboxImg.addEventListener("load", () => resetZoom());
                    lightboxImg.addEventListener("click", handleImageClick);
                    lightboxImg.addEventListener("pointerdown", handlePointerDown);
                    lightboxImg.addEventListener("pointermove", handlePointerMove);
                    lightboxImg.addEventListener("pointerup", handlePointerUp);
                    lightboxImg.addEventListener("pointercancel", handlePointerUp);
                }

                if (lightboxViewport) {
                    lightboxViewport.addEventListener("wheel", handleWheel, { passive: false });
                }

                applyTransform();

                function openLightbox(index) {
                    currentIndex = index;
                    updateLightbox();
                    document.getElementById("lightbox").style.display = "flex";
                    generateDots();
                }

                function closeLightbox() {
                    document.getElementById("lightbox").style.display = "none";
                    resetZoom();
                }

                function prevImage() {
                    currentIndex = (currentIndex - 1 + images.length) % images.length;
                    updateLightbox();
                }

                function nextImage() {
                    currentIndex = (currentIndex + 1) % images.length;
                    updateLightbox();
                }

                function updateLightbox() {
                    const { src, caption } = images[currentIndex];
                    const imgEl = document.getElementById("lightbox-img");
                    const captionEl = document.getElementById("lightbox-caption");
                    if (captionEl) {
                        captionEl.innerText = caption;
                    }
                    if (imgEl) {
                        imgEl.alt = caption || "Gallery image";
                        imgEl.src = src;
                    }
                    resetZoom();
                    updateDots();
                }

                function toggleCaption() {
                    const caption = document.getElementById("lightbox-caption");
                    caption.style.display = caption.style.display === "none" ? "block" : "none";
                }

                function applyTransform() {
                    if (!lightboxImg) return;
                    lightboxImg.style.transform = 'translate(' + panX + 'px, ' + panY + 'px) scale(' + zoomLevel + ')';
                    if (lightboxViewport) {
                        lightboxViewport.classList.toggle("is-zoomed", zoomLevel > MIN_ZOOM);
                    }
                    if (zoomIndicator) {
                        zoomIndicator.textContent = Math.round(zoomLevel * 100) + "%";
                    }
                    if (zoomControls) {
                        zoomControls.classList.toggle("is-active", zoomLevel > MIN_ZOOM);
                    }
                }

                function setZoom(value) {
                    const normalized = Math.round(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value)) * 100) / 100;
                    if (normalized === MIN_ZOOM) {
                        panX = 0;
                        panY = 0;
                        isDraggingImage = false;
                        activePointerId = null;
                        if (lightboxImg) {
                            lightboxImg.classList.remove("dragging");
                        }
                    }
                    zoomLevel = normalized;
                    applyTransform();
                }

                function zoomIn() {
                    setZoom(zoomLevel + ZOOM_STEP);
                }

                function zoomOut() {
                    setZoom(zoomLevel - ZOOM_STEP);
                }

                function resetZoom() {
                    setZoom(MIN_ZOOM);
                }

                function handlePointerDown(event) {
                    if (zoomLevel === MIN_ZOOM || !lightboxImg) return;
                    event.preventDefault();
                    isDraggingImage = true;
                    suppressNextClick = false;
                    activePointerId = event.pointerId;
                    dragStartX = event.clientX - panX;
                    dragStartY = event.clientY - panY;
                    lightboxImg.setPointerCapture(activePointerId);
                    lightboxImg.classList.add("dragging");
                }

                function handlePointerMove(event) {
                    if (!isDraggingImage || event.pointerId !== activePointerId) return;
                    panX = event.clientX - dragStartX;
                    panY = event.clientY - dragStartY;
                    suppressNextClick = true;
                    applyTransform();
                }

                function handlePointerUp(event) {
                    if (!isDraggingImage || event.pointerId !== activePointerId || !lightboxImg) return;
                    isDraggingImage = false;
                    lightboxImg.classList.remove("dragging");
                    try {
                        lightboxImg.releasePointerCapture(event.pointerId);
                    } catch (error) {
                        console.warn("Pointer capture release failed", error);
                    }
                    activePointerId = null;
                }

                function handleWheel(event) {
                    event.preventDefault();
                    if (event.deltaY < 0) {
                        zoomIn();
                    } else if (event.deltaY > 0) {
                        zoomOut();
                    }
                }

                function handleImageClick(event) {
                    if (suppressNextClick) {
                        suppressNextClick = false;
                        return;
                    }
                    event.preventDefault();
                    if (zoomLevel < MAX_ZOOM) {
                        zoomIn();
                    } else {
                        resetZoom();
                    }
                }

                              /* Dots Indicator */
                function generateDots() {
                    const dotContainer = document.getElementById("dot-container");
                    dotContainer.innerHTML = "";

                    images.forEach((_, i) => {
                        const dot = document.createElement("div");
                        dot.className = "dot";
                        if (i === currentIndex) dot.classList.add("active");
                        dot.addEventListener("click", () => {
                            currentIndex = i;
                            updateLightbox();
                        });
                        dotContainer.appendChild(dot);
                    });
                }

                function updateDots() {
                    const dots = document.querySelectorAll(".dot");
                    dots.forEach((dot, i) => {
                        if (i === currentIndex) {
                            dot.classList.add("active");
                        } else {
                            dot.classList.remove("active");
                        }
                    });
                }

                    
                // Ensure the event listener is added AFTER the page loads
                window.onload = function () {
                    document.addEventListener("keydown", function (event) {
                        const lightbox = document.getElementById("lightbox");
                        if (lightbox.style.display === "flex") {
                            if (event.key === "ArrowRight") {
                                nextImage();
                            } else if (event.key === "ArrowLeft") {
                                prevImage();
                            } else if (event.key === "Escape") {
                                closeLightbox();
                            }
                        }
                    });
                };
            </script>
        </body>
        </html>
    `;
}
