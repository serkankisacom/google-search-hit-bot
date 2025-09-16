const fs = require("fs");
const chalk = require("chalk");
const { connect } = require("puppeteer-real-browser");

const config = JSON.parse(fs.readFileSync("config.json", "utf8"));

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// === Sayfa tamamen yüklenmesini bekle ===
async function waitForPageLoad(page, threadId) {
  try {
    await page.waitForFunction(() => document.readyState === "complete", { timeout: 60000 });
    console.log(chalk.gray(`[THREAD-${threadId}] Page fully loaded ✅`));
  } catch {
    console.log(chalk.red(`[THREAD-${threadId}] Page load timeout ⏳`));
  }
}

// === Captcha kontrol ===
async function checkCaptchaPage(page, threadId) {
  try {
    const html = await page.content();
    if (
      html.includes("captcha-form") ||
      html.includes("g-recaptcha") ||
      html.includes("Our systems have detected")
    ) {
      console.log(
        chalk.red(`[THREAD-${threadId}] CAPTCHA sayfası algılandı, thread kapatılıyor.`)
      );
      return true;
    }
  } catch {}
  return false;
}

// === Google sonuçlarının yüklendiğini kontrol et ===
async function waitForSearchResults(page, threadId) {
  try {
    await page.waitForSelector("#result-stats, .KTBKoe", { timeout: 15000 });
    console.log(chalk.green(`[THREAD-${threadId}] Search results loaded ✅`));
    return true;
  } catch {
    console.log(chalk.red(`[THREAD-${threadId}] Search results not loaded ⏳`));
    return false;
  }
}

// === Element click (sleep + navigation senkron) ===
async function elementClick(page, element, threadId) {
  try {
    let href = await page.evaluate(el => el.getAttribute("href") || el.innerText, element);
    let realUrl = href;
    if (href && href.startsWith("/url?")) {
      const urlParams = new URLSearchParams(href.replace("/url?", ""));
      if (urlParams.has("q")) realUrl = urlParams.get("q");
    }

    // Humanize: click öncesi 3sn bekle
    await sleep(3000);

    // Click yap
    await element.click();

    // Navigation bekle
    await page.waitForNavigation({ waitUntil: "load", timeout: 60000 }).catch(() => null);

    // Sayfa yüklenmesini bekle
    await waitForPageLoad(page, threadId);

    console.log(chalk.green(`[THREAD-${threadId}] [CLICK] → ${realUrl || href || "?"}`));
  } catch (err) {
    console.log(chalk.red(`[THREAD-${threadId}] [ELEMENT-CLICK ERROR] ${err.message}`));
  }
}

// === Human scroll ===
async function humanScroll(page, duration) {
  const start = Date.now();
  const viewport = await page.viewport();

  while (Date.now() - start < duration) {
    const scrollY = (Math.random() > 0.5 ? 1 : -1) * (Math.floor(Math.random() * 300) + 150);
    await page.evaluate(y => window.scrollBy(0, y), scrollY);

    const randX = Math.floor(Math.random() * viewport.width);
    const randY = Math.floor(Math.random() * viewport.height);
    await page.mouse.move(randX, randY, { steps: Math.floor(Math.random() * 4) + 2 });

    await sleep(Math.floor(Math.random() * 1200) + 600);
  }
}

// === Google çerez handler ===
async function handleGoogleCookies(page, threadId) {
  try {
    const html = await page.content();
    if (html.includes("Google'a devam etmeden önce")) {
      console.log(chalk.yellow(`[THREAD-${threadId}] Çerez ekranı bulundu, kabul ediliyor...`));
      const btn = await page.$("#L2AGLb, #W0wltc");
      if (btn) {
        await elementClick(page, btn, threadId);
        console.log(chalk.green(`[THREAD-${threadId}] Çerezler kabul edildi.`));
      }
    } else {
      console.log(chalk.gray(`[THREAD-${threadId}] Çerez ekranı çıkmadı, devam.`));
    }
  } catch (err) {
    console.log(chalk.red(`[THREAD-${threadId}] Cookie handler error: ${err.message}`));
  }
}

// === Site içinde gezinme ===
async function browseSite(page, threadId) {
  const startBrowse = Date.now();
  let clicks = 0;

  while (Date.now() - startBrowse < config.browseTime && clicks < config.maxClicks) {
    await waitForPageLoad(page, threadId);
    await humanScroll(page, 2000);

    const domainLinks = await page.$$eval("a", els =>
      els.map(a => a.href).filter(h => h && h.startsWith("http"))
    );
    const validLinks = domainLinks.filter(h =>
      config.domains.some(d => h.includes(d))
    );

    if (validLinks.length > 0) {
      const link = validLinks[Math.floor(Math.random() * validLinks.length)];
      const linkHandle = await page.$(`a[href='${link}']`);
      if (linkHandle) {
        console.log(chalk.yellow(`[THREAD-${threadId}] [BROWSE] Clicking inside: ${link}`));
        await elementClick(page, linkHandle, threadId);
        clicks++;
      }
    }

    await sleep(2000);
  }

  console.log(chalk.green(`[THREAD-${threadId}] [BROWSE] Finished (Clicks: ${clicks}) ✅`));
}

// === Ana Bot ===
async function runBot(threadId, proxy, keyword, cookieFile) {
  console.log(chalk.cyan(`\n========== THREAD-${threadId} ==========\n`));

  let browser, page;
  try {
    const response = await connect({
      headless: config.headless,
      fingerprint: true,
      turnstile: true,
      args: ["--disable-blink-features=AutomationControlled"],
      customConfig: {
        executablePath: config.executablePath,
        defaultViewport: { width: 1366, height: 768 },
      },
      proxy: proxy
        ? (() => {
            const [host, port, user, pass] = proxy.split(":");
            return { host, port, username: user, password: pass };
          })()
        : undefined,
    });

    browser = response.browser;
    page = response.page;

    console.log(chalk.yellow(`[SEARCH] Searching: ${keyword}`));
    await page.goto(`https://www.google.com/search?q=${encodeURIComponent(keyword)}`, {
      waitUntil: "load",
      timeout: 60000,
    });

    await waitForPageLoad(page, threadId);

    if (await checkCaptchaPage(page, threadId)) {
      process.send && process.send({ type: "fail", threadId });
      await browser.close();
      return;
    }

    if (!(await waitForSearchResults(page, threadId))) {
      process.send && process.send({ type: "fail", threadId });
      await browser.close();
      return;
    }

    await handleGoogleCookies(page, threadId);

    let found = false;
    let pageNum = 1;
    while (!found && pageNum <= config.maxPages) {
      console.log(chalk.blue(`[SEARCH] Scanning page ${pageNum}`));
      const results = await page.$$("a");

      for (let el of results) {
        let href = await el.evaluate(a => a.getAttribute("href"));
        if (!href) continue;

        let realUrl = href;
        if (href.startsWith("/url?")) {
          const urlParams = new URLSearchParams(href.replace("/url?", ""));
          if (urlParams.has("q")) realUrl = urlParams.get("q");
        }

        if (config.domains.some(d => realUrl.includes(d))) {
          console.log(chalk.green(`[SEARCH] FOUND! Clicking: ${realUrl}`));
          await elementClick(page, el, threadId);
          found = true;

          await browseSite(page, threadId);

          process.send && process.send({ type: "success", threadId });
          await browser.close();
          return;
        }
      }

      const nextBtn = await page.$("#pnnext");
      if (nextBtn) {
        console.log(chalk.yellow(`[SEARCH] Going to page ${pageNum + 1}`));
        await nextBtn.click();
        await page.waitForNavigation({ waitUntil: "load", timeout: 60000 }).catch(() => null);
        await waitForPageLoad(page, threadId);
        pageNum++;
      } else {
        break;
      }
    }

    if (!found) {
      console.log(chalk.red(`[SEARCH] Domain not found in first ${pageNum} pages`));
      process.send && process.send({ type: "fail", threadId });
    }
  } catch (err) {
    console.log(chalk.red(`[THREAD-${threadId}] ERROR: ${err.message}`));
    process.send && process.send({ type: "fail", threadId });
  }

  if (browser) await browser.close();
}

// === Args ===
const args = process.argv.slice(2);
const threadId = args[0];
const proxy = args[1] !== "null" ? args[1] : null;
const keyword = args[2] !== "null" ? args[2] : null;
const cookieFile = args[3] !== "null" ? args[3] : null;

runBot(threadId, proxy, keyword, cookieFile);
