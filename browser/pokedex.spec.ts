import { test, expect } from '@playwright/test';
for (const width of [320,375,768,1280]) test('public views remain inert and readable at '+width+'px', async ({page}) => {
  await page.setViewportSize({width,height:800});
  await page.goto('/');
  await page.getByRole('button',{name:'New Game',exact:true}).click();
  const key='pokemon:checkpoint:aurelian-league';
  const original=await page.evaluate(k=>localStorage.getItem(k),key);
  const tabs=page.getByRole('navigation',{name:'Reading views'}).getByRole('button');
  await expect(tabs).toHaveText(['Story','Inventory','Pokédex']);
  const geometry=await tabs.evaluateAll(buttons=>buttons.map(button=>({y:button.getBoundingClientRect().y,width:button.getBoundingClientRect().width,height:button.getBoundingClientRect().height})));
  for(const box of geometry){expect(box.width).toBeCloseTo(geometry[0]!.width, 0);expect(box.y).toBe(geometry[0]!.y);expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);}
  await page.getByRole('radio',{name:'Remain quiet and watch.',exact:true}).check();
  for(const name of ['Inventory','Pokédex']){
    await page.getByRole('button',{name,exact:true}).click();
    await expect(page.locator('.chapter-label')).toBeHidden();
    if(name==='Inventory'){
      await expect(page.locator('#inventory').getByRole('listitem')).toHaveText([
        'Canvas shoulder bag × 1', 'Protective gloves × 1', 'Approved Pokémon treats (packet) × 1',
        'First-aid kit × 1', 'Handheld identification scanner × 1', 'Collection net × 1', 'Collapsible carrier × 1',
      ]);
      for(const hidden of ['Character','Party','Stats','Skills','Journal','People']) await expect(page.getByRole('button',{name:hidden,exact:true})).toHaveCount(0);
    }
    if(name==='Pokédex') {
      await expect(page.locator('#pokedex .pokedex-intro')).toContainText('A field guide to the Pokémon');
      await expect(page.locator('#pokedex .pokedex-count')).toHaveText('1 species discovered');
      await expect(page.locator('#pokedex summary')).toContainText('#0152');
      await expect(page.locator('#pokedex summary')).toContainText('Chikorita');
      await expect(page.locator('#pokedex summary .pokedex-type')).toHaveText('Grass');
      await expect(page.locator('#pokedex details')).toHaveAttribute('open', '');
      await expect(page.locator('#pokedex dd')).toHaveText(['Grass']);
      await expect(page.locator('#pokedex .discovery-status')).toHaveText('Encountered · Chapter 1: A Simple Assignment');
      await expect(page.locator('#pokedex .pokemon-encounter-location')).toHaveText('Countryside outside Lezano');
      await expect(page.locator('#pokedex .pokemon-about')).toContainText('Chikorita is a gentle Grass-type Pokémon');
      await expect(page.getByRole('button', { name: 'Return to Story', exact: true })).toHaveCount(0);
    }
    expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBe(original);
  }
  await page.getByRole('button',{name:'Story',exact:true}).click();
  await expect(page.locator('.chapter-label')).toHaveText('Chapter 1: A Simple Assignment');
  await expect(page.getByRole('radio',{name:'Remain quiet and watch.',exact:true})).toBeChecked();
  expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBe(original);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
