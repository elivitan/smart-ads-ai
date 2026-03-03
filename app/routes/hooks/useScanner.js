import { useState, useRef } from "react";

const FREE_SCAN_LIMIT = 3;

function findAiForProduct(aiProducts, product) {
  if (!aiProducts) return null;
  return aiProducts.find(ap => ap.title === product.title || ap.id === product.id) || null;
}

/**
 * useScanner
 * Manages all scan state and logic — fetching products, AI batch analysis, progress tracking.
 * Completely isolated: changing scan logic never breaks UI or campaign code.
 *
 * @param {object} opts
 * @param {boolean} opts.hasScanAccess
 * @param {boolean} opts.canPublish
 * @param {string}  opts.shopDomain
 * @param {array}   opts.dbProducts        - products already in DB (from loader)
 * @param {function} opts.getProductUrl
 * @param {function} opts.onScanComplete   - called with allAiProducts when done
 * @param {function} opts.onAutoLaunch     - called when auto-launch campaigns needed
 * @param {function} opts.triggerConfetti
 */
export function useScanner({
  hasScanAccess,
  canPublish,
  shopDomain,
  dbProducts,
  getProductUrl,
  onScanComplete,
  onAutoLaunch,
  triggerConfetti,
}) {
  const [products, setProductsRaw] = useState([]);
  const [aiResults, setAiResultsRaw] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [fakeProgress, setFakeProgress] = useState(0);
  const [scanMode, setScanMode] = useState(null);
  const [scanError, setScanError] = useState(null);
  const [scanMsg, setScanMsg] = useState("");

  const cancelRef = useRef(false);
  const creepRef = useRef(null);

  function setProducts(v) {
    setProductsRaw(v);
    try { sessionStorage.setItem("sai_products", JSON.stringify(v)); } catch {}
  }
  function setAiResults(v) {
    setAiResultsRaw(v);
    try { sessionStorage.setItem("sai_aiResults", JSON.stringify(v)); } catch {}
  }

  const scanned = products.length > 0;

  async function doScan(mode) {
    if (isScanning) return;
    const isAuto = mode === "auto";
    setScanMode(mode || "review");
    setIsScanning(true);
    setFakeProgress(0);
    setScanMsg(hasScanAccess ? "Connecting to your Shopify store..." : "Quick preview scan starting...");
    setScanError(null);
    cancelRef.current = false;
    let fetchedProducts = [], allAiProducts = [];

    let smoothProg = 0;
    const smoothTimer = setInterval(() => {
      smoothProg = Math.min(smoothProg + 0.15, 8);
      setFakeProgress(Math.round(smoothProg * 10) / 10);
    }, 100);

    try {
      const scanAbort = new AbortController();
      cancelRef._abort = () => scanAbort.abort();

      // Products already in DB from install sync — skip re-fetching when possible
      let allFetched = dbProducts || [];
      if (allFetched.length === 0) {
        const ff = new FormData(); ff.append("step", "fetch");
        const fr = await fetch("/app/api/scan", { method: "POST", body: ff, signal: scanAbort.signal });
        const fd = await fr.json().catch(() => { throw new Error("Server returned invalid response."); });
        if (!fd.success) throw new Error(fd.error || "Failed to fetch products");
        allFetched = fd.products || [];
      }

      if (cancelRef.current) { clearInterval(smoothTimer); setIsScanning(false); return; }
      clearInterval(smoothTimer);

      const toAnalyze = hasScanAccess ? allFetched : allFetched.slice(0, FREE_SCAN_LIMIT);
      fetchedProducts = allFetched;
      setProducts(allFetched);

      for (let p = Math.ceil(smoothProg); p <= 10; p++) {
        setFakeProgress(p);
        await new Promise(r => setTimeout(r, 40));
      }
      setScanMsg(
        hasScanAccess
          ? `${allFetched.length} products ready — running AI analysis...`
          : `Analyzing top ${FREE_SCAN_LIMIT} products for preview...`
      );
      await new Promise(r => setTimeout(r, 400));

      const BATCH = 3, total = toAnalyze.length, batches = Math.ceil(total / BATCH);
      for (let b = 0; b < batches; b++) {
        if (cancelRef.current) { setIsScanning(false); return; }
        const start = b * BATCH, batch = toAnalyze.slice(start, start + BATCH);
        const batchStartPct = 10 + Math.round((b / batches) * 82);
        const batchEndPct   = 10 + Math.round(((b + 1) / batches) * 82);
        let creepPct = batchStartPct;

        if (creepRef.current) clearInterval(creepRef.current);
        const creepTimer = setInterval(() => {
          if (creepPct < batchEndPct - 0.5) creepPct += 0.3;
          setFakeProgress(Math.round(creepPct * 10) / 10);
          const fakeNum = Math.min(Math.round((creepPct - 10) / 82 * total), total);
          const curPct = Math.round(creepPct);
          if (hasScanAccess) {
            const sn = curPct < 25 ? "Searching Google"
              : curPct < 45 ? "Analyzing competitors"
              : curPct < 60 ? "Checking rankings"
              : curPct < 80 ? "Generating ad copy"
              : "Building strategy";
            setScanMsg(`${fakeNum} of ${total} products · ${sn}`);
          } else {
            setScanMsg(`Analyzing product ${fakeNum} of ${total}...`);
          }
        }, 400);
        creepRef.current = creepTimer;

        const af = new FormData();
        af.append("step", "analyze-batch");
        af.append("products", JSON.stringify(batch));
        af.append("storeDomain", shopDomain || "");
        const ar = await fetch("/app/api/scan", { method: "POST", body: af, signal: scanAbort.signal });
        clearInterval(creepTimer); creepRef.current = null;

        const ad = await ar.json().catch(() => { throw new Error(`AI returned invalid response on batch ${b + 1}.`); });
        if (!ad.success) throw new Error(ad.error || `AI failed on batch ${b + 1}`);
        allAiProducts = [...allAiProducts, ...(ad.result?.products || [])];
        setFakeProgress(batchEndPct);
      }

      if (cancelRef.current) { setIsScanning(false); return; }
      setScanMsg(hasScanAccess ? "Almost done — putting it all together! 🚀" : "Wrapping up your preview...");
      await new Promise(r => setTimeout(r, 600));

      const topScore = allAiProducts.reduce(
        (best, p) => ((p.ad_score || 0) > (best.ad_score || 0) ? p : best),
        allAiProducts[0] || {}
      );
      let summary;
      if (hasScanAccess) {
        const opts = [
          `🎯 Analyzed ${allAiProducts.length} products. "${topScore.title || "Top product"}" scored ${topScore.ad_score || 0}/100.`,
          `✨ Found ${allAiProducts.filter(p => (p.ad_score || 0) >= 70).length} high-potential products!`,
          `🏆 Average score: ${Math.round(allAiProducts.reduce((a, p) => a + (p.ad_score || 0), 0) / allAiProducts.length)}/100.`,
        ];
        summary = opts[Math.floor(Math.random() * opts.length)];
      } else {
        summary = `Preview: Analyzed ${FREE_SCAN_LIMIT} of ${fetchedProducts.length} products. ${topScore.title || "Your top product"} shows real potential! Upgrade to unlock all ${fetchedProducts.length - FREE_SCAN_LIMIT} remaining.`;
      }

      setAiResults({ summary, recommended_budget: 100, products: allAiProducts });
      setFakeProgress(100);
      setScanMsg(hasScanAccess ? "Your store is ready to grow 🎉" : "Preview ready!");
      triggerConfetti?.();
      onScanComplete?.(allAiProducts);
      await new Promise(r => setTimeout(r, 800));

    } catch (e) {
      clearInterval(smoothTimer);
      if (creepRef.current) { clearInterval(creepRef.current); creepRef.current = null; }
      let msg = e.message || "Something went wrong";
      if (msg.includes("credit balance") || msg.includes("billing"))  msg = "AI credits have run out. Please top up your Anthropic API balance.";
      else if (msg.includes("rate_limit") || msg.includes("429"))     msg = "Too many requests. Please wait a minute and try again.";
      else if (msg.includes("401") || msg.includes("api_key"))        msg = "API key is invalid. Please check your ANTHROPIC_API_KEY.";
      else if (msg.includes("overloaded"))                            msg = "AI service is temporarily overloaded. Please try again.";
      setScanError(msg);
      setIsScanning(false);
      setFakeProgress(0);
      return;
    }

    setIsScanning(false);
    setFakeProgress(0);

    // Auto-launch campaigns after scan completes
    if (isAuto && allAiProducts.length > 0 && canPublish) {
      onAutoLaunch?.(fetchedProducts, allAiProducts, getProductUrl);
    }
  }

  function cancelScan() {
    cancelRef.current = true;
    if (cancelRef._abort) cancelRef._abort();
    if (creepRef.current) { clearInterval(creepRef.current); creepRef.current = null; }
    setIsScanning(false);
    setFakeProgress(0);
    setProducts([]);
    setAiResults(null);
  }

  return {
    // state
    products,
    aiResults,
    isScanning,
    fakeProgress,
    scanMode,
    scanError,
    scanMsg,
    scanned,
    // actions
    doScan,
    cancelScan,
    setProducts,
    setAiResults,
    setScanError,
    cancelRef,
    creepRef,
    // helper
    findAiForProduct,
  };
}
