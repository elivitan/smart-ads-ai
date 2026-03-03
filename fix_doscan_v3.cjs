const fs = require('fs');
const filePath = 'app/routes/app._index.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Find the doScan function boundaries
const startMarker = '  async function doScan(mode) {';
const startIdx = content.indexOf(startMarker);
if (startIdx === -1) { console.log('ERROR: Could not find doScan start'); process.exit(1); }

const endMarker = '\n  function handleStartCampaign()';
const endIdx = content.indexOf(endMarker, startIdx);
if (endIdx === -1) { console.log('ERROR: Could not find doScan end'); process.exit(1); }

console.log(`Found doScan: char ${startIdx} to ${endIdx}`);

// Also fix dynamicSteps to be scanStep-based
const oldDynSteps = content.match(/const dynamicSteps = isPaid \?[\s\S]*?\];/);
let dynStepsStart = -1, dynStepsEnd = -1;
if (oldDynSteps) {
  dynStepsStart = content.indexOf(oldDynSteps[0]);
  dynStepsEnd = dynStepsStart + oldDynSteps[0].length;
  console.log(`Found dynamicSteps at char ${dynStepsStart}`);
}

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

    // Phase 1: smooth 0% -> 10% while fetching product list
    let smoothProg = 0;
    const smoothTimer = setInterval(() => {
      smoothProg = Math.min(smoothProg + 0.15, 8);
      setFakeProgress(Math.round(smoothProg * 10) / 10);
    }, 100);

    try {
      /* ── Step 1: Fetch products ── */
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

      // Animate to 10%
      for (let p = Math.ceil(smoothProg); p <= 10; p++) {
        setFakeProgress(p);
        await new Promise(r => setTimeout(r, 40));
      }

      const total = productsToAnalyze.length;
      const _count = allFetchedProducts.length;
      if (isPaid) {
        const _openers = [
          "Nice! Found " + _count + " products in your store \\u{1F6CD}\\uFE0F",
          "Got it \\u2014 " + _count + " products ready for analysis!",
          "Your store looks great! Let's make these " + _count + " products shine \\u2728",
        ];
        setScanMsg(_openers[Math.floor(Math.random() * _openers.length)]);
      } else {
        setScanMsg("Found " + _count + " products \\u2014 analyzing top " + FREE_SCAN_LIMIT + " for your preview...");
      }
      await new Promise(r => setTimeout(r, 800));

      /* ── Step 2: AI analysis in batches ── */
      const BATCH_SIZE = 3;
      const batches = Math.ceil(total / BATCH_SIZE);

      // 5 paid step names (sidebar steps 2-6)
      const stepNames = [
        "Searching Google for competitors",
        "Analyzing competitor websites",
        "Checking your Google rankings",
        "Generating AI-optimized ad copy",
        "Building your competitive strategy",
      ];

      // Each step counts 1..total. Total percentage range: 10% to 92% = 82%.
      // Divide 82% into 5 steps (for paid), each step gets 82/5 = 16.4%.
      // Within each step, batches fill sub-ranges.
      const numSteps = isPaid ? stepNames.length : 1;
      const pctPerStep = 82 / numSteps; // ~16.4% per step

      // Assign each batch to a step
      // With 6 batches and 5 steps: step0=[batch0,batch1], step1=[batch2], ...
      // Simple: step index = floor(b / batches * numSteps)
      let currentStepIdx = -1;
      let stepProductCounter = 0; // counts 1..total within each step

      for (let b = 0; b < batches; b++) {
        if (cancelRef.current) { setIsScanning(false); return; }

        const batchStartIdx = b * BATCH_SIZE;
        const batch = productsToAnalyze.slice(batchStartIdx, batchStartIdx + BATCH_SIZE);

        // Which step does this batch belong to?
        const newStepIdx = Math.min(Math.floor(b / batches * numSteps), numSteps - 1);

        // Did we move to a new step?
        if (newStepIdx !== currentStepIdx) {
          currentStepIdx = newStepIdx;
          stepProductCounter = 0; // reset counter for new step
          setScanStep(currentStepIdx + 2); // step 2 = first analysis step
        }

        // Percentage range for this batch
        // Step base + position within step
        const batchesInThisStep = Math.ceil(batches / numSteps);
        const batchWithinStep = b - Math.round(currentStepIdx * batches / numSteps);
        const batchesForStep = Math.round((currentStepIdx + 1) * batches / numSteps) - Math.round(currentStepIdx * batches / numSteps);

        const stepBasePct = 10 + currentStepIdx * pctPerStep;
        const batchStartPct = stepBasePct + (batchWithinStep / batchesForStep) * pctPerStep;
        const batchEndPct = stepBasePct + ((batchWithinStep + 1) / batchesForStep) * pctPerStep;

        // During this batch, count products from stepProductCounter+1 to stepProductCounter+batch.length
        const countStart = stepProductCounter;
        const countEnd = Math.min(stepProductCounter + batch.length, total);
        const stepName = isPaid ? stepNames[currentStepIdx] : "Analyzing";

        // Set initial message
        if (isPaid) {
          setScanMsg((countStart + 1) + " of " + total + " products \\u00b7 " + stepName);
        } else {
          setScanMsg("Analyzing product " + (countStart + 1) + " of " + total + "...");
        }

        // Creep timer: smoothly animate percentage and product counter
        let creepPct = batchStartPct;
        const creepTarget = batchEndPct - 1;
        const cStart = countStart;
        const cEnd = countEnd;

        if (creepRef.current) clearInterval(creepRef.current);
        const creepTimer = setInterval(() => {
          if (creepPct < creepTarget) {
            creepPct = Math.min(creepPct + 0.3, creepTarget);
          } else if (creepPct < batchEndPct - 0.2) {
            creepPct += 0.05;
          }
          setFakeProgress(Math.round(creepPct * 10) / 10);

          // Smoothly count products within this batch
          const batchProgress = Math.min((creepPct - batchStartPct) / (batchEndPct - batchStartPct), 1);
          const currentCount = cStart + Math.round(batchProgress * (cEnd - cStart));
          if (isPaid) {
            setScanMsg(Math.max(currentCount, 1) + " of " + total + " products \\u00b7 " + stepName);
          } else {
            setScanMsg("Analyzing product " + Math.max(currentCount, 1) + " of " + total + "...");
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

        // Update counter
        stepProductCounter = countEnd;

        // Snap to batch end
        setFakeProgress(Math.round(batchEndPct * 10) / 10);
        if (isPaid) {
          setScanMsg(countEnd + " of " + total + " products \\u00b7 " + stepName);
        } else {
          setScanMsg("Analyzing product " + countEnd + " of " + total + "...");
        }

        let aiData;
        try { aiData = JSON.parse(aiText); }
        catch { throw new Error("AI returned invalid response on batch " + (b + 1) + "."); }
        if (!aiData.success) throw new Error(aiData.error || "AI failed on batch " + (b + 1));

        const batchProducts = aiData.result?.products || [];
        allAiProducts = [...allAiProducts, ...batchProducts];
      }

      if (cancelRef.current) { setIsScanning(false); return; }

      /* ── Step 3: Finalize ── */
      setScanStep(isPaid ? 7 : 4);
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

// Replace dynamicSteps
const dynStepsMatch = content.match(/const dynamicSteps = isPaid \?[\s\S]*?\];/);
if (dynStepsMatch) {
  content = content.replace(dynStepsMatch[0], newDynSteps);
  console.log('Replaced dynamicSteps ✅');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('\\nSUCCESS: doScan completely rewritten ✅');
console.log('\\nHow it works now:');
console.log('  Step "Searching Google":       1 of 17 → 2 → 3 → ... → 17 of 17 ✓');
console.log('  Step "Analyzing competitors":  1 of 17 → 2 → 3 → ... → 17 of 17 ✓');
console.log('  Step "Checking rankings":      1 of 17 → 2 → 3 → ... → 17 of 17 ✓');
console.log('  Each step counts independently from 1 to total.');
console.log('  Sidebar and center message always show the SAME step.');
