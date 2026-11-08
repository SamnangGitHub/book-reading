import React from "react";
import { createRoot } from "react-dom/client";
import App from "../App.jsx";
import "./style.css";

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((error) => {
      console.warn("Khmer Reader offline support could not start:", error);
    });
  });
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
