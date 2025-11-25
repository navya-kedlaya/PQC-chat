import React, { useEffect } from "react";
import CloudChat from "./components/CloudChat";

function App() {
  useEffect(() => {
    console.log("[App] Mounted App component");
  }, []);

  return (
    <div className="min-h-screen bg-gray-100">
      <CloudChat />
    </div>
  );
}

export default App;
