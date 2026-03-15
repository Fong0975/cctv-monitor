import js from "@eslint/js";
import globals from "globals";

const sharedGlobals = {
    ...globals.browser,
    // Data file globals
    CCTV_RESOURCES: "readonly",
    CCTV_LINKS: "readonly",
    // CDN globals
    Swal: "readonly",
    bootstrap: "readonly",
    // Shared utility globals (defined in utilities.js)
    showToast: "readonly",
    SWEETALERT_TYPE: "readonly",
};

const sharedRules = {
    "no-unused-vars": "error",
    "no-undef": "error",
    "eqeqeq": ["error", "always"],
    "semi": ["error", "always"],
    "quotes": ["error", "double"],
    "indent": ["error", 4],
    "no-trailing-spaces": "error",
    "eol-last": ["error", "always"],
    "no-multiple-empty-lines": ["error", { "max": 1 }],
    "linebreak-style": ["error", "unix"],
};

export default [
    js.configs.recommended,
    {
        files: ["assets/js/cctv.js"],
        languageOptions: {
            ecmaVersion: 2021,
            sourceType: "script",
            globals: {
                ...sharedGlobals,
                initTimer: "readonly",
            },
        },
        rules: sharedRules,
    },
    {
        files: ["assets/js/timer.js"],
        languageOptions: {
            ecmaVersion: 2021,
            sourceType: "script",
            globals: {
                ...sharedGlobals,
                refreshCCTV: "readonly",
            },
        },
        rules: sharedRules,
    },
    {
        files: ["assets/js/utilities.js"],
        languageOptions: {
            ecmaVersion: 2021,
            sourceType: "script",
            globals: {
                ...globals.browser,
                Swal: "readonly",
            },
        },
        rules: sharedRules,
    },
];
