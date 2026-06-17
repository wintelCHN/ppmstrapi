/**
 * Postinstall script: creates a bridge package in node_modules so
 * strapi-plugin-translate can resolve our custom DeepSeek provider.
 *
 * The plugin expects `strapi-provider-translate-<name>` as an npm package.
 * This creates a minimal package that re-exports our actual provider code
 * from `src/providers/translate-deepseek/index.js`.
 */

const fs = require('fs')
const path = require('path')

const bridgeDir = path.resolve(__dirname, '..', 'node_modules', 'strapi-provider-translate-deepseek')

// Ensure the directory exists
fs.mkdirSync(bridgeDir, { recursive: true })

// Write package.json
fs.writeFileSync(
  path.join(bridgeDir, 'package.json'),
  JSON.stringify(
    {
      name: 'strapi-provider-translate-deepseek',
      version: '1.0.0',
      description: 'DeepSeek AI translation provider for strapi-plugin-translate (bridge)',
      main: 'index.js',
      private: true,
    },
    null,
    2,
  ),
)

// Write index.js (re-export from src)
fs.writeFileSync(
  path.join(bridgeDir, 'index.js'),
  [
    '/**',
    ' * Bridge: re-exports the DeepSeek provider so strapi-plugin-translate can require() it.',
    ' * The actual provider logic lives in src/providers/translate-deepseek/index.js',
    ' */',
    "module.exports = require('../../src/providers/translate-deepseek/index.js')",
    '',
  ].join('\n'),
)

console.log('[postinstall] DeepSeek translate provider bridge created.')
