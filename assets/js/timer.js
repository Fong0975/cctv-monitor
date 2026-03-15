/* exported initTimer, switchTimer */

/**
 * Interval select element.
 * @type {HTMLSelectElement}
 */
const selectElement = document.getElementById("counterInterval");

/**
 * Timer enable checkbox element.
 * @type {HTMLInputElement}
 */
const checkboxElement = document.getElementById("counterEnable");

/**
 * Countdown label element.
 * @type {HTMLSpanElement}
 */
const countdownLabel = document.getElementById("counterNumber");

/** @type {number|null} Active interval ID. */
let timer = null;

/**
 * Start the countdown timer.
 * Executes `doFunction` each time the counter reaches zero, then restarts.
 *
 * @param {Function|null} [doFunction=null] - Callback invoked on each tick completion.
 */
function initTimer(doFunction = null) {
    if (!selectElement || !checkboxElement || !countdownLabel) {
        console.error("Required timer elements are missing in the DOM.");
        return;
    }

    const selectedValue = parseInt(selectElement.value);
    countdownLabel.setAttribute("data-time", selectedValue);
    countdownLabel.innerHTML = selectedValue + "s";

    timer = setInterval(function () {
        var timeValue = parseInt(countdownLabel.getAttribute("data-time"));
        timeValue--;
        countdownLabel.setAttribute("data-time", timeValue);
        countdownLabel.innerHTML = timeValue + "s";

        if (timeValue < 0) {
            clearInterval(timer);

            if (doFunction && typeof doFunction === "function") {
                doFunction();
                initTimer(doFunction);
            } else {
                initTimer();
            }
        }
    }, 1000);
}

/**
 * Toggle the countdown timer based on the checkbox state.
 * Shows a toast notification reflecting the new state.
 */
function switchTimer() {
    if (!selectElement || !checkboxElement || !countdownLabel) {
        console.error("Required timer elements are missing in the DOM.");
        showToast(SWEETALERT_TYPE.ERROR, "Required timer elements are missing in the DOM.");
        return;
    }

    clearInterval(timer);

    if (checkboxElement.checked) {
        initTimer(refreshCCTV);
    }

    showToast(
        SWEETALERT_TYPE.SUCCESS,
        "Timer changed (" + selectElement.value + "s - " + (checkboxElement.checked ? "enabled" : "disabled") + ")"
    );
}
