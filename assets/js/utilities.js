/* exported SWEETALERT_TYPE, showToast */

/**
 * SweetAlert2 toast icon types.
 */
const SWEETALERT_TYPE = {
    SUCCESS: "success",
    ERROR: "error",
    WARNING: "warning",
    INFO: "info",
    QUESTION: "question",
};

/**
 * Display a toast notification using SweetAlert2.
 *
 * @param {string} icon - One of the SWEETALERT_TYPE values.
 * @param {string} title - Message text to display.
 */
function showToast(icon, title) {
    const Toast = Swal.mixin({
        toast: true,
        position: "top-start",
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        didOpen: (toast) => {
            toast.addEventListener("mouseenter", Swal.stopTimer);
            toast.addEventListener("mouseleave", Swal.resumeTimer);
        }
    });

    Toast.fire({ icon, title });
}
