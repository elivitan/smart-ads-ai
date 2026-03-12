import { OnboardModal, BuyCreditsModal } from "./Modals";
import { LaunchChoiceDialog } from "./LaunchChoiceDialog";
import useAppStore from "../stores/useAppStore.js";
import { shallow } from "zustand/shallow";

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
  } = useAppStore(s => ({
    showOnboard: s.showOnboard, setShowOnboard: s.setShowOnboard,
    onboardTab: s.onboardTab, setOnboardTab: s.setOnboardTab,
    onboardStep: s.onboardStep, setOnboardStep: s.setOnboardStep,
    selectedPlan: s.selectedPlan, selectPlan: s.selectPlan,
    googleConnected: s.googleConnected, setGoogleConnected: s.setGoogleConnected,
    scanCredits: s.scanCredits, setScanCredits: s.setScanCredits,
    justSubscribed: s.justSubscribed, setAutoScanMode: s.setAutoScanMode,
    showLaunchChoice: s.showLaunchChoice, setShowLaunchChoice: s.setShowLaunchChoice,
    launchLoading: s.launchLoading, setLaunchLoading: s.setLaunchLoading,
    showBuyCredits: s.showBuyCredits, setShowBuyCredits: s.setShowBuyCredits,
    aiCredits: s.aiCredits, setAiCredits: s.setAiCredits,
  }), shallow);

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
