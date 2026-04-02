import { Builder, Browser, By, Key, until, logging } from "selenium-webdriver";
import chrome from 'selenium-webdriver/chrome.js';
import * as fs from 'fs';

const SHOPEE_URL = "https://shopee.co.id/";
const SHOPEE_SEARCH_INPUT_XPATH = "//input[@class='shopee-searchbar-input__input']";
const SHOPEE_PRODUCT_TITLE_XPATH = "//*[@id='main']/div/div[2]/div/div/div/div/div/div[2]/section/ul/li/div/div/div/a[1]/div/div[2]/div[1]/div[1]";
const SHOPEE_PRODUCT_PRICE_XPATH = "//*[@id='main']/div/div[2]/div/div/div/div/div/div[2]/section/ul/li/div/div/div/a[1]/div/div[2]/div[1]/div[2]/div/div/div[1]/div[1]/div/span[2]";
const SHOPEE_PRODUCT_IMAGE_XPATH = "//*[@id='main']/div/div[2]/div/div/div/div/div/div[2]/section/ul/li/div/div/div/a[1]/div/div[1]/div/picture/img";
const SHOPEE_PRODUCT_SALES_XPATH = "//div[@class='truncate text-shopee-black87 text-xs min-h-4']";
const SHOPEE_COOKIES_PATH = 'shopee_cookies.json';
const CHECKPOINT_PATH = 'checkpoint.json';
const PRODUCT_COUNT = 20;
const MAX_RETRIES = 5;

const keyword: string = fs.readFileSync('keyword.txt', 'utf-8');
const keys: string[] = keyword.split(', ').map(k => k.trim()).filter(Boolean);

// ─── Cookie Management ────────────────────────────────────────────────────────

async function saveCookies(driver: any) {
  const cookies = await driver.manage().getCookies();
  fs.writeFileSync(SHOPEE_COOKIES_PATH, JSON.stringify(cookies, null, 2));
  console.log(`Saved ${cookies.length} cookies`);
}

async function loadCookies(driver: any): Promise<boolean> {
  if (!fs.existsSync(SHOPEE_COOKIES_PATH)) return false;
  await driver.get(SHOPEE_URL);

  const raw = fs.readFileSync(SHOPEE_COOKIES_PATH, 'utf-8').trim();
  if (!raw) return false;

  const cookies = JSON.parse(raw);
  if (!Array.isArray(cookies) || cookies.length === 0) return false;

  for (const cookie of cookies) {
    try { await driver.manage().addCookie(cookie); } catch {}
  }
  await driver.navigate().refresh();
  return true;
}

async function isLoggedIn(driver: any): Promise<boolean> {
  try {
    await driver.wait(
      until.elementLocated(By.xpath("//div[contains(@class, 'navbar__username')]")),
      10000
    );
    return true;
  } catch {
    return false;
  }
}

async function waitForVerification(driver: any) {
  const url = await driver.getCurrentUrl();
  if (url.startsWith('https://shopee.co.id/verify/')) {
    console.log('🔒 Captcha/verification detected. Selesaikan dulu, tekan Enter kalau udah...');
    await new Promise(resolve => process.stdin.once('data', resolve));
  }
}

async function ensureAuth(driver: any) {
  await loadCookies(driver);
  if (!await isLoggedIn(driver)) {
    console.log('Session expired. Login manual dulu, tekan Enter kalau udah...');
    await new Promise(resolve => process.stdin.once('data', resolve));
    await waitForVerification(driver);
    await saveCookies(driver);
  }
}

// ─── Checkpoint ───────────────────────────────────────────────────────────────

function loadCheckpoint(): Set<string> {
  if (!fs.existsSync(CHECKPOINT_PATH)) return new Set();
  return new Set(JSON.parse(fs.readFileSync(CHECKPOINT_PATH, 'utf-8')));
}

function markDone(keyword: string) {
  const done = loadCheckpoint();
  done.add(keyword);
  fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify([...done], null, 2));
}

// ─── CSV ──────────────────────────────────────────────────────────────────────

async function processToCsv(
  key: string,
  titleElements: any[],
  imageElements: any[],
  priceElements: any[],
  salesElements: any[]
) {
  const filename = key.trim().replace(/ /g, '-') + '.csv';
  const file = fs.createWriteStream(filename);
  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;

  file.write('title,image,price,sales\n');
  const count = Math.min(PRODUCT_COUNT, titleElements.length, salesElements.length);

  for (let i = 0; i < count; i++) {
    const title = await titleElements[i].getText();
    const image = await imageElements[i].getAttribute('src');
    const price = await priceElements[i].getText();
    const sales = await salesElements[i].getText();
    file.write(`${escape(title)},${escape(image)},${escape(price)},${escape(sales)}\n`);
  }

  file.end();
  console.log(`💾 Saved: ${filename} (${count} products)`);
}

// ─── Per-keyword scraper dengan retry ────────────────────────────────────────

async function scrapeKeyword(driver: any, keyword: string, attempt = 1): Promise<void> {
  try {
    await driver.get(SHOPEE_URL);
    await driver.wait(until.elementLocated(By.xpath(SHOPEE_SEARCH_INPUT_XPATH)), 10000);
    const searchInput = await driver.findElement(By.xpath(SHOPEE_SEARCH_INPUT_XPATH));
    await searchInput.sendKeys(keyword, Key.RETURN);
    await driver.wait(until.elementsLocated(By.xpath(SHOPEE_PRODUCT_TITLE_XPATH)), 15000);

    const [titles, images, prices, sales] = await Promise.all([
      driver.findElements(By.xpath(SHOPEE_PRODUCT_TITLE_XPATH)),
      driver.findElements(By.xpath(SHOPEE_PRODUCT_IMAGE_XPATH)),
      driver.findElements(By.xpath(SHOPEE_PRODUCT_PRICE_XPATH)),
      driver.findElements(By.xpath(SHOPEE_PRODUCT_SALES_XPATH)),
    ]);

    await processToCsv(keyword, titles, images, prices, sales);

  } catch (error) {
    if (attempt >= MAX_RETRIES) {
      console.error(`❌ Failed after ${MAX_RETRIES} attempts: ${keyword}`);
      return;
    }
    console.warn(`⚠️ Retry ${attempt}/${MAX_RETRIES}: ${keyword}`);
    await driver.sleep(3000 * attempt);
    await scrapeKeyword(driver, keyword, attempt + 1);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function buildDriver(){
  const options = new chrome.Options();

  options.addArguments('--disable-blink-features=AutomationControlled');
  options.excludeSwitches('enable-automation');
  options.addArguments('--no-sandbox');
  options.addArguments('--disable-dev-shm-usage');

  const driver = await new Builder()
    .forBrowser(Browser.CHROME)
    .setChromeOptions(options)
    .build();

  await (driver as any).sendAndGetDevToolsCommand('Page.addScriptToEvaluateOnNewDocument', {
    source: `Object.defineProperty(navigator, 'webdriver', { get: () => undefined })`
  });

  return driver;
}

async function main() {
  const driver = await buildDriver();

  try {
    await ensureAuth(driver);

    const done = loadCheckpoint();
    for (const k of keys) {
      if (done.has(k)) {
        console.log(`⏭️ Skip: ${k}`);
        continue;
      }
      console.log(`🔍 Scraping: ${k}`);
      await scrapeKeyword(driver, k);
      markDone(k);
    }

    console.log('✅ All keywords done');
  } finally {
    await driver.quit();
  }
}

main();