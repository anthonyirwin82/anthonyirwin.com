+++
date = '2025-10-17'
title = 'How to strip unused CSS from your CSS files and Minify them into a single CSS file using Hugo'
description = 'Using Hugo with PostCSS and PurgeCSS allows you to automatically remove unused CSS and bundle all your styles into a single minified file for production, improving page load times and performance.'
tags = ['Tech', 'Programming', 'Hugo']
bannerId = 'web-dev'
draft = false
+++
Using Hugo with PostCSS and PurgeCSS allows you to automatically remove unused CSS and bundle all your styles into a single minified file for production, improving page load times and performance.

Stripping out unused CSS is particularly useful if you use frameworks like Bootstrap as you generally don't use the entire framework. 

You can install the PostCSS and PurgeCSS tools using npm, if you don't have npm installed you can follow the instructions below for popular linux distributions.

{{<blogsnippet "install_npm">}}

You can then go to your Hugo root directory and run:

```bash
npm init
npm install postcss postcss-cli purgecss autoprefixer
```

From inside the Hugo root directory create the config file **postcss.config.js**

```js
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
          // All themes' layouts and JS
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
```

Then you need to add the following into your **hugo.toml** config file.
```toml
[markup.postCSS]
    use = ["postcss"]

[build]
    writeStats = true
```

The writeStats setting is needed so PurgeCSS knows what CSS is being used.

The file to edit or create next will depend on if you are using a theme or if you are overriding the themes baseof.html in your Hugo project.

In this post I'm going to do the editing from the point of view that you have your own custom theme. If you are overriding a third-party theme then you can edit the files in you hugo project layouts directory instead.

```text
themes/theme-name
├── layouts
│   ├── _partials
│   │   ├── footer.html
│   │   ├── head
│   │   │   ├── css.html
│   │   │   ├── js.html
│   │   │   └── seo.html
│   │   ├── head.html
│   │   ├── header.html
│   │   └── terms.html
│   ├── baseof.html
│   ├── home.html
│   ├── page.html
│   ├── section.html
│   ├── taxonomy.html
│   └── term.html
```

The above listing is a stripped down version showing some of the essential theme files for a Hugo website.

This website example has a layouts/_partials/head/css.html file that is included as a partial for including all CSS related content.

```go-html-template
{{ $cssFiles := slice }}

{{/* Add main.css */}}
{{ $mainCSS := resources.Get "css/main.css" }}
{{ $cssFiles = $cssFiles | append ($mainCSS | postCSS) }}

{{/* Add styles.scss */}}
{{ $stylesSCSS := resources.Get "scss/styles.scss" | toCSS | postCSS }}
{{ $cssFiles = $cssFiles | append $stylesSCSS }}

{{/* Add fonts.scss */}}
{{ $fontsSCSS := resources.Get "scss/fonts.scss" | toCSS | postCSS }}
{{ $cssFiles = $cssFiles | append $fontsSCSS }}

{{ if hugo.IsDevelopment }}
  {{ range $cssFiles }}
    <link rel="stylesheet" href="{{ .RelPermalink }}">
  {{ end }}
{{ else }}
  {{ $bundle := $cssFiles | resources.Concat "css/styles-bundle.css" | minify | fingerprint }}
  <link rel="preload" href="{{ $bundle.RelPermalink }}" as="style" integrity="{{ $bundle.Data.Integrity }}" crossorigin="anonymous">
  <link rel="stylesheet" href="{{ $bundle.RelPermalink }}" integrity="{{ $bundle.Data.Integrity }}" crossorigin="anonymous">
{{ end }}
```
**NOTE:** Only files in the assets directory are processed by Hugo. If you have these files in the static directory they need to be moved to assets.

The file above will process the CSS files with PostCSS stripping out any unused CSS then if it is a development build it will create multiple CSS files without minifying them. If it is not a development build then it combines all the CSS files into styles-bundle.css then minifies it.

So now you need to make sure that your Hugo setup includes this css.html file somewhere in the head tag in the html of your website by using:

```go-html-template
{{ partial "head/css.html" . }}
```

Once you have done this have a look at the page source in both development builds and production builds:

**Development build:**
```bash
rm -Rf public && hugo server
```

**Test production build:**
```bash
rm -Rf public && hugo && cd public && php -S localhost:1313
```

**Minified production build:**
```bash
rm -Rf public && hugo --minify && cd public && php -S localhost:1313
```

In the above examples I'm using php to easily spin up a webserver to test the production builds. If you don't have php installed then you can either install php or use another tool to test the production builds before you deploy them.
