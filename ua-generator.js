// UA üretici

function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Android sürümleri
const androidVersions = [
  { version: "14", weight: 0.60, buildLetter: "U" },
  { version: "13", weight: 0.35, buildLetter: "T" },
  { version: "12", weight: 0.05, buildLetter: "S" }
];

// Chrome sürümleri
const chromeVersions = [
  { major: 126, minBuild: 6300, maxBuild: 6400 },
  { major: 125, minBuild: 6200, maxBuild: 6299 },
  { major: 124, minBuild: 6100, maxBuild: 6199 }
];

// Device modelleri
const deviceModels = {
  samsung: ["SM-S928B", "SM-S928U", "SM-S918B", "SM-A546E"],
  xiaomi: ["23049PCD8G", "2201116SG", "23021RAA2Y"],
  google: ["Pixel 8 Pro", "Pixel 8", "Pixel 7 Pro"],
  oneplus: ["CPH2581", "CPH2449", "NE2215"],
  huawei: ["LIO-AL00", "ELS-AN00"]
};

// Marka dağılım
const brandWeights = [
  { brand: "samsung", weight: 0.40 },
  { brand: "xiaomi", weight: 0.25 },
  { brand: "google", weight: 0.15 },
  { brand: "oneplus", weight: 0.12 },
  { brand: "huawei", weight: 0.08 }
];

function getWeightedRandom(items) {
  const totalWeight = items.reduce((acc, item) => acc + item.weight, 0);
  let random = Math.random() * totalWeight;
  for (const item of items) {
    random -= item.weight;
    if (random <= 0) return item;
  }
  return items[0];
}

function generateChromeVersion() {
  const { major, minBuild, maxBuild } = getRandomElement(chromeVersions);
  return `${major}.0.${getRandomInt(minBuild, maxBuild)}.${getRandomInt(100, 250)}`;
}

function generateBuildDate(androidVersion) {
  const baseYear = 2020 + parseInt(androidVersion);
  const month = String(getRandomInt(1, 12)).padStart(2, "0");
  const day = String(getRandomInt(1, 28)).padStart(2, "0");
  return `${baseYear}${month}${day}`;
}

function generateUserAgent() {
  const brand = getWeightedRandom(brandWeights).brand;
  const model = getRandomElement(deviceModels[brand]);
  const android = getWeightedRandom(androidVersions);

  const buildDate = generateBuildDate(android.version);
  const chromeVersion = generateChromeVersion();

  const buildVariants = [
    `${android.buildLetter}Q1A.${buildDate}.001`,
    `${android.buildLetter}KQA.${buildDate}.002`,
    `${android.buildLetter}P1A.${buildDate}.003`,
    `${android.buildLetter}QA.${buildDate}.004`
  ];
  const build = getRandomElement(buildVariants);

  return `Mozilla/5.0 (Linux; Android ${android.version}; ${model} Build/${build}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Mobile Safari/537.36`;
}

// === Export et ===
module.exports = { generateUserAgent };
