import {test,expect} from '@playwright/test';
const source=`*var visible true
*passage start
*title Scanning
*journal scanned_chikorita "Scan one."
*journal scanned_piplup "Scan two."
First page.

*page_break
Before card.

*if visible
  *pokedex chikorita

Between cards.

*pokedex piplup

After cards.
*continue end
*passage end
*title End
Done.
*death`;
const metadata=[{id:'chikorita',name:'Chikorita',description:'Grass companion.',discoveryEvents:['scanned_chikorita']},{id:'piplup',name:'Piplup',description:'Water companion.',discoveryEvents:['scanned_piplup']}];
for(const width of [320,1280]) test('inline cards preserve order, pages and state at '+width,async({page})=>{
 await page.setViewportSize({width,height:800});await page.goto('/author.html');
 await page.getByLabel('Open optional .pokedex.json file',{exact:true}).setInputFiles({name:'scan.pokedex.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(metadata))});
 await page.getByLabel('Open a .story file',{exact:true}).setInputFiles({name:'scan.story',mimeType:'text/plain',buffer:Buffer.from(source)});
 await page.getByRole('button',{name:'New Game',exact:true}).click();
 await expect(page.locator('.pokedex-card')).toHaveCount(0);
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await expect(page.locator('.pokedex-card')).toHaveCount(2);
 await expect(page.locator('#story-content > p, #story-content > aside')).toHaveText(['Before card.',/Pokédex · Chikorita.*Grass companion\./s,'Between cards.',/Pokédex · Piplup.*Water companion\./s,'After cards.']);
 await page.getByRole('button',{name:'Inventory',exact:true}).click();await page.getByRole('button',{name:'Story',exact:true}).click();
 await expect(page.locator('.pokedex-card')).toHaveCount(2);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('button',{name:'Try Again',exact:true}).click();
 await expect(page.locator('.pokedex-card')).toHaveCount(0);
 await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.locator('.pokedex-card')).toHaveCount(2);
});
test('preview reports unknown species before play',async({page})=>{
 await page.goto('/author.html');
 await page.getByLabel('Open a .story file',{exact:true}).setInputFiles({name:'scan.story',mimeType:'text/plain',buffer:Buffer.from(source)});
 await expect(page.getByRole('status')).toContainText('unknown species');await expect(page.locator('#app')).toBeEmpty();
});
