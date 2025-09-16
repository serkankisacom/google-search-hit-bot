const fs = require("fs");
const path = require("path");
const { fork } = require("child_process");
const chalk = require("chalk");

const config = JSON.parse(fs.readFileSync("config.json", "utf8"));

let successThreads = 0;
let failThreads = 0;
const usedCookies = new Set();

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

function startThread(threadId, proxy, keyword, cookieFile) {
  const child = fork(path.join(__dirname, "runbrowser.js"), [
    threadId.toString(),
    proxy ? proxy : "null",
    keyword ? keyword : "null",
    cookieFile ? cookieFile : "null",
  ]);

  child.on("message", msg => {
    if (msg.type === "success") {
      successThreads++;
      console.log(chalk.green(`[THREAD-${msg.threadId}] ✅ Success`));
    } else if (msg.type === "fail") {
      failThreads++;
      console.log(chalk.red(`[THREAD-${msg.threadId}] ❌ Fail`));
    }
  });

  child.on("exit", code => {
    console.log(chalk.gray(`[THREAD-${threadId}] Child process exited with code ${code}`));
    console.log(
      chalk.magenta(
        `=== Progress: ${successThreads} success / ${failThreads} fail / ${config.threads} launched ===`
      )
    );
  });
}

async function main() {
  const proxies = loadProxies();
  const keywords = loadKeywords();
  const cookies = loadAvailableCookies();

  if (keywords.length === 0) {
    console.log(chalk.red("keywords.txt boş, doldurman lazım."));
    return;
  }

  if (cookies.length === 0) {
    console.log(chalk.red("cookies klasörü boş."));
    return;
  }

  if (config.spreadThreads) {
    const interval = Math.floor((config.timeFrameHours * 3600 * 1000) / config.threads);
    console.log(
      chalk.cyan(
        `Scheduler başlıyor → ${config.threads} thread ${config.timeFrameHours} saat içine yayılacak (~${interval / 1000}s arayla)`
      )
    );

    for (let i = 0; i < config.threads; i++) {
      setTimeout(() => {
        const proxy = proxies.length > 0 ? proxies[i % proxies.length] : null;
        const keyword = keywords[i % keywords.length];
        let available = cookies.filter(c => !usedCookies.has(c));
        let cookieFile = available.length > 0 ? getRandomElement(available) : null;
        if (cookieFile) usedCookies.add(cookieFile);
        startThread(i + 1, proxy, keyword, cookieFile);
      }, i * interval);
    }
  } else {
    for (let i = 0; i < config.threads; i++) {
      const proxy = proxies.length > 0 ? proxies[i % proxies.length] : null;
      const keyword = keywords[i % keywords.length];
      let available = cookies.filter(c => !usedCookies.has(c));
      let cookieFile = available.length > 0 ? getRandomElement(available) : null;
      if (cookieFile) usedCookies.add(cookieFile);
      startThread(i + 1, proxy, keyword, cookieFile);
    }
  }
}

main();
