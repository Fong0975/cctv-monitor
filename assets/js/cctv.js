/* exported initialCCTV, showModal */

/**
 * Parent div of all CCTV blocks.
 * @type {HTMLElement}
 */
const cctvContainer = document.getElementById("cctvContainer");

/**
 * Tab bar element listing all location groups.
 * @type {HTMLElement}
 */
const tabBar = document.getElementById("cctvTabBar");

/**
 * Parent ul of all external links.
 * @type {HTMLElement}
 */
const linksContainer = document.getElementById("cctvLinksContainer");

/** Background image used when a feed has no signal. */
const NO_SIGNAL_IMAGE = "assets/images/noSignal.svg";

/** Currently selected group key from CCTV_RESOURCES. */
let activeTabKey = null;

/** Active Hls.js instances for the grid, keyed by tile index. */
let activeHlsInstances = {};

/** Hls.js instance currently attached to the modal video element, if any. */
let modalHlsInstance = null;

/**
 * Initialize the CCTV module.
 * Builds the tab bar, selects the first tab, and starts the refresh timer.
 *
 * @returns {void}
 */
function initialCCTV() {
    loadCCTVLinks();
    renderTabBar();
    initModalHandlers();

    const firstKey = CCTV_RESOURCES.keys().next().value;
    if (firstKey) {
        switchTab(firstKey);
        initTimer(refreshCCTV);
    } else {
        showToast(SWEETALERT_TYPE.WARNING, "No CCTV resources available.");
    }
}

/**
 * Render external links from CCTV_LINKS (defined in data/data.js) into the links container.
 *
 * @returns {void}
 */
function loadCCTVLinks() {
    if (!linksContainer) {
        console.error("CCTV links container element is missing in the DOM.");
        return;
    }

    if (!Array.isArray(CCTV_LINKS) || CCTV_LINKS.length === 0) {
        console.warn("No CCTV links found.");
        showToast(SWEETALERT_TYPE.WARNING, "No CCTV links found.");
        return;
    }

    linksContainer.innerHTML = "";
    CCTV_LINKS.forEach((element) => {
        var liElement = document.createElement("li");
        var aElement = document.createElement("a");
        aElement.className = "text-decoration-none";
        aElement.href = element.url;
        aElement.target = "_blank";
        aElement.innerHTML = element.title;
        liElement.appendChild(aElement);
        linksContainer.appendChild(liElement);
    });
}

/**
 * Build the tab bar from CCTV_RESOURCES keys.
 *
 * @returns {void}
 */
function renderTabBar() {
    if (!tabBar) {
        console.error("Tab bar element is missing in the DOM.");
        return;
    }

    tabBar.innerHTML = "";
    for (const key of CCTV_RESOURCES.keys()) {
        var btn = document.createElement("button");
        btn.className = "tab-btn";
        btn.textContent = key;
        btn.setAttribute("data-key", key);
        btn.onclick = function () { switchTab(this.getAttribute("data-key")); };
        tabBar.appendChild(btn);
    }
}

/**
 * Switch the active location tab.
 * Clears image srcs and destroys active HLS playback for the current group to
 * stop ongoing network streams, then rebuilds the grid for the selected group.
 *
 * @param {string} key - A key from CCTV_RESOURCES.
 * @returns {void}
 */
function switchTab(key) {
    if (key === activeTabKey) return;

    cctvContainer.scrollTop = 0;

    // Clear existing image srcs to terminate active network streams
    Array.from(cctvContainer.getElementsByClassName("cctvImage"))
        .forEach(img => { img.src = ""; });
    destroyActiveHlsInstances();

    activeTabKey = key;

    tabBar.querySelectorAll(".tab-btn").forEach(btn => {
        btn.classList.toggle("active", btn.getAttribute("data-key") === key);
    });

    const resources = getCCTVResourcesArray();
    if (resources.length > 0) {
        createCCTVDiv(resources);
        refreshCCTV();
    } else {
        cctvContainer.innerHTML = "";
    }
}

/**
 * Return the resources for the active tab group, in their defined order.
 * Only the active group is returned; inactive groups are never driven.
 *
 * @returns {{ title: string, url: string, type?: string, refresh: boolean }[]}
 */
function getCCTVResourcesArray() {
    if (!(CCTV_RESOURCES instanceof Map) || !activeTabKey) return [];

    const group = CCTV_RESOURCES.get(activeTabKey);
    if (!Array.isArray(group) || group.length === 0) return [];

    return [...group];
}

/**
 * Determine whether a resource should be played as an HLS (.m3u8) stream.
 * An explicit `type: "hls"` always wins; otherwise falls back to sniffing the
 * URL for a `.m3u8` manifest extension.
 *
 * @param {{url: string, type?: string}} resource
 * @returns {boolean}
 */
function isHlsSource(resource) {
    if (resource.type === "hls") return true;
    if (resource.type) return false;
    return /\.m3u8(\?|#|$)/i.test(resource.url);
}

/**
 * Attach an HLS (.m3u8) stream to a <video> element.
 * Uses hls.js where required (MSE-based playback) or native playback on
 * browsers with built-in HLS support (e.g. Safari).
 *
 * @param {HTMLVideoElement} videoElement
 * @param {string} url - HLS manifest (.m3u8) URL.
 * @returns {Hls|null} The created Hls.js instance, or null if native playback
 *   was used or HLS playback is unsupported.
 */
function attachHlsSource(videoElement, url) {
    if (typeof Hls !== "undefined" && Hls.isSupported()) {
        var hls = new Hls();
        hls.on(Hls.Events.MANIFEST_PARSED, function () {
            videoElement.play().catch(() => {});
        });
        hls.on(Hls.Events.ERROR, function (event, data) {
            if (!data.fatal) return;
            console.warn("HLS fatal error (" + data.type + "): " + url);
            hls.destroy();
        });
        hls.loadSource(url);
        hls.attachMedia(videoElement);
        return hls;
    }

    if (videoElement.canPlayType("application/vnd.apple.mpegurl")) {
        videoElement.src = url;
        videoElement.play().catch(() => {});
        return null;
    }

    console.warn("HLS playback is not supported in this browser: " + url);
    return null;
}

/**
 * Destroy all Hls.js instances attached to the current grid, releasing
 * network and media resources before the grid is rebuilt.
 *
 * @returns {void}
 */
function destroyActiveHlsInstances() {
    Object.values(activeHlsInstances).forEach(hls => hls && hls.destroy());
    activeHlsInstances = {};
}

/**
 * Build the camera grid DOM structure.
 * Always creates an even number of columns; unused cells get a placeholder class.
 * Each tile is an <img> for static/MJPEG sources, or a <video> for HLS sources.
 *
 * @param {{title: string, url: string, type?: string, refresh: boolean}[]} resources - Camera feeds for the active tab.
 * @returns {void}
 */
function createCCTVDiv(resources) {
    cctvContainer.innerHTML = "";
    const count = resources.length;
    const minEvenNumber = Math.ceil(count / 2) * 2;

    for (var i = 1; i <= minEvenNumber; i++) {
        var divElement = document.createElement("div");
        divElement.className = "col-lg-6 cctvCol";

        if (i <= count) {
            var mediaElement;
            if (isHlsSource(resources[i - 1])) {
                divElement.classList.add("cctvColVideo");

                mediaElement = document.createElement("video");
                mediaElement.muted = true;
                mediaElement.autoplay = true;
                mediaElement.playsInline = true;
            } else {
                divElement.style.backgroundImage = "url('" + NO_SIGNAL_IMAGE + "')";

                mediaElement = document.createElement("img");
            }
            mediaElement.id = "cctv" + i;
            mediaElement.className = "cctvImage";
            mediaElement.onerror = handlerImageOnError;
            mediaElement.setAttribute("data-id", i);

            var divNumberElement = document.createElement("div");
            divNumberElement.className = "cctvNumber";
            divNumberElement.innerHTML = i;

            var divTitleElement = document.createElement("div");
            divTitleElement.className = "cctvTitle";

            var divTitleButtonElement = document.createElement("button");
            divTitleButtonElement.id = "cctvTitle" + i;
            divTitleButtonElement.innerHTML = "Sample Title";
            divTitleButtonElement.className = "btn-transparent";
            divTitleButtonElement.setAttribute("data-bs-toggle", "modal");
            divTitleButtonElement.setAttribute("data-bs-target", "#cctvModal");

            divTitleElement.appendChild(divTitleButtonElement);
            divElement.appendChild(mediaElement);
            divElement.appendChild(divNumberElement);
            divElement.appendChild(divTitleElement);
        } else {
            divElement.classList.add("cctvColEmpty");
        }

        cctvContainer.appendChild(divElement);
    }
}

/**
 * Refresh the active view — either the modal image or all grid blocks.
 *
 * @returns {void}
 */
function refreshCCTV() {
    var cctvModal = document.getElementById("cctvModal");
    var isModalShow = cctvModal.classList.contains("show");

    if (isModalShow) {
        refreshCCTVModal();
    } else {
        refreshCCTVBlocks();
    }
}

/**
 * Update all camera feed tiles in the active tab's grid.
 * On first load, attaches the source (direct src for images, hls.js for HLS
 * streams); on subsequent calls, appends a cache-busting timestamp only for
 * image feeds that require periodic refresh. HLS streams update themselves
 * and are never touched again once attached.
 *
 * @returns {void}
 */
function refreshCCTVBlocks() {
    const cctvImages = cctvContainer.getElementsByClassName("cctvImage");
    if (!cctvImages || cctvImages.length === 0) {
        console.warn("No CCTV images container found.");
        return;
    }

    const cctvResources = getCCTVResourcesArray();
    if (cctvResources.length === 0) {
        console.warn("No CCTV resources found.");
        return;
    }

    if (cctvImages.length !== cctvResources.length) {
        console.warn("CCTV images count does not match resources count.");
        return;
    }

    cctvResources.forEach((resource, index) => {
        const media = cctvImages[index];
        if (!media) {
            console.warn("Image element not found for CCTV " + (index + 1) + ".");
            return;
        }

        const isHls = isHlsSource(resource);

        if (!media.hasAttribute("data-url")) {
            media.setAttribute("data-url", resource.url);
            media.setAttribute("data-title", resource.title);
            media.setAttribute("data-refresh", resource.refresh);

            if (isHls) {
                activeHlsInstances[index] = attachHlsSource(media, resource.url);
            } else {
                media.src = resource.url;
            }

            var oImgTitle = document.getElementById("cctvTitle" + (index + 1));
            oImgTitle.innerHTML = resource.title;
            oImgTitle.setAttribute("data-bs-title", (index + 1) + " - " + resource.title);
            oImgTitle.setAttribute("data-bs-link", resource.url);
            oImgTitle.setAttribute("data-bs-needRefresh", resource.refresh);
            oImgTitle.setAttribute("data-bs-type", isHls ? "hls" : "image");
        } else if (!isHls && media.getAttribute("data-refresh") === "true") {
            media.src = media.getAttribute("data-url") + "&t=" + (new Date()).getTime();
        }
    });
}

/**
 * Refresh the enlarged view shown inside the modal, if it requires periodic
 * updates. HLS sources manage their own playback and are never touched here.
 *
 * @returns {void}
 */
function refreshCCTVModal() {
    var cctvModal = document.getElementById("cctvModal");
    var imgDiv = cctvModal.querySelector(".imgContainer");
    var link = imgDiv.getAttribute("data-link");
    var needRefresh = imgDiv.getAttribute("data-needRefresh");
    var type = imgDiv.getAttribute("data-type");

    if (type === "hls" || needRefresh !== "true") return;

    imgDiv.style.backgroundImage = "url('" + link + "&t=" + (new Date()).getTime() + "')";
}

/**
 * Handle media load errors by logging a warning.
 *
 * @this {HTMLImageElement|HTMLVideoElement}
 * @returns {void}
 */
function handlerImageOnError() {
    const imgTitle = this.getAttribute("data-title");
    console.warn("Failed to load image: " + imgTitle);
}

/**
 * Stop and release any active HLS playback in the modal view.
 *
 * @returns {void}
 */
function stopModalPlayback() {
    if (modalHlsInstance) {
        modalHlsInstance.destroy();
        modalHlsInstance = null;
    }

    var videoElement = document.querySelector("#cctvModal .imgContainer .modalVideo");
    if (videoElement) {
        videoElement.pause();
        videoElement.removeAttribute("src");
        videoElement.load();
    }
}

/**
 * Populate the enlarged-view modal for the given source.
 * Static/MJPEG images use the background-image div; HLS (.m3u8) sources are
 * played through a <video> element via hls.js.
 *
 * @param {string} title
 * @param {string} link
 * @param {string} needRefresh - "true" | "false", as read from a data attribute.
 * @param {string} type - "image" | "hls".
 * @returns {void}
 */
function handleModalShow(title, link, needRefresh, type) {
    stopModalPlayback();

    var cctvModal = document.getElementById("cctvModal");
    var imgContainer = cctvModal.querySelector(".imgContainer");

    cctvModal.querySelector(".modal-title").textContent = title;
    imgContainer.setAttribute("data-link", link);
    imgContainer.setAttribute("data-needRefresh", needRefresh);
    imgContainer.setAttribute("data-type", type);

    if (type === "hls") {
        imgContainer.classList.add("type-hls");
        var videoElement = imgContainer.querySelector(".modalVideo");
        modalHlsInstance = attachHlsSource(videoElement, link);
    } else {
        imgContainer.classList.remove("type-hls");
        imgContainer.style.backgroundImage = "url('" + link + "')";
    }
}

/**
 * Wire up show/hide handlers for the enlarged CCTV view modal.
 * Reads source metadata from the button that triggered the modal (its
 * data-bs-* attributes) and tears down active HLS playback when it closes.
 *
 * @returns {void}
 */
function initModalHandlers() {
    var cctvModal = document.getElementById("cctvModal");
    if (!cctvModal) {
        console.error("CCTV modal element is missing in the DOM.");
        return;
    }

    cctvModal.addEventListener("show.bs.modal", function (event) {
        var button = event.relatedTarget;
        handleModalShow(
            button.getAttribute("data-bs-title"),
            button.getAttribute("data-bs-link"),
            button.getAttribute("data-bs-needRefresh"),
            button.getAttribute("data-bs-type") || "image"
        );
    });

    cctvModal.addEventListener("hidden.bs.modal", function () {
        stopModalPlayback();
    });
}

/**
 * Prompt the user for a URL via a SweetAlert2 dialog, then open it in the modal viewer.
 * The source type (static image vs HLS `.m3u8` stream) is auto-detected from the URL.
 *
 * @returns {void}
 */
function showModal() {
    Swal.fire({
        title: "Open a source",
        input: "text",
        inputPlaceholder: "https://",
        showCancelButton: true,
        confirmButtonText: "Open",
        inputValidator: (value) => {
            if (!value || !value.trim()) return "Please enter a URL.";
        }
    }).then((result) => {
        if (!result.isConfirmed || !result.value) return;

        var link = result.value.trim();
        var type = isHlsSource({ url: link }) ? "hls" : "image";

        var button = document.createElement("button");
        button.setAttribute("data-bs-title", "Custom Source");
        button.setAttribute("data-bs-link", link);
        button.setAttribute("data-bs-needRefresh", type === "hls" ? false : true);
        button.setAttribute("data-bs-type", type);

        var myModal = new bootstrap.Modal(document.getElementById("cctvModal"), {});
        myModal.show(button);
    });
}
