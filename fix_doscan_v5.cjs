const fs = require('fs');
const filePath = 'app/routes/app._index.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Find doScan boundaries
const startMarker = '  async function doScan(mode) {';
const startIdx = content.indexOf(startMarker);
if (startIdx === -1) { console.log('ERROR: Could not find doScan start'); process.exit(1); }

const endMarker = '\n  function handleStartCampaign()';
const endIdx = content.indexOf(endMarker, startIdx);
if (endIdx === -1) { console.log('ERROR: Could not find doScan end'); process.exit(1); }

console.log(`Found doScan: char ${startIdx} to ${endIdx}`);

// Also find and replace dynamicSteps
const dynMatch = content.match(/const dynamicSteps = isPaid \?[\s\S]*?\];?\s*(?=\n\s*return)/);
let dynStart = -1, dynEnd = -1;
if (dynMatch) {
  dynStart = content.indexOf(dynMatch[0]);
  dynEnd = dynStart + dynMatch[0].length;
}

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

    // Phase 1: smooth 0%->10% while fetching
    let smoothProg = 0;
    const smoothTimer = setInterval(() => {
      smoothProg = Math.min(smoothProg + 0.15, 8);
      setFakeProgress(Math.round(smoothProg * 10) / 10);
    }, 100);

    try {
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

      for (let p = Math.ceil(smoothProg); p <= 10; p++) {
        setFakeProgress(p);
        await new Promise(r => setTimeout(r, 40));
      }

      const total = productsToAnalyze.length;
      const _count = allFetchedProducts.length;
      if (isPaid) {
        const openers = [
          "Nice! Found " + _count + " products in your store \\u{1F6CD}\\uFE0F",
          "Got it \\u2014 " + _count + " products ready for analysis!",
          "Your store looks great! Let\\u2019s make these " + _count + " products shine \\u2728",
        ];
        setScanMsg(openers[Math.floor(Math.random() * openers.length)]);
      } else {
        setScanMsg("Found " + _count + " products \\u2014 analyzing top " + FREE_SCAN_LIMIT + " for your preview...");
      }
      await new Promise(r => setTimeout(r, 800));

      /* ────────────────────────────────────────────
         AI ANALYSIS - ARCHITECTURE:
         
         5 visual steps, each counts 1→total.
         6 batches run across all 5 steps.
         
         The key insight: we DON'T tie the visual 
         product counter to actual batch completion.
         Instead, each step runs for a time slice 
         and the counter animates 1→total smoothly.
         
         The REAL progress (percentage) IS tied to 
         batches - it only advances when a batch 
         actually completes.
         
         Steps get equal time slices of the 10-92% 
         range. Batches fill in the real progress.
      ──────────────────────────────────────────── */
      
      const BATCH_SIZE = 3;
      const batches = Math.ceil(total / BATCH_SIZE);
      
      const stepNames = isPaid ? [
        "Searching Google for competitors",
        "Analyzing competitor websites", 
        "Checking your Google rankings",
        "Generating AI-optimized ad copy",
        "Building your competitive strategy",
      ] : ["Analyzing"];
      
      const numSteps = stepNames.length;
      const pctPerStep = 82 / numSteps;
      
      // Pre-assign batches to steps
      // e.g. 6 batches, 5 steps: [0,1] [2] [3] [4] [5]
      const batchToStep = [];
      for (let b = 0; b < batches; b++) {
        batchToStep.push(Math.min(Math.floor(b / batches * numSteps), numSteps - 1));
      }
      
      let currentVisualStep = -1;
      let stepStartTime = 0;
      let stepExpectedDuration = 15000; // will be adjusted
      
      for (let b = 0; b < batches; b++) {
        if (cancelRef.current) { setIsScanning(false); return; }
        
        const batchStart = b * BATCH_SIZE;
        const batch = productsToAnalyze.slice(batchStart, batchStart + BATCH_SIZE);
        const myStep = batchToStep[b];
        
        // Count how many batches are in this step
        const batchesInMyStep = batchToStep.filter(s => s === myStep).length;
        // Which batch am I within this step? (0-indexed)
        const myBatchWithinStep = batchToStep.slice(0, b).filter(s => s === myStep).length;
        
        // Percentage range
        const stepBasePct = 10 + myStep * pctPerStep;
        const batchStartPct = stepBasePct + (myBatchWithinStep / batchesInMyStep) * pctPerStep;
        const batchEndPct = stepBasePct + ((myBatchWithinStep + 1) / batchesInMyStep) * pctPerStep;
        
        // New visual step?
        if (myStep !== currentVisualStep) {
          currentVisualStep = myStep;
          stepStartTime = Date.now();
          // Estimate duration: batchesInMyStep * ~12sec per batch
          stepExpectedDuration = batchesInMyStep * 12000;
          setScanStep(myStep + 2); // step 1 = fetch, step 2+ = analysis
        }
        
        const stepName = stepNames[myStep];
        
        // Set initial message
        if (isPaid) {
          // Show product count based on time within this step
          const elapsed = Date.now() - stepStartTime;
          const stepProgress = Math.min(elapsed / stepExpectedDuration, 0.95);
          const displayCount = Math.max(1, Math.round(stepProgress * total));
          setScanMsg(displayCount + " of " + total + " products \\u00b7 " + stepName);
        } else {
          setScanMsg("Analyzing product " + Math.min(batchStart + 1, total) + " of " + total + "...");
        }
        
        // Creep timer: animates BOTH percentage and product counter
        let creepPct = batchStartPct;
        const creepTarget = batchEndPct - 1;
        const _stepStart = stepStartTime;
        const _stepDur = stepExpectedDuration;
        const _stepName = stepName;
        const _total = total;
        const _isPaid = isPaid;
        const _batchStart = batchStart;
        
        if (creepRef.current) clearInterval(creepRef.current);
        const creepTimer = setInterval(() => {
          // Advance percentage
          if (creepPct < creepTarget) {
            creepPct = Math.min(creepPct + 0.3, creepTarget);
          } else if (creepPct < batchEndPct - 0.2) {
            creepPct += 0.05;
          }
          setFakeProgress(Math.round(creepPct * 10) / 10);
          
          // Product counter: based on elapsed time within the step
          if (_isPaid) {
            const elapsed = Date.now() - _stepStart;
            const stepProgress = Math.min(elapsed / _stepDur, 0.97);
            const displayCount = Math.max(1, Math.round(stepProgress * _total));
            setScanMsg(displayCount + " of " + _total + " products \\u00b7 " + _stepName);
          } else {
            setScanMsg("Analyzing product " + Math.min(_batchStart + 1, _total) + " of " + _total + "...");
          }
        }, 400);
        creepRef.current = creepTimer;
        
        // === API call ===
        const aiForm = new FormData();
        aiForm.append("step", "analyze-batch");
        aiForm.append("products", JSON.stringify(batch));
        aiForm.append("storeDomain", storeUrl);
        const aiRes = await fetch("/app/api/scan", { method: "POST", body: aiForm });
        const aiText = await aiRes.text();
        
        clearInterval(creepTimer);
        creepRef.current = null;
        
        // Snap progress to batch end
        setFakeProgress(Math.round(batchEndPct * 10) / 10);
        
        // If this is the LAST batch of a step, show total/total
        const isLastBatchOfStep = (b + 1 >= batches) || (batchToStep[b + 1] !== myStep);
        if (isLastBatchOfStep && isPaid) {
          setScanMsg(total + " of " + total + " products \\u00b7 " + stepName);
        }
        
        let aiData;
        try { aiData = JSON.parse(aiText); }
        catch { throw new Error("AI returned invalid response on batch " + (b + 1) + "."); }
        if (!aiData.success) throw new Error(aiData.error || "AI failed on batch " + (b + 1));
        
        const batchProducts = aiData.result?.products || [];
        allAiProducts = [...allAiProducts, ...batchProducts];
        
        // Small pause between steps for visual clarity
        if (isLastBatchOfStep && b + 1 < batches) {
          await new Promise(r => setTimeout(r, 300));
        }
      }
      
      if (cancelRef.current) { setIsScanning(false); return; }

      /* ── Finalize ── */
      setScanStep(isPaid ? 7 : 4);
      setScanMsg(isPaid ? "Almost done \\u2014 putting it all together! \\u{1F680}" : "Wrapping up your preview...");
      for (let p = 92; p <= 98; p++) {
        setFakeProgress(p);
        await new Promise(r => setTimeout(r, 60));
      }

      const _topScore = allAiProducts.reduce((best, p) => (p.ad_score||0) > (best.ad_score||0) ? p : best, allAiProducts[0] || {});
      const _highPot = allAiProducts.filter(p => (p.ad_score||0) >= 70).length;

      let summary;
      if (isPaid) {
        const sums = [
          "We found " + _highPot + " high-potential products \\u2014 " + (_topScore.title || "your top product") + " looks especially strong \\u{1F31F}",
          "Your store is ad-ready! " + _highPot + " products scored 70+ \\u2014 great starting point \\u{1F680}",
          "AI analysis complete! " + (_topScore.title || "Your best product") + " could be your star campaign \\u{1F3AF}",
        ];
        summary = sums[Math.floor(Math.random() * sums.length)];
      } else {
        const remaining = fetchedProducts.length - FREE_SCAN_LIMIT;
        summary = "Preview: We analyzed " + FREE_SCAN_LIMIT + " of your " + fetchedProducts.length + " products. " + (_topScore.title || "Your top product") + " shows real potential! Upgrade to unlock all " + remaining + " remaining products.";
      }

      try { sessionStorage.setItem("sai_lastScan", new Date().toISOString()); } catch {}
      setAiResults({ summary, recommended_budget: 100, products: allAiProducts });
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

// Replace doScan
content = content.substring(0, startIdx) + newDoScan + content.substring(endIdx);

// Replace dynamicSteps - find it again after doScan replacement
const newDynSteps = `const dynamicSteps = isPaid ? [
      { label: "Fetching products from your store",      done: scanStep > 1,  active: scanStep === 1 },
      { label: "Searching Google for competitors",       done: scanStep > 2,  active: scanStep === 2 },
      { label: "Analyzing competitor websites",          done: scanStep > 3,  active: scanStep === 3 },
      { label: "Checking your Google rankings",          done: scanStep > 4,  active: scanStep === 4 },
      { label: "Generating AI-optimized ad copy",        done: scanStep > 5,  active: scanStep === 5 },
      { label: "Building your competitive strategy",     done: scanStep > 6,  active: scanStep === 6 },
    ] : [
      { label: "Fetching products",        done: scanStep > 1,  active: scanStep === 1 },
      { label: "Quick AI analysis",        done: scanStep > 2,  active: scanStep === 2 },
      { label: "Generating preview",       done: scanStep > 3,  active: scanStep === 3 },
    ]`;

const dynRegex = /const dynamicSteps = isPaid \?[\s\S]*?\] : \[[\s\S]*?\]/;
const dynFound = content.match(dynRegex);
if (dynFound) {
  content = content.replace(dynRegex, newDynSteps);
  console.log('Replaced dynamicSteps with scanStep-based version ✅');
} else {
  console.log('WARNING: Could not find dynamicSteps to replace');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('\\nSUCCESS ✅');
console.log('\\nArchitecture:');
console.log('  VISUAL (what user sees):');
console.log('    - 5 steps, each counts 1→17 smoothly based on elapsed time');
console.log('    - Sidebar driven by scanStep (changes when step changes)');
console.log('    - scanMsg shows same step name as sidebar ALWAYS');
console.log('  REAL (what drives progress):');
console.log('    - 6 batches of 3 products each');  
console.log('    - Percentage advances when batch actually completes');
console.log('    - Step changes when all batches for that step are done');
console.log('  SYNC:');
console.log('    - Counter reaches 17/17 exactly when last batch of step finishes');
console.log('    - Sidebar checkmark appears at same moment');
console.log('    - Next step starts with counter back at 1');
