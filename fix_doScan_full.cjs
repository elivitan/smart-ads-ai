const fs = require('fs');
const filePath = 'app/routes/app._index.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Find the doScan function boundaries
const startMarker = '  async function doScan(mode) {';
const startIdx = content.indexOf(startMarker);
if (startIdx === -1) { console.log('ERROR: Could not find doScan start'); process.exit(1); }

// Find the end: next function at same indent level
// doScan ends before "function handleStartCampaign"
const endMarker = '\n  function handleStartCampaign()';
const endIdx = content.indexOf(endMarker, startIdx);
if (endIdx === -1) { console.log('ERROR: Could not find doScan end'); process.exit(1); }

console.log(`Found doScan: char ${startIdx} to ${endIdx}`);

const newDoScan = `  async function doScan(mode) {
    if (mode === "auto" && !selectedPlan) { setShowOnboard(true); setOnboardStep(1); return; }
    const isAuto = mode === "auto";
    setScanMode(mode || "review");
    setIsScanning(true);
    setScanStep(1);
    setFakeProgress(0);
    setScanMsg(isPaid ? "Connecting to your Shopify store..." : "Quick preview scan starting...");
    setAutoStatus(null);
    setScanError(null);
    cancelRef.current = false;
    if (creepRef.current) { clearInterval(creepRef.current); creepRef.current = null; }

    let fetchedProducts = [];
    let allAiProducts = [];

    // Phase 1 smooth progress: 0% -> 10%
    let smoothProg = 0;
    const smoothTimer = setInterval(() => {
      smoothProg = Math.min(smoothProg + 0.15, 8);
      setFakeProgress(Math.round(smoothProg * 10) / 10);
    }, 100);

    try {
      /* Step 1: Fetch products */
      const fetchForm = new FormData();
      fetchForm.append("step", "fetch");
      const fetchRes = await fetch("/app/api/scan", { method: "POST", body: fetchForm });
      const fetchText = await fetchRes.text();
      let fetchData;
      try { fetchData = JSON.parse(fetchText); }
      catch { throw new Error("Server returned invalid response. Restart the server."); }
      if (!fetchData.success) throw new Error(fetchData.error || "Failed to fetch products");
      if (cancelRef.current) { clearInterval(smoothTimer); setIsScanning(false); return; }

      clearInterval(smoothTimer);
      let allFetchedProducts = fetchData.products;
      const storeUrl = fetchData.storeInfo?.url || "";

      const productsToAnalyze = isPaid ? allFetchedProducts : allFetchedProducts.slice(0, FREE_SCAN_LIMIT);
      fetchedProducts = allFetchedProducts;
      setProducts(allFetchedProducts);
      setScanStep(2);

      // Animate from current to 10%
      for (let p = Math.ceil(smoothProg); p <= 10; p++) {
        setFakeProgress(p);
        await new Promise(r => setTimeout(r, 40));
      }

      const _count = allFetchedProducts.length;
      if (isPaid) {
        const _openers = [
          "Nice! Found " + _count + " products in your store \\u{1F6CD}\\uFE0F",
          "Got it \\u2014 " + _count + " products ready for analysis!",
          "Your store looks great! Let's make these " + _count + " products shine \\u2728",
          "Found " + _count + " products \\u2014 time to put them on the map \\u{1F5FA}\\uFE0F",
        ];
        setScanMsg(_openers[Math.floor(Math.random() * _openers.length)]);
      } else {
        setScanMsg("Found " + _count + " products \\u2014 analyzing top " + FREE_SCAN_LIMIT + " for your preview...");
      }
      await new Promise(r => setTimeout(r, 800));

      /* Step 2: AI analysis in batches of 3 */
      const BATCH_SIZE = 3;
      const total = productsToAnalyze.length;
      const batches = Math.ceil(total / BATCH_SIZE);

      // === STEP NAMES mapped to batch ranges ===
      // We have 6 step names for paid users.
      // Distribute batches across steps evenly.
      const paidStepNames = [
        "Searching Google for competitors",
        "Analyzing competitor websites",
        "Checking your Google rankings",
        "Generating AI-optimized ad copy",
        "Building your competitive strategy",
      ];

      // Helper: get step name for a given batch index
      function getStepName(batchIdx) {
        if (!isPaid) return "Analyzing";
        // Map batch index to step name
        const stepIdx = Math.min(Math.floor(batchIdx / batches * paidStepNames.length), paidStepNames.length - 1);
        return paidStepNames[stepIdx];
      }

      // Helper: get step name for a given percentage (must match dynamicSteps thresholds!)
      function getStepNameByPct(pct) {
        if (!isPaid) return "Analyzing";
        if (pct < 25) return "Searching Google for competitors";
        if (pct < 45) return "Analyzing competitor websites";
        if (pct < 60) return "Checking your Google rankings";
        if (pct < 80) return "Generating AI-optimized ad copy";
        return "Building your competitive strategy";
      }

      // Track how many products have been fully analyzed
      let analyzedSoFar = 0;

      for (let b = 0; b < batches; b++) {
        if (cancelRef.current) { setIsScanning(false); return; }

        const batchStart = b * BATCH_SIZE;
        const batch = productsToAnalyze.slice(batchStart, batchStart + BATCH_SIZE);

        // Percentage range for this batch within the 10%-92% range
        const batchStartPct = 10 + Math.round((b / batches) * 82);
        const batchEndPct = 10 + Math.round(((b + 1) / batches) * 82);

        // Products being processed in this batch
        const productsInProgress = analyzedSoFar + batch.length;

        // Set initial message for this batch immediately
        const initialStepName = getStepNameByPct(batchStartPct);
        if (isPaid) {
          setScanMsg(productsInProgress + " of " + total + " products \\u00b7 " + initialStepName);
        } else {
          setScanMsg("Analyzing product " + productsInProgress + " of " + total + "...");
        }

        // Creep timer: smoothly animate percentage during this batch
        let creepPct = batchStartPct;
        const creepTarget = batchEndPct - 3;

        if (creepRef.current) clearInterval(creepRef.current);
        const creepTimer = setInterval(() => {
          // Advance percentage smoothly
          if (creepPct < creepTarget) {
            creepPct = Math.min(creepPct + 0.3, creepTarget);
          } else if (creepPct < batchEndPct - 0.5) {
            creepPct += 0.05;
          }
          setFakeProgress(Math.round(creepPct * 10) / 10);

          // Update step name based on current percentage (syncs with sidebar)
          const curPct = Math.round(creepPct);
          const stepName = getStepNameByPct(curPct);
          if (isPaid) {
            setScanMsg(productsInProgress + " of " + total + " products \\u00b7 " + stepName);
          } else {
            setScanMsg("Analyzing product " + productsInProgress + " of " + total + "...");
          }
        }, 400);
        creepRef.current = creepTimer;

        // === Actually call the AI API ===
        const aiForm = new FormData();
        aiForm.append("step", "analyze-batch");
        aiForm.append("products", JSON.stringify(batch));
        aiForm.append("storeDomain", storeUrl);
        const aiRes = await fetch("/app/api/scan", { method: "POST", body: aiForm });
        const aiText = await aiRes.text();

        // Batch complete - stop creep timer
        clearInterval(creepTimer);
        creepRef.current = null;

        // Update analyzed count
        analyzedSoFar += batch.length;

        // Jump progress to batch end and sync scanMsg with sidebar
        setFakeProgress(batchEndPct);
        const endStepName = getStepNameByPct(batchEndPct);
        if (isPaid) {
          setScanMsg(analyzedSoFar + " of " + total + " products \\u00b7 " + endStepName);
        } else {
          setScanMsg("Analyzing product " + analyzedSoFar + " of " + total + "...");
        }

        let aiData;
        try { aiData = JSON.parse(aiText); }
        catch { throw new Error("AI returned invalid response on batch " + (b + 1) + "."); }
        if (!aiData.success) throw new Error(aiData.error || "AI failed on batch " + (b + 1));

        const batchProducts = aiData.result?.products || [];
        allAiProducts = [...allAiProducts, ...batchProducts];
      }

      if (cancelRef.current) { setIsScanning(false); return; }

      /* Step 3: Finalize */
      setScanMsg(isPaid ? "Almost done \\u2014 putting it all together for you! \\u{1F680}" : "Wrapping up your preview...");
      for (let p = 92; p <= 98; p++) {
        setFakeProgress(p);
        await new Promise(r => setTimeout(r, 60));
      }

      const _topScore = allAiProducts.reduce((best, p) => (p.ad_score||0) > (best.ad_score||0) ? p : best, allAiProducts[0] || {});
      const _highPot = allAiProducts.filter(p => (p.ad_score||0) >= 70).length;

      let summary;
      if (isPaid) {
        const _summaries = [
          "We found " + _highPot + " high-potential products \\u2014 " + (_topScore.title || "your top product") + " looks especially strong \\u{1F31F}",
          "Your store is ad-ready! " + _highPot + " products scored 70+ \\u2014 that's a great starting point \\u{1F680}",
          "AI analysis complete! " + (_topScore.title || "Your best product") + " could be your star campaign \\u{1F3AF}",
        ];
        summary = _summaries[Math.floor(Math.random() * _summaries.length)];
      } else {
        const remaining = fetchedProducts.length - FREE_SCAN_LIMIT;
        summary = "Preview: We analyzed " + FREE_SCAN_LIMIT + " of your " + fetchedProducts.length + " products. " + (_topScore.title || "Your top product") + " shows real potential! Upgrade to unlock all " + remaining + " remaining products and get full campaign-ready analysis.";
      }

      try { sessionStorage.setItem("sai_lastScan", new Date().toISOString()); } catch {}
      setAiResults({
        summary,
        recommended_budget: 100,
        products: allAiProducts,
      });
      setFakeProgress(100);
      setScanMsg(isPaid ? "Your store is ready to grow \\u{1F389}" : "Preview ready!");
      triggerConfetti();
      await new Promise(r => setTimeout(r, 800));

    } catch (e) {
      clearInterval(smoothTimer);
      if (creepRef.current) { clearInterval(creepRef.current); creepRef.current = null; }
      const msg = e.message || "Something went wrong";
      let friendlyMsg = msg;
      if (msg.includes("credit balance") || msg.includes("billing")) {
        friendlyMsg = "AI credits have run out. Please top up your Anthropic API balance at console.anthropic.com.";
      } else if (msg.includes("rate_limit") || msg.includes("429")) {
        friendlyMsg = "Too many requests. Please wait a minute and try again.";
      } else if (msg.includes("401") || msg.includes("api_key")) {
        friendlyMsg = "API key is invalid. Please check your ANTHROPIC_API_KEY in the .env file.";
      } else if (msg.includes("timeout") || msg.includes("ETIMEDOUT")) {
        friendlyMsg = "Connection timeout. Please check your internet and try again.";
      } else if (msg.includes("overloaded")) {
        friendlyMsg = "AI service is temporarily overloaded. Please try again in a few minutes.";
      }
      setScanError(friendlyMsg);
      setIsScanning(false);
      setScanStep(0);
      setFakeProgress(0);
      return;
    }

    setIsScanning(false);
    setScanStep(0);
    setFakeProgress(0);

    if (isAuto && allAiProducts.length > 0) {
      setAutoStatus("creating");
      let successCount = 0;
      const campaignResults = [];
      setAutoProgress({current:0,total:fetchedProducts.length,title:""});
      for (let i = 0; i < fetchedProducts.length; i++) {
        const prod = fetchedProducts[i];
        setAutoProgress({current:i+1,total:fetchedProducts.length,title:prod.title});
        const ai = allAiProducts.find(ap => ap.title === prod.title) || allAiProducts[i] || {};
        try {
          const form = new FormData();
          form.append("productTitle", prod.title);
          form.append("headlines", JSON.stringify(ai.headlines || []));
          form.append("descriptions", JSON.stringify(ai.descriptions || []));
          form.append("keywords", JSON.stringify(ai.keywords || []));
          form.append("finalUrl", "https://eli-test-ads.myshopify.com");
          form.append("dailyBudget", "50");
          const res = await fetch("/app/api/campaign", { method: "POST", body: form });
          const data = await res.json();
          campaignResults.push({ title: prod.title, image: prod.image, price: prod.price, success: data.success, ai });
          if (data.success) successCount++;
        } catch { campaignResults.push({ title: prod.title, image: prod.image, price: prod.price, success: false, ai }); }
      }
      setAutoCampaigns(campaignResults); setAutoStatus(successCount > 0 ? "success" : "error");
    }
  }`;

// Replace the old doScan with the new one
content = content.substring(0, startIdx) + newDoScan + content.substring(endIdx);

fs.writeFileSync(filePath, content, 'utf8');
console.log('SUCCESS: doScan function completely rewritten ✅');
console.log('Changes:');
console.log('  - Product count synced with actual batch progress');
console.log('  - Step names synced with sidebar via same pct thresholds');
console.log('  - scanMsg updates immediately when batch completes');
console.log('  - No more "0 of 17" - shows products being processed');
console.log('  - creepRef properly cleaned on cancel and errors');
