require("dotenv").config();

const { chromium } = require("playwright");
const { exec } = require("child_process");
const { clearInterval } = require("timers");

const NUM_GUESTS = 3;

const main = async () => {
  const doSetup = async () => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    return page;
  };

  const openHotelSearch = async () => {
    // The actual interesting bit
    // await context.route("**.jpg", (route) => route.abort());
    await page.goto(
      "https://book.passkey.com/entry?token=" + process.env.PASSKEY_TOKEN
    );

    await page.locator("#editButton0").click();
    await page.locator("#message-info-yes").click();

    await page.locator("#goToHotel").click();
    await page.locator("#message-info-yes").click();

    await page
      .getByLabel("Guests per room", { exact: true })
      .fill(NUM_GUESTS.toString());

    await page.getByRole("button", { name: /search/i }).click();

    await page
      .getByRole("combobox", { name: "Sort by" })
      .selectOption("ascDistance");

    try {
      await page.waitForLoadState("domcontentloaded", { timeout: 60 * 1000 });
    } catch (e) {
      console.error(e);
      postSetupLoop();
    }

    const pageTitle = await page.title();

    return pageTitle === "Browse hotels" ? page : und;
  };

  const refreshAndCheckHotels = async () => {
    console.log(`Searching for hotels at ${new Date().toLocaleString()}`);

    try {
      await page.getByRole("button", { name: /search/i }).click();
    } catch {
      console.error(e);
      postSetupLoop();
      return;
    }

    try {
      await page.waitForLoadState("domcontentloaded", { timeout: 60 * 1000 });
    } catch (e) {
      console.error(e);
      postSetupLoop();
    }

    const hotelItems = await page.locator(".hotel-item").all();

    const hotelItemsInfo = await Promise.all(
      hotelItems.map(
        async (hotelItem) =>
          await Promise.all([
            hotelItem.locator(".name").innerText(),
            hotelItem
              .locator(
                "[id^='hotel-distance'] > p:first-child > span:first-child"
              )
              .innerText(),
            hotelItem.locator("[id^='hotel-distance']").innerText(),
            hotelItem.locator(".price > span").last().innerText(),
          ]).then(([hotelName, distance, distanceText, price]) => ({
            hotelName,
            distance,
            distanceText,
            price,
          }))
      )
    );

    console.table(hotelItemsInfo.sort(), [
      "hotelName",
      "distanceText",
      "price",
    ]);
    console.log("\n\r");

    for (const [idx, info] of Object.entries(hotelItemsInfo)) {
      const cleanedDistanceText = info.distanceText
        .replace(/[\r\n]/g, "")
        .replace(/\s\s+/g, " ")
        .trim()
        .toLowerCase();

      if (cleanedDistanceText.includes("skywalk")) {
        await hotelItems[idx].locator(".hotel-button-block a").click();
        exec("open -a chromium");
        break;
      }
    }
  };

  const page = await doSetup();

  let intervalId;

  async function postSetupLoop() {
    if (intervalId) clearInterval(intervalId);

    await openHotelSearch();

    refreshAndCheckHotels();
    intervalId = setInterval(refreshAndCheckHotels, 1000 * 45);
  }

  postSetupLoop();
};

try {
  main();
} catch (err) {
  console.error(err);
}
