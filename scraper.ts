import { Builder, Browser, By, Key, until } from "selenium-webdriver";

async function scraper() {
  let driver = await new Builder().forBrowser(Browser.CHROME).build();

  try {
    await driver.get("https://www.google.com");
    await driver.findElement(By.name("q")).sendKeys("Selenium", Key.RETURN);
    await driver.wait(until.titleIs("Selenium - Google Search"), 10000);
  } finally {
    await driver.quit();
  }
}

scraper();