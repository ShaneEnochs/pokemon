import { expect, test } from '@playwright/test';
import { choose, startGame, openPanel, returnToStory, panelNames, expectPassage } from './helpers';

for (const width of [320, 375, 768, 1280]) {
  test('exclusive views preserve drafts, errors, state and storage at ' + width + 'px', async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await startGame(page);
    await expect(page.getByRole('navigation', { name: 'Reading views' }).getByRole('button')).toHaveText(['Story', ...panelNames]);
    await expect(page.getByRole('button', { name: 'Story', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await choose(page, 'Enter a different name in the public record');
    const field = page.locator('#player-text');
    await field.fill('   ');
    await field.press('Enter');
    const message = await page.getByRole('alert').textContent();
    await field.fill('Unfinished Éléonore');
    const node = await field.elementHandle();
    await page.evaluate(() => {
      const calls: string[] = [];
      Object.defineProperty(window, '__viewStorageCalls', { value: calls });
      for (const method of ['getItem', 'setItem', 'removeItem'] as const) {
        const original = Storage.prototype[method];
        Object.defineProperty(Storage.prototype, method, { value: function (...args: string[]) {
          calls.push(method);
          return Reflect.apply(original, this, args);
        }});
      }
    });
    for (const name of panelNames) {
      const section = await openPanel(page, name);
      await expect(section.getByRole('heading', { name, exact: true })).toBeFocused();
      await expect(page.locator('main > section[aria-labelledby]:visible')).toHaveCount(1);
      await expect(page.getByRole('textbox')).toHaveCount(0);
      await expect(page.getByRole('navigation', { name: 'Passage actions' })).toHaveCount(0);
      await expect(field).toHaveValue('Unfinished Éléonore');
      await expect(field).toHaveAttribute('aria-invalid', 'true');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await page.getByRole('button', { name: 'Story', exact: true }).click();
      await expectPassage(page, 'The Public Record');
      await expect(page.getByRole('alert')).toHaveText(message!);
      expect(await node!.evaluate(element => element === document.querySelector('#player-text'))).toBe(true);
    }
    expect(await page.evaluate(() => Reflect.get(window, '__viewStorageCalls'))).toEqual([]);
    await field.press('Enter');
    await expectPassage(page, 'What You Bring');
    await expect(page.getByText('Your writ says Unfinished Éléonore. It does not say why anyone here should trust you. Before the commission, you made a living in one of two worlds.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Story', exact: true })).toHaveAttribute('aria-pressed', 'true');
  });
}

test('reading layout remains usable at 200 percent text zoom without motion', async ({ page }) => {
  await startGame(page);
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  for (const name of panelNames) {
    await openPanel(page, name);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  await returnToStory(page);
  const motion = await page.locator('button').first().evaluate(element => ({ transition: getComputedStyle(element).transitionDuration, animation: getComputedStyle(element).animationName }));
  expect(motion).toEqual({ transition: '0s', animation: 'none' });
});
