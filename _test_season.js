/**
 * Analyze the HTML structure of the TFT season page for upcoming event parsing.
 * Retries on 429 with exponential backoff.
 */
const fs = require('fs');

const USER_AGENT = 'MovistarKOI-FanApp/1.0 (esports; automated; contact@example.dev)';

async function fetchWithRetry(url, maxRetries = 4) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = Math.pow(2, attempt) * 5000; // 10s, 20s, 40s
      console.log(`  Waiting ${delay/1000}s before retry ${attempt+1}...`);
      await new Promise(r => setTimeout(r, delay));
    }
    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      console.log(`  Attempt ${attempt+1}: HTTP ${res.status}`);
      if (res.status === 429) continue;
      return res;
    } catch (e) {
      console.log(`  Attempt ${attempt+1}: Error: ${e.message}`);
    }
  }
  return null;
}

async function main() {
  // ── TFT Season Page ──
  console.log('=== Fetching TFT Lore & Legends season page ===');
  const tftUrl = 'https://liquipedia.net/tft/api.php?action=parse&page=Lore_%26_Legends&prop=text&format=json';
  const tftRes = await fetchWithRetry(tftUrl);
  
  if (!tftRes || !tftRes.ok) {
    console.log('Failed to fetch TFT page');
    return;
  }
  
  const tftData = await tftRes.json();
  const tftHtml = tftData.parse.text['*'];
  fs.writeFileSync('_tft_season.html', tftHtml);
  console.log('Saved TFT season HTML:', tftHtml.length, 'chars');
  
  // Find the EMEA section
  const emeaIdx = tftHtml.indexOf('EMEA_Tournaments');
  console.log('\nEMEA section starts at:', emeaIdx);
  
  // Find Championship section
  const champIdx = tftHtml.indexOf('Championship');
  console.log('Championship section at:', champIdx);
  
  // Find all tournament-card or tournament-row divs
  const divRowMatches = [...tftHtml.matchAll(/class="[^"]*(?:divRow|tournament-card|tournamentCard)[^"]*"/gi)];
  console.log('\ndivRow/card matches:', divRowMatches.length);
  divRowMatches.slice(0, 3).forEach((m, i) => console.log(`  ${i}: "${m[0]}" at ${m.index}`));
  
  // Look for specific tournament grid patterns
  const gridMatches = [...tftHtml.matchAll(/class="[^"]*(?:gridRow|gridCell|tournament-)[^"]*"/gi)];
  console.log('\ngrid matches:', gridMatches.length);
  gridMatches.slice(0, 5).forEach((m, i) => console.log(`  ${i}: "${m[0]}" at ${m.index}`));
  
  // Find all tables in the EMEA section
  let searchFrom = emeaIdx;
  const apacIdx = tftHtml.indexOf('APAC_Tournaments', emeaIdx);
  const emeaSection = tftHtml.substring(emeaIdx, apacIdx > -1 ? apacIdx : emeaIdx + 50000);
  console.log('\nEMEA section length:', emeaSection.length);
  
  // Find all <table> in EMEA section
  const tableMatches = [...emeaSection.matchAll(/<table[^>]*>/gi)];
  console.log('Tables in EMEA section:', tableMatches.length);
  tableMatches.forEach((m, i) => {
    console.log(`  Table ${i} at offset ${m.index}: ${m[0].substring(0, 100)}`);
  });
  
  // Find what kind of elements contain tournament info
  // Look for links to tournament pages
  const tournamentLinks = [...emeaSection.matchAll(/href="\/tft\/Lore[^"]*"[^>]*>([^<]+)/gi)];
  console.log('\nTournament links in EMEA:', tournamentLinks.length);
  tournamentLinks.forEach((m, i) => console.log(`  ${i}: ${m[1]}`));
  
  // Look for date patterns
  const dates = [...emeaSection.matchAll(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}[^<]{0,30}\d{4}/gi)];
  console.log('\nDates in EMEA:', dates.length);
  dates.forEach((m, i) => console.log(`  ${i}: "${m[0]}"`));
  
  // Look for "TBD" markers (indicates upcoming/not yet played)
  const tbdMatches = [...emeaSection.matchAll(/TBD/gi)];
  console.log('\nTBD markers:', tbdMatches.length);
  
  // Show first tournament entry HTML (first 2000 chars after EMEA heading)
  const firstEntryStart = emeaSection.indexOf('<div');
  if (firstEntryStart > -1) {
    console.log('\n=== First 3000 chars of EMEA section HTML ===');
    console.log(emeaSection.substring(0, 3000));
  }
}

main().catch(console.error);
