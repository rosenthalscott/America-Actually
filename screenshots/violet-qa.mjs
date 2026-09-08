import { chromium } from "playwright";
import { mkdirSync } from "fs";
mkdirSync("/workspace/screenshots", { recursive: true });
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push("page:" + e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push("console:" + m.text());
});
await page.goto("http://127.0.0.1:8080/?y=2024&g=counties&m=blend", { waitUntil: "networkidle", timeout: 45000 });
await page.waitForSelector("svg path.map-region", { timeout: 30000 });
const pathCount = await page.locator("svg path.map-region").count();
console.log("county paths", pathCount);
await page.waitForTimeout(800);
await page.screenshot({ path: "/workspace/screenshots/qa-blend.png" });

// click a path near center of the map svg
const svg = page.locator("svg[aria-label='Election map']");
const box = await svg.boundingBox();
if (box) {
  await page.mouse.click(box.x + box.width * 0.62, box.y + box.height * 0.42);
  await page.waitForTimeout(500);
}
const aside = await page.locator("aside").innerText();
console.log("inspector after click:\n", aside.slice(0, 400));
await page.screenshot({ path: "/workspace/screenshots/qa-select.png" });

await page.getByRole("radio", { name: "Winner" }).click();
await page.waitForTimeout(700);
await page.screenshot({ path: "/workspace/screenshots/qa-winner.png" });

await page.getByRole("tab", { name: "2020" }).click();
await page.waitForTimeout(1200);
await page.screenshot({ path: "/workspace/screenshots/qa-2020.png" });

await page.getByRole("button", { name: "Sample city" }).click();
await page.waitForSelector("svg path.map-region", { timeout: 15000 });
await page.waitForTimeout(600);
const cityPaths = await page.locator("svg path.map-region").count();
console.log("city paths", cityPaths);
await page.screenshot({ path: "/workspace/screenshots/qa-city.png" });

await page.getByRole("button", { name: "Plug in" }).click();
await page.waitForTimeout(400);
const dialog = await page.getByRole("dialog").innerText();
console.log("dialog:\n", dialog.slice(0, 300));
await page.screenshot({ path: "/workspace/screenshots/qa-plugin.png" });

console.log("ERRORS", JSON.stringify(errors, null, 2));
await browser.close();
