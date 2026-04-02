import { Builder, Browser, By, Key, until } from "selenium-webdriver";
import * as fs from 'fs';

const SHOPEE_SEARCH_INPUT_XPATH = "//input[@class='shopee-searchbar-input__input']";
const SHOPEE_PRODUCT_TITLE_XPATH = "//*[@id='main']/div/div[2]/div/div/div/div/div/div[2]/section/ul/li/div/div/div/a[1]/div/div[2]/div[1]/div[1]";
const SHOPEE_PRODUCT_PRICE_XPATH = "//*[@id='main']/div/div[2]/div/div/div/div/div/div[2]/section/ul/li/div/div/div/a[1]/div/div[2]/div[1]/div[2]/div/div/div[1]/div[1]/div/span[2]";
const SHOPEE_PRODUCT_IMAGE_XPATH = "//*[@id='main']/div/div[2]/div/div/div/div/div/div[2]/section/ul/li/div/div/div/a[1]/div/div[1]/div/picture/img";
const SHOPEE_PRODUCT_SALES_XPATH = "//div[@class='truncate text-shopee-black87 text-xs min-h-4']";
const keywords: string = fs.readFileSync('keyword.txt', 'utf-8');
console.log(keywords);

async function scraper() {
  let driver = await new Builder()
    .forBrowser(Browser.CHROME)
    .build();

  try {
    await driver.get("https://shopee.co.id/");
    await driver.findElement(By.xpath("//input[@class='shopee-searchbar-input__input']")).sendKeys("Selenium", Key.RETURN);
    await driver.wait(until.elementIsVisible);
  } catch (error: unknown) {
    await driver.get("https://shopee.co.id/");
  } finally {
    await driver.quit();
  }
}

scraper();