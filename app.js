const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const puppeteer = require("puppeteer-core");
const { generateUserAgent } = require("./ua-generator");

// === CONFIG LOAD ===
const config = JSON.parse(fs.readFileSync("config.json", "utf8"));

// === GLOBAL COUNTERS ===
let successThreads = 0;
let failThreads = 0;
const usedCookies = new Set();

// === Helpers ===
function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function loadProxies() {
  if (!fs.existsSync(config.proxiesFile)) return [];
  return fs.readFileSync(config.proxiesFile, "utf8")
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);
}

function loadKeywords() {
  if (!fs.existsSync(config.keywordsFile)) return [];
  return fs.readFileSync(config.keywordsFile, "utf8")
    .split("\n")
    .map(k => k.trim())
    .filter(Boolean);
}

function loadAvailableCookies() {
  const cookieDir = path.join(__dirname, config.cookiesFolder);
  if (!fs.existsSync(cookieDir)) return [];
  return fs.readdirSync(cookieDir).filter(f => f.endsWith(".json") || f.endsWith(".txt"));
}

function loadCookieFile(file) {
  try {
    const raw = fs.readFileSync(path.join(__dirname, config.cookiesFolder, file), "utf8");
    const parsed = JSON.parse(raw);
    const rawCookies = parsed.cookies || parsed;
    return rawCookies.map(c => {
      const { partitionKey, sourcePort, sourceScheme, size, priority, ...valid } = c;
      return valid;
    });
  } catch (err) {
    console.log(chalk.red(`[COOKIE PARSE ERROR] ${err.message}`));
    return null;
  }
}

function detectDevice(userAgent) {
  if (/Mobi|Android/i.test(userAgent)) return "mobile";
  if (/iPad|Tablet/i.test(userAgent)) return "tablet";
  return "desktop";
}

function getViewport(type) {
  if (type === "mobile") return { width: 390, height: 844, isMobile: true };
  if (type === "tablet") return { width: 820, height: 1180, isMobile: true };
  return { width: 1366, height: 768, isMobile: false };
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function humanScroll(page, duration) {
  const start = Date.now();
  while (Date.now() - start < duration) {
    const scrollY = Math.floor(Math.random() * 300) + 200;
    await page.evaluate(y => window.scrollBy(0, y), scrollY);
    await sleep(Math.floor(Math.random() * 1500) + 800);
  }
}

// === Ana Bot ===
async function runBot(threadId, proxy, keyword, cookieFile) {
  console.log(chalk.cyan(`\n========== THREAD-${threadId} ==========\n`));

  const userAgent = generateUserAgent();
  const deviceType = detectDevice(userAgent);
  const viewport = getViewport(deviceType);

  const launchArgs = [`--user-agent=${userAgent}`];
  if (proxy) {
    const [host, port] = proxy.split(":");
    launchArgs.push(`--proxy-server=${host}:${port}`);
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: config.executablePath,
      headless: config.headless,
      args: launchArgs,
    });

    const page = await browser.newPage();
    await page.setViewport(viewport);

    if (proxy) {
      const [host, port, user, pass] = proxy.split(":");
      if (user && pass) {
        await page.authenticate({ username: user, password: pass });
      }
    }

    if (cookieFile) {
      const cookies = loadCookieFile(cookieFile);
      if (cookies) {
        try {
          await page.setCookie(...cookies);
          usedCookies.add(cookieFile);
          console.log(chalk.green(`[THREAD-${threadId}] Cookie yüklendi: ${cookieFile}`));
        } catch (err) {
          console.log(chalk.red(`[THREAD-${threadId}] Cookie load error: ${err.message}`));
        }
      }
    }

    console.log(chalk.yellow(`[THREAD-${threadId}] Searching: ${keyword}`));
    await page.goto(`https://www.google.com/search?q=${encodeURIComponent(keyword)}`, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    let found = false;
    let pageNum = 1;

    while (!found && pageNum <= config.maxPages) {
      console.log(chalk.blue(`[THREAD-${threadId}] Scanning page ${pageNum}`));

      const results = await page.$$("a");

      for (let el of results) {
        const href = await el.evaluate(a => a.href);
        if (config.domains.some(d => href.includes(d))) {
          console.log(chalk.green(`[THREAD-${threadId}] FOUND! Clicking: ${href}`));
          await Promise.all([
            page.waitForNavigation({ waitUntil: "networkidle2" }),
            el.click(),
          ]);
          found = true;

          // === Browse & click inside ===
          const startBrowse = Date.now();
          let clicks = 0;

          while (Date.now() - startBrowse < config.browseTime && clicks < config.maxClicks) {
            await humanScroll(page, 2000);

            const domainLinks = await page.$$eval("a", els =>
              els.map(a => a.href).filter(h => h && h.startsWith("http"))
            );

            const validLinks = domainLinks.filter(h =>
              config.domains.some(d => h.includes(d))
            );

            if (validLinks.length > 0) {
              const link = getRandomElement(validLinks);
              console.log(chalk.yellow(`[THREAD-${threadId}] Clicking inside: ${link}`));
              try {
                await Promise.all([
                  page.waitForNavigation({ waitUntil: "networkidle2" }),
                  page.evaluate(h => {
                    document.querySelectorAll("a").forEach(a => {
                      if (a.href === h) a.click();
                    });
                  }, link),
                ]);
                clicks++;
              } catch (e) {
                console.log(chalk.red(`[THREAD-${threadId}] Click failed: ${e.message}`));
              }
            }

            await sleep(2000);
          }

          console.log(chalk.green(`[THREAD-${threadId}] Finished browsing, closing.`));
          successThreads++;
          await browser.close();
          return;
        }
      }

      // === Next button ===
      let nextBtn = null;
      if (deviceType === "mobile") {
        nextBtn = await page.$("a.T7sFge[aria-label='Diğer arama sonuçları']");
      } else {
        nextBtn = await page.$("#pnnext");
      }

      if (nextBtn) {
        console.log(chalk.yellow(`[THREAD-${threadId}] Going to page ${pageNum + 1}`));
        if (deviceType === "mobile") {
          await nextBtn.click();
          await sleep(3000);
        } else {
          await Promise.all([
            page.waitForNavigation({ waitUntil: "networkidle2" }),
            nextBtn.click(),
          ]);
        }
        pageNum++;
      } else {
        console.log(chalk.red(`[THREAD-${threadId}] Next button not found, stopping.`));
        break;
      }
    }

    if (!found) {
      console.log(chalk.red(`[THREAD-${threadId}] Domain not found in first ${pageNum} pages`));
      failThreads++;
    }
  } catch (err) {
    console.log(chalk.red(`[THREAD-${threadId}] ERROR: ${err.message}`));
    failThreads++;
  }

  if (browser) await browser.close();
}

// === Scheduler ===
async function main() {
  const proxies = loadProxies();
  const keywords = loadKeywords();
  const cookies = loadAvailableCookies();

  if (keywords.length === 0) {
    console.log(chalk.red("keywords.txt boş knk, doldurman lazım."));
    return;
  }

  if (cookies.length === 0) {
    console.log(chalk.red("cookies klasörü boş knk."));
    return;
  }

  if (config.spreadThreads) {
    // Zamana yayma açık
    const interval = Math.floor((config.timeFrameHours * 3600 * 1000) / config.threads);
    console.log(chalk.cyan(`\nScheduler başlıyor → ${config.threads} thread ${config.timeFrameHours} saat içinde yayılacak (~${interval / 1000}s arayla)\n`));

    let launched = 0;
    for (let i = 0; i < config.threads; i++) {
      setTimeout(async () => {
        const proxy = proxies.length > 0 ? proxies[i % proxies.length] : null;
        const keyword = keywords[i % keywords.length];

        // 🔥 cookie random seçimi
        let available = cookies.filter(c => !usedCookies.has(c));
        let cookieFile = available.length > 0 ? getRandomElement(available) : null;

        if (!cookieFile) {
          console.log(chalk.red(`[THREAD-${i + 1}] Cookie kalmadı, atlanıyor.`));
          return;
        }

        launched++;
        await runBot(i + 1, proxy, keyword, cookieFile);

        console.log(chalk.magenta(`\n=== Progress: ${successThreads} success / ${failThreads} fail / ${launched} launched ===\n`));
      }, i * interval);
    }
  } else {
    // Zamana yayma kapalı → klasik threads
    const tasks = [];
    for (let i = 0; i < config.threads; i++) {
      const proxy = proxies.length > 0 ? proxies[i % proxies.length] : null;
      const keyword = keywords[i % keywords.length];

      // 🔥 cookie random seçimi
      let available = cookies.filter(c => !usedCookies.has(c));
      let cookieFile = available.length > 0 ? getRandomElement(available) : null;

      if (!cookieFile) {
        console.log(chalk.red(`[THREAD-${i + 1}] Cookie kalmadı, atlanıyor.`));
        continue;
      }


      tasks.push(runBot(i + 1, proxy, keyword, cookieFile));
    }
    await Promise.all(tasks);
    console.log(chalk.magenta(`\n=== Progress: ${successThreads} success / ${failThreads} fail / ${config.threads} launched ===\n`));
  }
}

main();