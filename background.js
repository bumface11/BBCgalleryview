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
            images.push({ src: img.src, caption: caption.textContent.trim() });
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
                .lightbox img { max-width: 90%; max-height: 80vh; border: 5px solid white; border-radius: 8px; xobject-fit: contain; display: block; margin: auto;}
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

            <div class="gallery-container">
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
                <span class="close" onclick="closeLightbox()">&times;</span>
                <img id="lightbox-img" src="">
                <div class="lightbox-caption" id="lightbox-caption"></div>
                <div class="caption-toggle" onclick="toggleCaption()">ℹ Caption on/off</div>
                <span class="lightbox-nav prev" onclick="prevImage()">⟨</span>
                <span class="lightbox-nav next" onclick="nextImage()">⟩</span>
            </div>

            <script>
                const images = ${JSON.stringify(images)};
                let currentIndex = 0;

                function openLightbox(index) {
                    currentIndex = index;
                    updateLightbox();
                    document.getElementById("lightbox").style.display = "flex";
                }

                function closeLightbox() {
                    document.getElementById("lightbox").style.display = "none";
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
                    document.getElementById("lightbox-img").src = src;
                    document.getElementById("lightbox-caption").innerText = caption;
                }

                function toggleCaption() {
                    const caption = document.getElementById("lightbox-caption");
                    caption.style.display = caption.style.display === "none" ? "block" : "none";
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
