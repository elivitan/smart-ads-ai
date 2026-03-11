import { OnboardModal, BuyCreditsModal } from "./Modals.jsx";
import { LaunchChoiceDialog } from "./LaunchChoiceDialog.js";
import useAppStore from "../stores/useAppStore.js";

interface GlobalModalsProps {
  navigate: (path: string) => void;
}

export default function GlobalModals({ navigate }: GlobalModalsProps) {
  const {
    showOnboard, setShowOnboard, onboardTab, setOnboardTab,
    onboardStep, setOnboardStep, selectedPlan, selectPlan,
    googleConnected, setGoogleConnected, scanCredits, setScanCredits,
    justSubscribed, setAutoScanMode,
    showLaunchChoice, setShowLaunchChoice, launchLoading, setLaunchLoading,
    showBuyCredits, setShowBuyCredits, aiCredits, setAiCredits,
  } = useAppStore();

  return (
    <>
      {showOnboard && <OnboardModal
        onClose={() => setShowOnboard(false)}
        onboardTab={onboardTab} setOnboardTab={setOnboardTab}
        onboardStep={onboardStep} setOnboardStep={setOnboardStep}
        selectedPlan={selectedPlan} selectPlan={selectPlan}
        googleConnected={googleConnected} setGoogleConnected={setGoogleConnected}
        scanCredits={scanCredits} setScanCredits={setScanCredits}
        onLaunchChoice={() => {
          if (justSubscribed) { setAutoScanMode("review"); }
          else { setShowLaunchChoice(true); }
        }}
      />}
      {showBuyCredits && <BuyCreditsModal
        onClose={() => setShowBuyCredits(false)}
        aiCredits={aiCredits} setAiCredits={setAiCredits}
      />}
      <LaunchChoiceDialog
        show={showLaunchChoice}
        onClose={() => { setShowLaunchChoice(false); setLaunchLoading(null); }}
        launchLoading={launchLoading} setLaunchLoading={setLaunchLoading}
        navigate={navigate}
      />
    </>
  );
}
