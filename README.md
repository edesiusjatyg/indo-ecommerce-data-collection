# 🕷️ Indonesian Online Store Intelligence

A CLI-based product intelligence scraper for Indonesian e-commerce platforms. Feed it keywords, get back ranked product data — sales volume, pricing, ratings — across Shopee and Tokopedia. Built for reseller product research and demand validation workflows.

---

## Architecture Overview

```
keyword.txt
    │
    ▼
┌─────────────────────────────────────────────────────┐
│                      main()                         │
│  ┌─────────────┐    ┌───────────────────────────┐  │
│  │ ensureAuth  │    │     Checkpoint Manager     │  │
│  │  (Puppeteer │    │  checkpoint.json (Set<str>)│  │
│  │   + stealth)│    └───────────────────────────┘  │
│  └─────────────┘                │                   │
│        │              for each unprocessed keyword  │
│        ▼                        ▼                   │
│  ┌──────────────────────────────────────────────┐  │
│  │           scrapeKeyword(page, k)             │  │
│  │   retry loop (MAX_RETRIES, exp. backoff)     │  │
│  └──────────────────────────────────────────────┘  │
│                        │                            │
│                        ▼                            │
│              processToCsv(keyword, products)        │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
              {keyword}.csv  ×  N keywords
```

---

## Features

- **Multi-keyword batch scraping** from `keyword.txt`
- **Crash-resilient** — checkpoint system persists completed keywords; resumes from last successful state on restart
- **Per-keyword retry with exponential backoff** — configurable `MAX_RETRIES`
- **Anti-detection** via `puppeteer-extra-plugin-stealth` — bypasses `navigator.webdriver` flag and CDP fingerprint signatures
- **Session persistence** — cookies serialized to JSON, reloaded on next run; prompts for manual re-login on expiry
- **Captcha/verification gate** — detects `shopee.co.id/verify/` redirect and pauses for manual resolution
- **CSV output** per keyword with RFC 4180-compliant escaping

---

## Platform Coverage

| Platform   | Sales Metric          | Method              |
|------------|-----------------------|---------------------|
| Shopee     | Monthly sales¹        | Puppeteer + Stealth |
| Tokopedia  | All-time sold         | Puppeteer + Stealth |
| Alibaba    | TBD                   | Planned             |

> ¹ Monthly sales exposed by Shopee when products are sorted by "Terlaris"

---

## Prerequisites

- Node.js ≥ 18
- Google Chrome installed
- TypeScript (`ts-node` or `tsx`)

---

## Installation

```bash
git clone https://github.com/yourname/olshop-scraper
cd olshop-scraper
npm install
```

**Dependencies:**

```bash
npm install puppeteer puppeteer-extra puppeteer-extra-plugin-stealth
npm install -D typescript @types/node tsx
```

---

## Configuration

**`keyword.txt`** — comma-separated product keywords:

```
alat pijat, cuci mobil rumahan, mobil rc, standing fan, rice cooker mini
```

**Constants in `scraper.ts`:**

```typescript
const PRODUCT_COUNT = 20;       // products to scrape per keyword
const MAX_RETRIES   = 5;        // max retry attempts per keyword
const SHOPEE_URL    = "https://shopee.co.id/";
```

**Chrome executable path** — update `executablePath` in `buildDriver()` to match your system:

```typescript
// Linux
executablePath: '/usr/bin/google-chrome'

// macOS
executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

// Windows
executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
```

---

## Usage

```bash
npx tsx scraper.ts
```

**First run (no saved session):**

1. Chrome opens and navigates to Shopee
2. CLI prompts: `Login manual dulu, tekan Enter kalau udah...`
3. Log in manually in the browser window
4. If Shopee redirects to `/verify/` (captcha), solve it, then press Enter
5. Session cookies are saved to `shopee_cookies.json`
6. Scraping begins

**Subsequent runs:**

Cookies are loaded automatically. If the session has expired, the login prompt reappears.

---

## Output

One CSV file per keyword: `{keyword}.csv`

```
title,image,price,sales
"Alat Pijat Elektrik Portable","https://...","Rp 149.000","1,2rb terjual"
"Mini Massage Gun","https://...","Rp 89.000","876 terjual"
...
```

All fields are double-quote escaped per RFC 4180.

---

## Persistent State Files

| File                   | Purpose                                      |
|------------------------|----------------------------------------------|
| `shopee_cookies.json`  | Serialized Shopee session cookies            |
| `checkpoint.json`      | Set of completed keywords (resume on crash)  |

> To do a full re-scrape, delete `checkpoint.json`. To force re-login, delete `shopee_cookies.json`.

---

## Retry & Fault Tolerance

```
scrapeKeyword(page, keyword, attempt=1)
    │
    ├─ success → processToCsv → markDone → next keyword
    │
    └─ error
         ├─ attempt < MAX_RETRIES → sleep(3000 * attempt) → retry
         └─ attempt >= MAX_RETRIES → log failure → skip keyword
```

Backoff schedule (default `MAX_RETRIES = 5`):

| Attempt | Wait   |
|---------|--------|
| 1 → 2   | 3s     |
| 2 → 3   | 6s     |
| 3 → 4   | 9s     |
| 4 → 5   | 12s    |

---

## Anti-Detection Stack

Shopee uses multiple bot-detection signals. This project mitigates them via:

- **`puppeteer-extra-plugin-stealth`** — patches ~20 browser fingerprint signals including `navigator.webdriver`, WebGL vendor, plugin enumeration, and iframe content window
- **Headed mode** (`headless: false`) — avoids headless-specific fingerprint differences
- **Human-in-the-loop captcha handling** — no automated captcha solving; user resolves manually

> Note: Shopee periodically updates its anti-bot mechanisms. If detection resumes, inspect Network tab for new fingerprint endpoints and update stealth config accordingly.

---

## Roadmap

- [ ] Tokopedia scraper module
- [ ] Alibaba supplier price lookup
- [ ] Sort by "Terlaris" automation (Shopee monthly sales trigger)
- [ ] Quick visualizer script for CSV output (bar chart: sales × product)
- [ ] Proxy rotation support
- [ ] Headless mode with stealth tuning

---

## Disclaimer

This tool is built for personal product research. Scraping may violate platform Terms of Service. Use responsibly and rate-limit your requests.
