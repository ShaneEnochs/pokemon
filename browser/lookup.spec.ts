import { test, expect } from '@playwright/test';

for (const width of [320,1280]) test('the public encounter remains recorded without producing scan cards at ' + width + 'px', async ({ page }) => {
  await page.setViewportSize({width,height:850});
  await page.goto('/');
  await page.getByRole('button',{name:'New Game',exact:true}).click();
  const key='pokemon:checkpoint:aurelian-league';
  const saved=await page.evaluate(k=>localStorage.getItem(k),key);
  await page.getByRole('button',{name:'Pokédex',exact:true}).click();
  await expect(page.locator('#pokedex summary')).toContainText('#0152');
  await expect(page.locator('#pokedex summary')).toContainText('Chikorita');
  await expect(page.locator('#pokedex summary')).toHaveCount(1);
  await expect(page.locator('.pokedex-card')).toHaveCount(0);
  await page.getByRole('button',{name:'Story',exact:true}).click();
  await page.getByRole('radio',{name:'Give Cassius some encouragement.',exact:true}).check();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('button',{name:'Pokédex',exact:true}).click();
  await expect(page.locator('#pokedex summary')).toHaveCount(1);
  expect(await page.evaluate(k=>localStorage.getItem(k),key)).not.toBe(saved);
  await page.reload();
  await page.getByRole('button',{name:'Continue Game',exact:true}).click();
  await page.getByRole('button',{name:'Pokédex',exact:true}).click();
  await expect(page.locator('#pokedex summary')).toContainText('#0152');
  await expect(page.locator('#pokedex summary')).toContainText('Chikorita');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
