import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import { VaultProvider } from "./contexts/VaultContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <VaultProvider>
          <App />
        </VaultProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
