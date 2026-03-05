import js from "@eslint/js";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  {
    files: ["**/*.{js,jsx}"],
    ignores: ["node_modules/**", "build/**", ".cache/**"],
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooks,
    },
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
      globals: {
        window: true, document: true, console: true,
        fetch: true, FormData: true, setTimeout: true,
        clearInterval: true, setInterval: true, clearTimeout: true,
        JSON: true, Math: true, Object: true, Array: true,
        parseInt: true, parseFloat: true, Promise: true,
        URLSearchParams: true, URL: true, sessionStorage: true,
        AbortController: true, AbortSignal: true,
        requestAnimationFrame: true, cancelAnimationFrame: true,
        navigator: true, location: true, history: true,
        localStorage: true, performance: true,
        process: true, Buffer: true, __dirname: true, module: true,
      },
    },
    settings: { react: { version: "18" } },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react/jsx-key": "error",
      "react/jsx-no-duplicate-props": "error",
      "no-undef": "error",
      "no-duplicate-case": "error",
      "react-hooks/exhaustive-deps": "warn",
      "no-unused-vars": "warn",
    },
  },
];
