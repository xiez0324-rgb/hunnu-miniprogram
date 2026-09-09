import React from "react";
import ReactDOM from "react-dom/client";
import MiniApp from "./components/miniapp/MiniApp";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MiniApp />
  </React.StrictMode>,
);
