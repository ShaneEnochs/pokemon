import { test, expect } from '@playwright/test';
const source = `*pokemon partner "Piplup"
*passage start
*title Start
Piplup is only a name so far.
*continue meet
*passage meet
*title Meeting
*journal seen "You encountered Piplup."
You see your future companion.
*choice
#Look again -> meet
#Partner -> partner
*passage partner
*title Partnership
*add_pokemon partner
*journal acquired "Piplup joined your party."
Your new partner is here.
*continue camp
*passage camp
*title Camp
*checkpoint
You pause together.
*continue gone
*passage gone
*title Recovery
*remove_pokemon partner
The private recovery fixture ends.
*death`;
const metadata = [{ id: 'piplup', name: 'Piplup', description: 'A traveling companion.', discoveryEvents: ['seen'], acquisitionEvents: ['acquired'] }];
test('authored encounters/acquisitions deduplicate, survive recovery and stay isolated from public saves', async ({ page }) => {
  await page.goto('/author.html');
  await page.evaluate(() => localStorage.setItem('pokemon:checkpoint:aurelian-league', 'untouched public save'));
  const file = page.getByLabel('Open optional .pokedex.json file', { exact: true });
  await file.setInputFiles({ name: 'draft.pokedex.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(metadata)) });
  await page.getByLabel('Open a .story file', { exact: true }).setInputFiles({ name: 'draft.story', mimeType: 'text/plain', buffer: Buffer.from(source) });
  await page.getByRole('button', { name: 'New Game', exact: true }).click();
  const showDex = async () => { await page.getByRole('button', { name: 'Pokédex', exact: true }).click(); };
  const story = async () => { await page.getByRole('button', { name: 'Story', exact: true }).click(); };
  const proceed = async () => { await page.getByRole('button', { name: 'Continue', exact: true }).click(); };
  await showDex(); await expect(page.locator('#pokedex li')).toHaveCount(0); await story(); await proceed();
  await showDex(); await expect(page.locator('#pokedex details')).toHaveAttribute('open', ''); await expect(page.locator('#pokedex img')).toHaveCount(0); await expect(page.locator('#pokedex .discovery-status')).toHaveText(['Encountered · Prologue']);
  await story(); await page.getByRole('radio', { name: 'Look again', exact: true }).check(); await proceed();
  await showDex(); await expect(page.locator('#pokedex li')).toHaveCount(1); await story();
  await page.getByRole('radio', { name: 'Partner', exact: true }).check(); await proceed(); await proceed(); await proceed();
  await expect(page.getByRole('button', { name: 'Party', exact: true })).toHaveCount(0);
  await showDex(); await expect(page.locator('#pokedex details')).toHaveAttribute('open', ''); await expect(page.locator('#pokedex .discovery-status')).toHaveText(['Acquired · Prologue']);
  await story(); await page.getByRole('button', { name: 'Try Again', exact: true }).click();
  await showDex(); await expect(page.locator('#pokedex details')).toHaveAttribute('open', ''); await expect(page.locator('#pokedex .discovery-status')).toHaveText(['Acquired · Prologue']);
  expect(await page.evaluate(() => localStorage.getItem('pokemon:checkpoint:aurelian-league'))).toBe('untouched public save');
  await page.getByRole('button', { name: 'Restart preview', exact: true }).click(); await page.getByRole('button', { name: 'New Game', exact: true }).click();
  await showDex(); await expect(page.locator('#pokedex li')).toHaveCount(0);
  await file.setInputFiles({ name: 'bad.pokedex.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify([{ ...metadata[0], discoveryEvents: ['missing'] }])) });
  await expect(page.getByRole('status')).toContainText('unknown journal event'); await expect(page.locator('#app')).toBeEmpty();
  await page.getByRole('button', { name: 'Clear Pokédex file', exact: true }).click(); await page.getByRole('button', { name: 'New Game', exact: true }).click();
  await showDex(); await expect(page.locator('#pokedex li')).toHaveCount(0);
});
test('the public chapter preview shares ordered sources and metadata without accessing public saves',async({page})=>{
 await page.goto('/author.html');await page.evaluate(()=>localStorage.setItem('pokemon:checkpoint:aurelian-league','unchanged'));
 await page.getByRole('button',{name:'Preview public chapter files',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Loaded 2 public chapter files: 7 passages');
 await page.getByRole('button',{name:'New Game',exact:true}).click();
 await expect(page.locator('#passage-heading')).toHaveText('A Simple Assignment');
 await page.getByLabel('Find passage by ID or title').fill('capture_attempt');
 await expect(page.getByRole('list',{name:'Passage index'}).getByRole('button')).toHaveText(['capture_attempt: A Different Approach']);
 await page.getByRole('button',{name:'Pokédex',exact:true}).click();
 await expect(page.locator('#pokedex summary')).toContainText('#0152');
 await expect(page.locator('#pokedex summary')).toContainText('Chikorita');
 await expect(page.getByRole('navigation',{name:'Reading views'}).getByRole('button')).toHaveText(['Story','Inventory','Pokédex']);
 await expect(page.getByRole('button',{name:'People',exact:true})).toHaveCount(0);
 expect(await page.evaluate(()=>localStorage.getItem('pokemon:checkpoint:aurelian-league'))).toBe('unchanged');
});
