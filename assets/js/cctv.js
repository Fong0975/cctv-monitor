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

/**
 * Initialize the CCTV module.
 * Builds the tab bar, selects the first tab, and starts the refresh timer.
 *
 * @returns {void}
 */
function initialCCTV() {
    loadCCTVLinks();
    renderTabBar();

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
 * Clears image srcs of the current group to stop ongoing network streams,
 * then rebuilds the grid for the selected group.
 *
 * @param {string} key - A key from CCTV_RESOURCES.
 * @returns {void}
 */
function switchTab(key) {
    if (key === activeTabKey) return;

    // Clear existing image srcs to terminate active network streams
    Array.from(cctvContainer.getElementsByClassName("cctvImage"))
        .forEach(img => { img.src = ""; });

    activeTabKey = key;

    tabBar.querySelectorAll(".tab-btn").forEach(btn => {
        btn.classList.toggle("active", btn.getAttribute("data-key") === key);
    });

    const resources = getCCTVResourcesArray();
    if (resources.length > 0) {
        createCCTVDiv(resources.length);
        refreshCCTV();
    } else {
        cctvContainer.innerHTML = "";
    }
}

/**
 * Return the resources for the active tab group, in their defined order.
 * Only the active group is returned; inactive groups are never driven.
 *
 * @returns {{ title: string, url: string, refresh: boolean }[]}
 */
function getCCTVResourcesArray() {
    if (!(CCTV_RESOURCES instanceof Map) || !activeTabKey) return [];

    const group = CCTV_RESOURCES.get(activeTabKey);
    if (!Array.isArray(group) || group.length === 0) return [];

    return [...group];
}

/**
 * Build the camera grid DOM structure.
 * Always creates an even number of columns; unused cells get a placeholder class.
 *
 * @param {number} count - Number of camera feeds.
 * @returns {void}
 */
function createCCTVDiv(count) {
    cctvContainer.innerHTML = "";
    const minEvenNumber = Math.ceil(count / 2) * 2;

    for (var i = 1; i <= minEvenNumber; i++) {
        var divElement = document.createElement("div");
        divElement.className = "col-lg-6 cctvCol";

        if (i <= count) {
            divElement.style.backgroundImage = "url('" + NO_SIGNAL_IMAGE + "')";

            var imgElement = document.createElement("img");
            imgElement.id = "cctv" + i;
            imgElement.className = "cctvImage";
            imgElement.onerror = handlerImageOnError;
            imgElement.setAttribute("data-id", i);

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
            divElement.appendChild(imgElement);
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
 * Update all camera feed images in the active tab's grid.
 * On first load, sets the src; on subsequent calls, appends a cache-busting timestamp
 * only for feeds that require periodic refresh.
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
        const img = cctvImages[index];
        if (!img) {
            console.warn("Image element not found for CCTV " + (index + 1) + ".");
            return;
        }

        if (img.src === "") {
            img.setAttribute("data-url", resource.url);
            img.setAttribute("data-title", resource.title);
            img.setAttribute("data-refresh", resource.refresh);
            img.src = resource.url;

            var oImgTitle = document.getElementById("cctvTitle" + (index + 1));
            oImgTitle.innerHTML = resource.title;
            oImgTitle.setAttribute("data-bs-title", (index + 1) + " - " + resource.title);
            oImgTitle.setAttribute("data-bs-link", resource.url);
            oImgTitle.setAttribute("data-bs-needRefresh", resource.refresh);
        } else if (img.getAttribute("data-refresh") === "true") {
            img.src = img.getAttribute("data-url") + "&t=" + (new Date()).getTime();
        }
    });
}

/**
 * Refresh the enlarged image shown inside the modal, if it requires periodic updates.
 *
 * @returns {void}
 */
function refreshCCTVModal() {
    var cctvModal = document.getElementById("cctvModal");
    var imgDiv = cctvModal.querySelector(".imgContainer");
    var link = imgDiv.getAttribute("data-link");
    var needRefresh = imgDiv.getAttribute("data-needRefresh");

    if (needRefresh === "true") {
        imgDiv.style.backgroundImage = "url('" + link + "&t=" + (new Date()).getTime() + "')";
    }
}

/**
 * Handle image load errors by logging a warning.
 *
 * @this {HTMLImageElement}
 * @returns {void}
 */
function handlerImageOnError() {
    const imgTitle = this.getAttribute("data-title");
    console.warn("Failed to load image: " + imgTitle);
}

/**
 * Prompt the user for a URL via a SweetAlert2 dialog, then open it in the modal viewer.
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

        var button = document.createElement("button");
        button.setAttribute("data-bs-title", "Custom Source");
        button.setAttribute("data-bs-link", result.value.trim());
        button.setAttribute("data-bs-needRefresh", true);

        var myModal = new bootstrap.Modal(document.getElementById("cctvModal"), {});
        myModal.show(button);
    });
}
