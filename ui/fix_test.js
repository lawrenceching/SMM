const fs = require('fs');
const content = fs.readFileSync('src/components/TvShowPanelUtils.test.ts', 'utf8');

// Fix the createMockMediaMetadata function
let fixed = content.replace(
  'const createMockMediaMetadata = (overrides?: Partial<UIMediaMetadata>): UIMediaMetadata => ({',
  'const createMockMediaMetadata = (overrides?: Partial<UIMediaMetadata>): UIMediaMetadata => ({\n    status: \'ok\','
);

// Fix all MediaMetadata object literals
fixed = fixed.replace(/const mm: UIMediaMetadata = \{/g, 'const mm: UIMediaMetadata = {\n      status: \'ok\',');

fs.writeFileSync('src/components/TvShowPanelUtils.test.ts', fixed);
