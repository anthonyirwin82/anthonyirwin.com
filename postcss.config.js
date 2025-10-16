const { PurgeCSS } = require('purgecss');

const purgeCSSPlugin = () => {
  return {
    postcssPlugin: 'postcss-purgecss-modern',
    Once: async (root, { result }) => {
      if (process.env.HUGO_ENVIRONMENT !== 'production') return;

      const purgeCSSResult = await new PurgeCSS().purge({
        content: [
          './layouts/**/*.html',
          './content/**/*.md',
          './assets/js/**/*.js',
          './hugo_stats.json',
          // ✅ All themes' layouts and JS
          './themes/**/layouts/**/*.html',
          './themes/**/content/**/*.md',
          './themes/**/assets/js/**/*.js'
        ],
        css: [{ raw: root.toString() }],
        defaultExtractor: content =>
          content.match(/[\w-/:.]+(?<!:)/g) || [],
      });

      if (purgeCSSResult.length > 0 && purgeCSSResult[0].css) {
        // Replace the entire CSS with the purged version
        root.removeAll();
        root.append(require('postcss').parse(purgeCSSResult[0].css));
      }
    },
  };
};

purgeCSSPlugin.postcss = true;

module.exports = {
  plugins: [
    require('autoprefixer'),
    purgeCSSPlugin(),
  ],
};
