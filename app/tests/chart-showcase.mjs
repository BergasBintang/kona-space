// Writes the chart showcase: one note with every kind of chart, each with a small and a real amount of data, and the mistakes a writer can make.
//   node tests/chart-showcase.mjs <folder of the showcase project>   (the chart window test, tests/chart-ui.mjs, looks in D:	mpchart-showcase)
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2];
const dir = path.join(root, '.kona', 'brain');
fs.mkdirSync(dir, { recursive: true });

// a small deterministic random generator, so the numbers are the same every time
let seed = 7;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const normal = () => { let s = 0; for (let i = 0; i < 6; i++) s += rnd(); return (s - 3) / Math.sqrt(0.5); };

const table = (head, rows) => ['| ' + head.join(' | ') + ' |', '|' + head.map(() => '---').join('|') + '|', ...rows.map((r) => '| ' + r.join(' | ') + ' |')].join('\n');
const block = (opts, t) => '```chart\n' + Object.entries(opts).map(([k, v]) => `${k}: ${v}`).join('\n') + '\n' + t + '\n```\n';
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const parts = [];
const h2 = (s, text = '') => parts.push(`## ${s}\n\n${text ? text + '\n\n' : ''}`);
const add = (s) => parts.push(s + '\n');

parts.push('# Chart showcase\n\nEvery kind of chart the reader draws, each with a small and a real amount of data, and the mistakes a writer can make. The numbers are made up.\n');

h2('Column');
add(block({ type: 'column', title: 'Sessions per role (two series)', 'y-title': 'Sessions' }, table(['Role', 'Sonnet', 'Haiku'], [['Kiki', 12, 3], ['Nokka', 9, 14], ['Jiro', 30, 8], ['Sora', 18, 5]])));
add(block({ type: 'column', title: 'One series, 24 days', 'x-title': 'Day', unit: '$' }, table(['Day', 'Cost'], Array.from({ length: 24 }, (_, i) => [i + 1, Math.round(8 + 6 * Math.sin(i / 3) + rnd() * 5)]))));
add(block({ type: 'column', title: 'Stacked: cost by model per week', stack: 'true', unit: '$' }, table(['Week', 'Sonnet', 'Haiku', 'Opus'], [['W1', 120, 30, 60], ['W2', 150, 45, 20], ['W3', 90, 60, 80], ['W4', 170, 25, 0], ['W5', 140, 50, 40]])));
add(block({ type: 'column', title: 'Percent stacked: where the time goes', stack: 'percent' }, table(['Team', 'Build', 'Review', 'Wait'], [['Web', 40, 20, 10], ['Api', 25, 25, 25], ['Data', 10, 5, 60]])));
add(block({ type: 'column', title: 'Gains and losses (negative numbers)', unit: '$' }, table(['Quarter', 'Profit'], [['Q1', 40], ['Q2', -15], ['Q3', 25], ['Q4', -30], ['Q5', 55]])));

h2('Bar');
add(block({ type: 'bar', title: 'Tokens by account' }, table(['Account', 'Tokens'], [['Work', '1,240,000'], ['Studio', '980,000'], ['Shop', '310,000'], ['A project with a very long name that has to be cut', '150,000']])));
add(block({ type: 'bar', title: 'Two series, grouped' }, table(['Branch', 'Students', 'Teachers'], [['North', 120, 14], ['South', 90, 11], ['East', 150, 19], ['West', 60, 7], ['Online', 200, 12]])));
add(block({ type: 'bar', title: 'Stacked bars', stack: 'true' }, table(['Branch', 'Open', 'Done'], [['North', 12, 40], ['South', 5, 32], ['East', 22, 51]])));

h2('Line');
add(block({ type: 'line', title: 'Visitors per month (three series)', 'y-title': 'Visitors' }, table(['Month', 'Web', 'App', 'Partner'], months.map((m, i) => [m, Math.round(900 + i * 60 + rnd() * 120), Math.round(400 + i * 90 + rnd() * 80), Math.round(200 + rnd() * 100)]))));
add(block({ type: 'line', title: 'Smooth, with a gap', smooth: 'true' }, table(['Month', 'Score'], months.slice(0, 8).map((m, i) => [m, i === 4 ? '' : 40 + Math.round(20 * Math.sin(i / 1.5) + i * 3)]))));
add(block({ type: 'line', title: 'A real amount: 90 days', markers: 'false' }, table(['Day', 'Load'], Array.from({ length: 90 }, (_, i) => [i + 1, Math.round(50 + 20 * Math.sin(i / 8) + normal() * 4)]))));

h2('Area');
add(block({ type: 'area', title: 'Users', 'y-title': 'Users' }, table(['Month', 'Users'], months.map((m, i) => [m, 1000 + i * 180 + Math.round(rnd() * 100)]))));
add(block({ type: 'area', title: 'Stacked area: traffic by source', stack: 'true' }, table(['Month', 'Search', 'Social', 'Direct'], months.map((m, i) => [m, 300 + i * 20, 120 + Math.round(rnd() * 60), 200 + i * 10]))));
add(block({ type: 'area', title: 'Percent area: share by source', stack: 'percent' }, table(['Month', 'Search', 'Social', 'Direct'], months.slice(0, 6).map((m, i) => [m, 300 + i * 40, 120 + i * 10, 200]))));

h2('Combo', 'Columns and a line on the one axis. A second value axis is not drawn on purpose.');
add(block({ type: 'combo', title: 'Revenue and its target', line: 'Target', unit: '$' }, table(['Month', 'Revenue', 'Target'], months.slice(0, 8).map((m, i) => [m, 80 + i * 9 + Math.round(rnd() * 25), 100 + i * 8]))));

h2('Pie and doughnut');
add(block({ type: 'pie', title: 'Where the cost goes' }, table(['Part', 'Cost'], [['Sessions', 62], ['Reviews', 18], ['Builds', 12], ['Other', 8]])));
add(block({ type: 'doughnut', title: 'Seven parts' }, table(['Language', 'Lines'], [['TypeScript', 52000], ['Rust', 18000], ['CSS', 9000], ['Markdown', 7000], ['JSON', 4000], ['Shell', 2000], ['HTML', 1500]])));
add(block({ type: 'pie', title: 'Twelve parts: the small ones are folded into Other' }, table(['Part', 'Value'], Array.from({ length: 12 }, (_, i) => ['Part ' + (i + 1), 120 - i * 9]))));

h2('Scatter and bubble');
add(block({ type: 'scatter', title: 'Height and weight (two groups)', 'x-title': 'Height cm', 'y-title': 'Weight kg' }, table(['Height', 'Group A', 'Group B'], Array.from({ length: 24 }, (_, i) => { const h = Math.round(150 + i * 1.6 + normal() * 3); return [h, Math.round(h * 0.42 + normal() * 2.5), i % 3 === 0 ? '' : Math.round(h * 0.33 + 6 + normal() * 3)]; }))));
add(block({ type: 'bubble', title: 'Products: price, rating and sales' }, table(['Product', 'Price', 'Rating', 'Sales'], [['Basic', 10, 3.8, 1200], ['Plus', 25, 4.2, 800], ['Pro', 60, 4.6, 300], ['Team', 120, 4.4, 150], ['Kit', 18, 3.2, 950], ['Cloud', 80, 4.8, 90], ['Mini', 5, 3.1, 400], ['Max', 200, 4.9, 30]])));

h2('Radar');
add(block({ type: 'radar', title: 'Two roles across six skills', fill: 'true' }, table(['Skill', 'Kiki', 'Jiro'], [['Plan', 9, 4], ['Build', 4, 9], ['Test', 6, 7], ['Write', 8, 5], ['Review', 7, 8], ['Ship', 5, 9]])));

h2('Histogram');
add(block({ type: 'histogram', title: 'Scores of 80 students', 'x-title': 'Score', 'y-title': 'Students' }, table(['Score'], Array.from({ length: 80 }, () => [Math.max(10, Math.min(100, Math.round(62 + normal() * 14)))]))));
add(block({ type: 'histogram', title: 'Eight bins on purpose', bins: 8 }, table(['Minutes'], Array.from({ length: 50 }, () => [Math.round(Math.abs(normal()) * 20 + 3)]))));

h2('Box and whisker');
add(block({ type: 'box', title: 'Response time by server (long form)', unit: 'ms' }, table(['Server', 'Time'], ['alpha', 'beta', 'gamma', 'delta'].flatMap((s, k) => Array.from({ length: 14 }, () => [s, Math.round(80 + k * 25 + normal() * (10 + k * 6) + (rnd() > 0.93 ? 120 : 0))])))));

h2('Waterfall');
add(block({ type: 'waterfall', title: 'From revenue to profit', totals: 'Revenue, Profit', unit: '$' }, table(['Step', 'Amount'], [['Revenue', 500], ['Cost of goods', -180], ['Salaries', -150], ['Rent', -40], ['Other income', 30], ['Profit', '']])));

h2('Funnel');
add(block({ type: 'funnel', title: 'From visit to paid' }, table(['Stage', 'People'], [['Visited', 12000], ['Signed up', 3400], ['Tried it', 1800], ['Asked a question', 700], ['Paid', 240]])));

h2('Pareto');
add(block({ type: 'pareto', title: 'Complaints by cause' }, table(['Cause', 'Count'], [['Late', 48], ['Wrong item', 31], ['Damaged', 12], ['Rude', 9], ['Price', 6], ['Other', 4], ['Packaging', 11], ['Lost', 3]])));

h2('Treemap');
add(block({ type: 'treemap', title: 'Folder sizes (two levels)', unit: 'MB' }, table(['Area', 'Folder', 'Size'], [['app', 'src', 420], ['app', 'node_modules', 900], ['app', 'dist', 60], ['art', 'out', 240], ['art', 'src', 80], ['docs', 'trials', 150], ['docs', 'notes', 30], ['refs', 'repos', 700], ['refs', 'zips', 120]])));
add(block({ type: 'treemap', title: 'One level, twelve items' }, table(['Item', 'Size'], Array.from({ length: 12 }, (_, i) => ['Item ' + (i + 1), 100 - i * 7]))));

h2('Sunburst');
add(block({ type: 'sunburst', title: 'Cost by account, project and role' }, table(['Account', 'Project', 'Role', 'Cost'], [['North', 'LMS', 'Kiki', 30], ['North', 'LMS', 'Jiro', 55], ['North', 'Site', 'Nokka', 20], ['South', 'Admin', 'Jiro', 40], ['South', 'Admin', 'Sora', 25], ['South', 'Chat', 'Kiki', 15], ['East', 'Shop', 'Sen', 35]])));

h2('Heat map');
add(block({ type: 'heatmap', title: 'Sessions by weekday and hour' }, table(['Hour', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], ['08', '10', '12', '14', '16', '18', '20'].map((hr) => [hr, ...Array.from({ length: 7 }, (_, d) => (d > 4 ? Math.round(rnd() * 6) : Math.round(rnd() * 30 + 10)))]))));
add(block({ type: 'heatmap', title: 'A narrow one, with a gap' }, table(['Team', 'Bugs', 'Fixes'], [['Web', 12, 9], ['Api', 30, ''], ['Data', 4, 4]])));

h2('Mistakes a writer can make', 'Each of these says what is wrong, in plain words, and shows the table instead.');
add(block({ type: 'radial', title: 'A type that does not exist' }, table(['A', 'B'], [['x', 1]])));
add('```chart\ntype: column\ntitle: No table under the settings\n```');
add(block({ type: 'pie', title: 'A pie cannot be negative' }, table(['Part', 'Value'], [['a', 5], ['b', -2]])));
add(block({ type: 'scatter', title: 'Five series is too many for a scatter' }, table(['X', 'A', 'B', 'C', 'D', 'E'], [[1, 1, 2, 3, 4, 5], [2, 2, 3, 4, 5, 6]])));
add(block({ type: 'column', title: 'An unknown setting is only a note', colour: 'red' }, table(['A', 'B'], [['x', 1], ['y', 2]])));

fs.writeFileSync(path.join(dir, 'chart-showcase.md'), `---\ntitle: Chart showcase\nkind: topic\ndate: 2026-11-14\nsource: agent\nrole: product\n---\n` + parts.join('\n'));
console.log('wrote', path.join(dir, 'chart-showcase.md'), parts.join('').length, 'characters');
