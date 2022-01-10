const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs");
const { createObjectCsvWriter } = require("csv-writer");
require("dotenv").config();
var sample = require("./scrape1.js");

const searchkey = [];
sample.result1.forEach((s) => {
  searchkey.push(s.join(""));
});

const OUTPUT_PATH = "outfile";

const USER_NAME = process.env.ENV_USER_NAME;
const USER_PASS = process.env.ENV_USER_PASS;

const LOGIN_USER = process.env.ENV_LOGIN_USER;
const LOGIN_PASS = process.env.ENV_LOGIN_PASS;
const LOGIN_URL = process.env.ENV_LOGIN_URL;
const LOGIN_SELECTOR = "#login > div.person > div.loginbtn > a";
const LOGIN_USER_SELECTOR = "input[name='login_id']";
const LOGIN_PASS_SELECTOR = "input[name='pass']";
const LOGIN_SUBMIT_SELECTOR = "input[type='submit']";
const SEARCH_SELECTOR = "input[name='key']";
const SEARCH_BUTTON = "input[id='key_send']";

async function sleep(delay) {
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * メイン処理です。
 */
puppeteer.use(StealthPlugin());
(async () => {
  const browser = await puppeteer.launch({
    ignoreDefaultArgs: ["--disable-extensions"],
    args: ["--proxy-server=zproxy.lum-superproxy.io:22225", "--no-sandbox"],
  });
  const page = await browser.newPage();
  await page.authenticate({
    username: USER_NAME,
    password: USER_PASS,
  });
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", () => {});
    delete navigator.__proto__.webdriver;
  });
  console.log("OK");

  try {
    await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded" });
    await Promise.all([
      // ログインボタンクリック
      // クリック後ページ遷移後通信が完了するまで待つ (ページによっては 'domcontentloaded' 等でも可)
      page.waitForNavigation({ waitUntil: "networkidle0" }),
      page.click(LOGIN_SELECTOR),
    ]);
    const title = await page.mainFrame().title();
    console.log(title);
    await page.type(LOGIN_USER_SELECTOR, LOGIN_USER, { delay: 100 }); // ユーザー名入力
    await page.type(LOGIN_PASS_SELECTOR, LOGIN_PASS, { delay: 100 }); // パスワード入力
    await Promise.all([
      // ログインボタンクリック
      // クリック後ページ遷移後通信が完了するまで待つ (ページによっては 'domcontentloaded' 等でも可)
      page.waitForNavigation({ waitUntil: "networkidle0" }),
      page.click(LOGIN_SUBMIT_SELECTOR),
    ]);

    console.log("login success!");

    //繰り返し
    let data = [];

    await page.screenshot({ path: "example.png" });
    console.log("screenshot ok");

    let number = 1;

    for (let i = 0; i < searchkey.length; ++i) {
      await page.type(SEARCH_SELECTOR, searchkey[i], { delay: 100 }); // キー入力
      await page.click(SEARCH_BUTTON);
      await sleep(5000);

      const xpath = '//*[@id="counter"]';
      await page.waitForXPath(xpath);
      const elems = await page.$x(xpath);
      const jsHandle = await elems[0].getProperty("textContent");
      const text = await jsHandle.jsonValue();
      console.log(text + "件");
      // textにxpathで指定した要素の文字列が入る

      if (text !== "0") {
        const xpath1 = '//*[@id="select_table"]/tr/td';
        await page.waitForXPath(xpath1);
        const elems1 = await page.$x(xpath1);
        for (let e = 0; e < elems1.length; ++e) {
          const jsHandle1 = await elems1[e].getProperty("textContent");
          const text1 = await jsHandle1.jsonValue();
          text1.replace(/\s+/g, "");
          data.push({ id: number, search: searchkey[i], name: text1 });
          console.log(number + "番作成中" + searchkey[i]);
          console.log(text1);
          number++;
        }
      }

      await sleep(2000);

      await page.$eval(SEARCH_SELECTOR, (element) => (element.value = ""));
    }

    await csvWrite(data);
  } catch (err) {
    // エラーが起きた際の処理
    console.log(err);
  } finally {
    await browser.close();
  }
})();

/**
 * 渡したデータをcsvに出力するメソッド。ページ数を渡すことで、ページごとに区別してcsvを出力できる。
 * @param {Object.<string, string>} data csvに書き込まれるデータ。csvのヘッダと対応するkeyと、実際に書き込まれるvalueを持ったobjectになっている。
 *
 */
async function csvWrite(data) {
  if (!fs.existsSync(OUTPUT_PATH)) {
    fs.mkdirSync(OUTPUT_PATH);
  }
  var exec = require("child_process").exec;
  exec(`touch ${OUTPUT_PATH}/page.csv`, function (err, stdout, stderr) {
    if (err) {
      console.log(err);
    }
  });
  const csvfilepath = `${OUTPUT_PATH}/page.csv`;
  const csvWriter = createObjectCsvWriter({
    path: csvfilepath,
    header: [
      { id: "id", title: "No." },
      { id: "search", title: "検索名" },
      { id: "name", title: "検索結果" },
    ],
    encoding: "utf8",
    append: false,
  });
  csvWriter.writeRecords(data).then(() => {
    console.log("...Done");
  });
}
