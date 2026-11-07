import { test, expect } from '@playwright/test';

for (const width of [320, 375, 768, 1280]) test('local Chikorita artwork keeps its proportions at ' + width, async ({ page }) => {
  await page.setViewportSize({ width, height: 800 });
  await page.goto('/');
  await page.getByRole('button', { name: 'New Game', exact: true }).click();
  await page.getByRole('button', { name: 'Pokédex', exact: true }).click();
  await page.locator('#pokedex summary').click();
  const image = page.getByRole('img', { name: 'Chikorita artwork', exact: true });
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  const size = await image.evaluate((image: HTMLImageElement) => ({
    width: image.width, height: image.height, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight,
    rendering: getComputedStyle(image).imageRendering, source: image.src,
  }));
  expect(size.width / size.height).toBeCloseTo(size.naturalWidth / size.naturalHeight, 1);
  expect(size.width).toBeLessThanOrEqual(256);
  if (width >= 768) expect(size.width).toBeCloseTo(256, 0);
  expect(size.rendering).toBe('auto');
  expect(new URL(size.source).origin).toBe(new URL(page.url()).origin);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('a failed local image leaves all species information usable', async ({ page }) => {
  await page.route('**/*.png', route => route.abort());
  await page.goto('/');
  await page.getByRole('button', { name: 'New Game', exact: true }).click();
  await page.getByRole('button', { name: 'Pokédex', exact: true }).click();
  await page.locator('#pokedex summary').click();
  await expect(page.locator('#pokedex img')).toHaveCount(0);
  await expect(page.locator('#pokedex summary')).toHaveText('#0152 Chikorita');
  await expect(page.locator('#pokedex dd')).toHaveText(['Grass']);
  await expect(page.locator('#pokedex')).toContainText('Chikorita is a gentle Grass-type Pokémon');
});
