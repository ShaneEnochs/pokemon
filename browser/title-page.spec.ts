import { test, expect } from '@playwright/test';
import pokedex from '../content/aurelian-league.pokedex.json' with { type: 'json' };

for (const width of [320, 1280]) test('single responsive title and unchanged startup controls at ' + width + 'px', async ({ page }) => {
  await page.setViewportSize({ width, height: 800 });
  await page.goto('/');
  const heading = page.getByRole('heading');
  await expect(heading).toHaveCount(1);
  await expect(heading).toHaveText('THE AURELIAN LEAGUE');
  await expect(heading).toBeVisible();
  await expect(page.locator('.title-screen .brand')).toHaveCount(0);
  await expect(heading).toHaveCSS('font-family', /Public Sans/);
  const geometry = await heading.evaluate(element => ({
    fontSize: parseFloat(getComputedStyle(element).fontSize),
    width: element.getBoundingClientRect().width, scrollWidth: element.scrollWidth,
  }));
  expect(geometry.fontSize).toBeCloseTo(width === 320 ? 28.8 : 44.8, 1);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('.startup-description')).toHaveText('You are a Pokemon Field Warden for the Aurelian League. To unravel a mystery, you must set out across the beautiful island region of Aurelia, where charming little towns, winding country roads, and unexpected encounters await.');
  await expect(page.getByRole('navigation', { name: 'Game startup' }).getByRole('button')).toHaveText(['New Game']);
  await page.getByRole('button', { name: 'New Game', exact: true }).click();
  await page.getByRole('button', { name: 'Pokédex', exact: true }).click();
  await expect(page.locator('#pokedex summary')).toContainText('#0152');
  await expect(page.locator('#pokedex summary')).toContainText('Chikorita');
  await expect(page.locator('#pokedex details')).toHaveAttribute('open', '');
  await expect(page.locator('#pokedex')).toContainText(pokedex[0]!.description);
  await expect(page.locator('#pokedex dd')).toHaveText(['Grass']);
  await expect(page.getByRole('button', { name: 'Party', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pokemon:checkpoint:aurelian-league')!).currentState.party)).toEqual([]);
  const key = 'pokemon:checkpoint:aurelian-league';
  const raw = await page.evaluate(k => localStorage.getItem(k), key);
  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Game startup' }).getByRole('button')).toHaveText(['Continue Game', 'New Game']);
  await expect(page.getByRole('heading')).toHaveText('THE AURELIAN LEAGUE');
  await page.getByRole('button', { name: 'New Game', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(k => localStorage.getItem(k), key)).toBe(raw);
  await page.getByRole('button', { name: 'Continue Game', exact: true }).click();
  await page.getByRole('button', { name: 'Pokédex', exact: true }).click();
  await expect(page.locator('#pokedex summary')).toContainText('#0152');
  await expect(page.locator('#pokedex summary')).toContainText('Chikorita');
  expect(await page.evaluate(k => localStorage.getItem(k), key)).toBe(raw);
});
