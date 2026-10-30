const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sitePages = ['index.html', 'relations.html', 'calculator.html', 'comparisons.html'];
const destinations = ['index.html', 'relations.html', 'calculator.html', 'comparisons.html'];

test('every site page exposes the same primary navigation', () => {
  for (const pageName of sitePages) {
    const html = fs.readFileSync(path.join(__dirname, '..', pageName), 'utf8');
    const navigation = html.match(/<nav class="site-nav"[\s\S]*?<\/nav>/)?.[0];

    assert.ok(navigation, `${pageName} should include the primary navigation`);
    for (const destination of destinations) {
      assert.match(navigation, new RegExp(`href="${destination}"`), `${pageName} should link to ${destination}`);
    }
    assert.match(navigation, /aria-current="page"/, `${pageName} should mark its current page`);
  }
});

test('home page links to all three project tools', () => {
  const home = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(home, /class="home-destination" href="relations\.html"/);
  assert.match(home, /class="home-destination" href="calculator\.html"/);
  assert.match(home, /class="home-destination" href="comparisons\.html"/);
});

test('relation filters are in the page body, not the site header', () => {
  const relations = fs.readFileSync(path.join(__dirname, '..', 'relations.html'), 'utf8');
  const headerEnd = relations.indexOf('</header>');
  const mainStart = relations.indexOf('<main class="relations-main">');
  const controlsStart = relations.indexOf('class="relations-controls-panel"');

  assert.ok(headerEnd >= 0 && mainStart > headerEnd);
  assert.ok(controlsStart > mainStart);
});

test('comparison result panels stay side by side on desktop and mobile', () => {
  const comparisonHtml = fs.readFileSync(path.join(__dirname, '..', 'comparisons.html'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');

  assert.match(comparisonHtml, /id="compared-items" class="comparison-panels"/);
  assert.match(styles, /\.comparison-panels\s*\{[^}]*grid-template-columns:\s*repeat\(2,/s);
  assert.match(styles, /\.comparison-panels\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(18rem,\s*1fr\)\)/s);
});
