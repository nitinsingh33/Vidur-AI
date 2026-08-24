import { useState } from "react";
import { Sidebar } from "./components/layout/Sidebar";
import { Topbar } from "./components/layout/Topbar";
import { Dashboard } from "./pages/Dashboard";
import { RecoveryCaseDetails } from "./pages/RecoveryCaseDetails";
import "./index.css";

function App() {
  const [selectedRecoveryCaseId, setSelectedRecoveryCaseId] = useState<
    string | null
  >(null);

  const [showRecoveryCases, setShowRecoveryCases] = useState(false);

  function openRecoveryCase(recoveryCaseId: string) {
    setSelectedRecoveryCaseId(recoveryCaseId);
    setShowRecoveryCases(false);
  }

  function openRecoveryCases() {
    setSelectedRecoveryCaseId(null);
    setShowRecoveryCases(true);
  }

  function openOverview() {
    setSelectedRecoveryCaseId(null);
    setShowRecoveryCases(false);
  }

  return (
    <div className="app-shell">
      <Sidebar
        onOpenOverview={openOverview}
        onOpenRecoveryCases={openRecoveryCases}
      />

      <div className="app-main">
        <Topbar />

        <main className="page-content">
          {selectedRecoveryCaseId ? (
            <RecoveryCaseDetails
              recoveryCaseId={selectedRecoveryCaseId}
              onBack={openRecoveryCases}
            />
          ) : (
            <Dashboard
              showRecoveryCases={showRecoveryCases}
              onOpenRecoveryCase={openRecoveryCase}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
