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
            <!--script src="${chrome.runtime.getURL('libs/tone.js')}"></script>
            <style>
                body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #222; color: white; text-align: center; }
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

                .gallery-item { cursor: pointer; transition: transform 0.3s ease; 
                            display: flex; /* Use flexbox for alignment within grid item */
            justify-content: center; /* Center image horizontally */
            align-items: center; /* Center image vertically */
        }
                .gallery-item:hover {
                     transform: scale(1.05); }
        .gallery-item img {
            max-width: 100%; /* Image width limited to container */
            max-height: 100%; /* Image height limited to container */
            object-fit: contain; /* Maintain aspect ratio, fit within container */
            border-radius: 8px;
            border: 2px solid white;
        }

                /* Slideshow Button */
                .slideshow-btn {
                    display: block;
                    margin: 20px auto;
                    padding: 10px 20px;
                    font-size: 16px;
                    color: white;
                    background: #444;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    transition: 0.3s;
                }
                .slideshow-btn:hover { background: #666; }
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
               /* Dots Navigation */
                .dot-container {
                    position: absolute;
                    top: 10px;
                    left: 50%;
                    transform: translateX(-50%);
                    display: flex;
                    gap: 6px;
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
                .lightbox img { max-width: 90%; max-height: 75vh; border: 5px solid white; border-radius: 8px; xobject-fit: contain; display: block; margin: auto;}
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
                        <img src="${src}" alt="${caption} onload="checkImagesLoaded()">
                    </div>
                `).join('')}
            </div>

            <!-- Slideshow Button -->
            <button class="slideshow-btn" onclick="startSlideshow()">Start Slideshow 📽️</button>
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
                <div class="dot-container" id="dot-container"></div> <!-- Row of Dots -->
                <div class="lightbox-content">
                    <span class="close" onclick="closeLightbox()">&times;</span>
                    <img id="lightbox-img" src="" onclick="nextImage()">
                    <div class="lightbox-caption" id="lightbox-caption"></div>
                </div>
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
                    generateDots();
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
                    updateDots();
                }

                function toggleCaption() {
                    const caption = document.getElementById("lightbox-caption");
                    caption.style.display = caption.style.display === "none" ? "block" : "none";
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
                console.log("Gallery loaded. Total images:", images.length);

                function startSlideshow() {
                    console.log("Start Slideshow button clicked");
                    const slideshowHtml = createSlideshowHtml(images);
                    console.log("Slideshow HTML generated successfully");

                    const slideshowUrl = "data:text/html;charset=utf-8," + encodeURIComponent(slideshowHtml);
                    console.log("Opening new window for slideshow...");
                    const newWindow = window.open(slideshowUrl, "_blank", "width=900,height=600");

                    if (newWindow) {
                        console.log("Slideshow window opened successfully");
                    } else {
                        console.error("Failed to open slideshow window (popup blocked?)");
                    }
                }

                function createSlideshowHtml(images) {
                    console.log("Generating slideshow HTML...");
                    return \`
                        <!DOCTYPE html>
                        <html lang="en">
                        <head>
                            <meta charset="UTF-8">
                            <meta name="viewport" content="width=device-width, initial-scale=1.0">
                            <title>Slideshow</title>
                            <style>
                                body { margin: 0; background: #f5f5dc; display: flex; justify-content: center; align-items: center; height: 100vh; overflow: hidden; }
                                
                                .slideshow-container {
                                    position: relative;
                                    width: 80vw;
                                    height: 80vh;
                                    display: flex;
                                    justify-content: center;
                                    align-items: center;
                                }

                                .slide {
                                    position: absolute;
                                    width: 60%;
                                    max-width: 800px;
                                    transform: scale(0.9);
                                    transition: transform 1s ease-in-out, left 1s ease-in-out, top 1s ease-in-out;
                                    left: 50%;
                                    top: 50%;
                                    transform: translate(-50%, -50%);
                                    background: white;
                                    padding: 10px;
                                    box-shadow: 4px 4px 10px rgba(0, 0, 0, 0.3);
                                    border-radius: 8px;
                                    opacity: 0;
                                }

                                .slide.active { opacity: 1; transform: scale(1); }

                                .caption {
                                    font-family: 'Brush Script MT', cursive;
                                    background: white;
                                    padding: 8px 15px;
                                    border-radius: 5px;
                                    margin-top: 10px;
                                    font-size: 20px;
                                    color: black;
                                    text-align: center;
                                    display: inline-block;
                                }

                                .pin {
                                    position: absolute;
                                    width: 20px;
                                    height: 20px;
                                    background: red;
                                    border-radius: 50%;
                                    top: -10px;
                                    left: 50%;
                                    transform: translateX(-50%);
                                    box-shadow: 2px 2px 5px rgba(0, 0, 0, 0.5);
                                }
                            </style>
                        </head>
                        <body>
                            <div class="slideshow-container" id="slideshow-container"></div>

                            <script>
                                const images = ${JSON.stringify(images)};
                                let currentIndex = 0;
                                console.log("Slideshow started with", images.length, "images.");

                                function createSlide(image, index) {
                                    console.log("Creating slide for image", index);
                                    const slide = document.createElement("div");
                                    slide.classList.add("slide");
                                    slide.innerHTML = \`
                                        <div class="pin"></div>
                                        <img src="\${image.src}" style="width: 100%; border-radius: 8px;">
                                        <div class="caption">\${image.caption}</div>
                                    \`;

                                    // Determine pan direction based on position
                                    const panDirection = index % 2 === 0 ? "left" : "right";
                                    slide.setAttribute("data-pan", panDirection);
                                    return slide;
                                }

                                function showSlide(index) {
                                    console.log("Displaying slide", index);
                                    const slides = document.querySelectorAll(".slide");
                                    slides.forEach(slide => {
                                        slide.classList.remove("active");
                                        slide.style.left = "50%";
                                        slide.style.top = "50%";
                                        slide.style.opacity = "0";
                                    });

                                    const currentSlide = slides[index];
                                    if (!currentSlide) {
                                        console.error("Slide element not found for index", index);
                                        return;
                                    }

                                    currentSlide.classList.add("active");
                                    currentSlide.style.opacity = "1";

                                    const panDirection = currentSlide.getAttribute("data-pan");
                                    if (panDirection === "left") {
                                        currentSlide.style.left = "30%";
                                    } else {
                                        currentSlide.style.left = "70%";
                                    }
                                }

                                function startSlideshow() {
                                    console.log("Initializing slideshow...");
                                    const container = document.getElementById("slideshow-container");
                                    if (!container) {
                                        console.error("Slideshow container not found!");
                                        return;
                                    }

                                    images.forEach((image, index) => {
                                        const slide = createSlide(image, index);
                                        container.appendChild(slide);
                                    });

                                    showSlide(currentIndex);

                                    setInterval(() => {
                                        currentIndex = (currentIndex + 1) % images.length;
                                        showSlide(currentIndex);
                                    }, 3000);
                                }

                                window.onload = startSlideshow;
                            </script>
                        </body>
                        </html>
                    \`;
                }
            </script>
        </body>
        </html>
    `;
}
