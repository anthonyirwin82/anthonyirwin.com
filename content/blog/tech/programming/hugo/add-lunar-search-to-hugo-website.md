+++
date = '2025-10-23'
title = 'How to add Lunr.js Search to Your Hugo Website'
description = 'Learn how to integrate Lunr.js for fast, client-side search functionality in your Hugo static site.'
tags = ['Tech', 'Programming', 'Hugo', 'Lunr', 'Search']
bannerId = 'web-dev'
draft = false
+++

## Overview of Lunr.js

Lunr.js, commonly known as Lunr, is a lightweight full-text search library written in JavaScript. It's specifically designed to run entirely in the browser, making it an excellent choice for static websites like those built with Hugo. Unlike traditional search solutions that require server-side processing or external services, Lunr performs all search operations client-side.

Lunr.js does not require you to use third party providers so there is no risk of over using a free tier service and being charged or having your search turned off due to you using more then the allocated search volume.

## Why Lunr is Great for Static Websites

- **No Backend Required**: All search functionality runs in the user's browser, eliminating the need for server-side databases or APIs.
- **Fast and Lightweight**: The library is small (around 30KB minified) and provides instant search results.
- **Offline Capable**: Once the search index is loaded, searches work even without an internet connection.
- **Flexible Indexing**: Supports multiple fields with customizable boost values for relevance scoring.
- **Easy Integration**: Simple to set up with existing Hugo workflows.


## Setting Up Lunr Search in Hugo

Follow these steps to add Lunr powered search to your Hugo website.

### 1. Install Dependencies

First, make sure you are in your Hugo websites root directory then add Lunr and fontawesome-free to your project's dependencies:

```bash
npm install lunr
npm install @fortawesome/fontawesome-free
```

### 2. Copy Lunr and FontAwesome to Assets

Update the `package.json` file to copy the minified Lunr library to your assets directory:

> [!NOTE]
> Other content from the `package.json` file has been stripped out of this example

```json
{
  "scripts": {
    "copy:lunr": "cp node_modules/lunr/lunr.min.js assets/js/",
    "copy:fontawesome": "cp node_modules/@fortawesome/fontawesome-free/css/all.min.css assets/css/fontawesome.all.min.css && cp -r node_modules/@fortawesome/fontawesome-free/webfonts/* static/assets/fonts/ && sed -i 's|../webfonts/|/assets/fonts/|g' assets/css/fontawesome.all.min.css",
  }
}
```

Run the copy command:

```bash
npm run copy:lunr
npm run copy:fontawesome
```

## 3. Include Lunr and FontAwesome in Your Head Partial

Update your head JavaScript partial to include Lunr. Here's an example from `layouts/_partials/head/js.html` or `themes/your-theme/layouts/_partials/head/js.html` depending on your setup:

```go-html-template
{{/*  Other content in file stripped from example */}}

{{/* Add raw vendor JS (minified already) */}}
{{ $lunr := resources.Get "js/lunr.min.js" }}
{{ $scripts = $scripts | append $lunr }}

{{ if hugo.IsDevelopment }}
  {{ range $scripts }}
    <script src="{{ .RelPermalink }}"></script>
  {{ end }}
{{ else }}
  {{ $bundle := $scripts | resources.Concat "js/bundle.js" | fingerprint }}
  <script src="{{ $bundle.RelPermalink }}" integrity="{{ $bundle.Data.Integrity }}" crossorigin="anonymous" defer></script>
{{ end }}
```

> [!IMPORTANT]
> Make sure Lunr is loaded before your custom search.js JavaScript file which we will create later.

Update your head CSS partial to include FontAwesome. Here's an example from `layouts/_partials/head/css.html` or `themes/your-theme/layouts/_partials/head/css.html` depending on your setup:

```go-html-template
{{ $cssFiles := slice }}

{{/* Other CSS files striped from example */}}

{{/* Add Font Awesome */}}
{{ $fontawesome := resources.Get "css/fontawesome.all.min.css" }}
{{ $cssFiles = $cssFiles | append $fontawesome }}

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

This ensures FontAwesome icons are available throughout your site.

## 4. Create a Search Index Template

Create a template to generate a JSON search index. Save this as `layouts/search/search-index.html` or `themes/your-theme/layouts/search/search-index.html` depending on your setup:

```go-html-template
{{- $data := slice -}}
{{- $title := "" -}}
{{- $description := "" -}}
{{- $content := "" -}}
{{- $tags := "" -}}

{{- range site.RegularPages.ByTitle -}}
  {{- with .Title -}}
    {{- $title = . | markdownify | plainify | strings.TrimSpace -}}
  {{- end -}}

  {{- with .Description -}}
    {{- $description = . | markdownify | plainify | strings.TrimSpace -}}
  {{- else -}}
    {{- $description = $title -}}
  {{- end -}}
  
  {{- with .Summary -}}
    {{- $content = . | markdownify | plainify | strings.TrimSpace | truncate 2000 -}}
  {{- else -}}
    {{- $content = $description -}}
  {{- end -}}

  {{- $tags = .Params.tags | default slice -}}
  {{- $tagsProcessed := slice -}}
  {{- range $tags -}}
    {{- $str := . | printf "%s" -}}
    {{- $processed := $str | strings.ReplaceRE "[-–]" " " -}}
    {{- $tagsProcessed = $tagsProcessed | append $processed -}}
  {{- end -}}

  {{- $tagsStr := delimit $tagsProcessed " " -}}
  {{- $dict := dict "title" $title "description" $description "content" $content "tags" $tagsStr "url" .RelPermalink -}}
  {{- if .Params.keywords -}}
    {{- $dict = merge $dict (dict "keywords" .Params.keywords) -}}
  {{- end -}}
  {{- $data = $data | append $dict -}}
{{- end -}}

{{- $data | jsonify (dict "indent" "  ") -}}
```

This template processes all regular pages, extracting title, description, content, tags, and keywords for indexing.

## 5. Create a Search Page

Create a content file for the search page at `content/search/_index.md` or `themes/your-theme/content/search/_index.md` depending on your setup:

```toml
+++
title = "Search Results"
sitemap_exclude = true
+++

Search for content on the site.
```

And a corresponding layout at `layouts/search/list.html` or `themes/your-theme/layouts/search/list.html` depending on your setup:

```go-html-template
{{ define "main" }}
   <article class="container">
     {{ .Content }}
     <div id="search-results"></div>
   </article>
{{ end }}
```

## 6. Add a Search Form to Navigation

Update your navigation partial to include a search form. Here's an example from `layouts/_partials/main-navigation.html` or `themes/your-theme/layouts/_partials/main-navigation.html`:

> [!IMPORTANT]
> This is just the code for the search form. You will need to put it in the correct place within your `main-navigation.html` partial file.

```go-html-template
<form class="d-flex ms-auto" id="search-form">
  <div class="input-group rounded">
    <input class="form-control" type="search" placeholder="Search..." aria-label="Search" id="search-input">
    <button class="btn btn-outline-light" type="submit" id="search-button">
      <i class="fas fa-magnifying-glass"></i>
    </button>
  </div>
</form>
```
> [!NOTE]
> This example is using Bootstrap 5 for styling

## 7. Implement Search JavaScript

Create a search JavaScript file at `assets/js/search.js` or `themes/your-theme/assets/js/search.js` depending on your setup:

```js
// Load search index and initialize Lunr
let searchIndex = null;
let lunrIndex = null;

function loadSearchIndex() {
  fetch('/search-index.json')
    .then(response => response.json())
    .then(data => {
      searchIndex = data;
      lunrIndex = lunr(function () {
        this.ref('url');
        this.field('title', { boost: 10 });
        this.field('description', { boost: 5 });
        this.field('content');
        this.field('tags', { boost: 8 });
        this.field('keywords', { boost: 2 });

        data.forEach(doc => {
          this.add(doc);
        });
      });
      // Check if on search page and perform search
      if (window.location.pathname === '/search/') {
        const urlParams = new URLSearchParams(window.location.search);
        const query = urlParams.get('q');
        if (query) {
          const results = lunrIndex.search(query);
          displayResults(results, query);
        }
      }
    })
    .catch(error => {
      console.error('Error loading search index:', error);
      const resultsContainer = document.getElementById('search-results');
      if (resultsContainer) {
        resultsContainer.innerHTML = '<p>Error loading search index. Please try again.</p>';
        resultsContainer.style.display = 'block';
      }
    });
}

loadSearchIndex();

// Handle search form submission
document.getElementById('search-form').addEventListener('submit', function (e) {
  e.preventDefault();
  const query = document.getElementById('search-input').value.trim();
  if (!query) return;

  // Redirect to search page with query
  window.location.href = '/search/?q=' + encodeURIComponent(query);
});

// Display search results
function displayResults(results, query) {
  const resultsContainer = document.getElementById('search-results');
  if (!resultsContainer) return;

  if (results.length === 0) {
    resultsContainer.innerHTML = '<p>No results found for "' + query + '"</p>';
    return;
  }

  let html = '<h3>Search Results for "' + query + '"</h3><ul>';
  results.forEach(result => {
    const doc = searchIndex.find(d => d.url === result.ref);
    if (doc) {
      const desc = doc.description.length > 500 ? doc.description.substring(0, 500) + '...' : doc.description;
      html += '<li><a href="' + doc.url + '">' + doc.title + '</a><p>' + desc + '</p></li>';
    }
  });
  html += '</ul>';
  resultsContainer.innerHTML = html;
  resultsContainer.style.display = 'block';
}
```
> [!IMPORTANT]
> Make sure this script is included in your head JavaScript partial after Lunr.

Update your head JavaScript partial to include the `search.js` file. Here's an example from `layouts/_partials/head/js.html` or `themes/your-theme/layouts/_partials/head/js.html` depending on your setup:

```go-html-template
{{/*  Other content in file stripped from example */}}

{{/* Add raw vendor JS (minified already) */}}
{{ $lunr := resources.Get "js/lunr.min.js" }}
{{ $scripts = $scripts | append $lunr }}

{{/* Build and add search.js */}}
{{ $search := resources.Get "js/search.js" | js.Build (dict
    "minify" (not hugo.IsDevelopment)
    "sourceMap" (cond hugo.IsDevelopment "external" "")
) }}
{{ $scripts = $scripts | append $search }}

{{ if hugo.IsDevelopment }}
  {{ range $scripts }}
    <script src="{{ .RelPermalink }}"></script>
  {{ end }}
{{ else }}
  {{ $bundle := $scripts | resources.Concat "js/bundle.js" | fingerprint }}
  <script src="{{ $bundle.RelPermalink }}" integrity="{{ $bundle.Data.Integrity }}" crossorigin="anonymous" defer></script>
{{ end }}
```

## 8. Build and Test

Run your Hugo build process:

```bash
npm run build
```

Test the search functionality by navigating to your site and using the search form in the navigation.

## Conclusion

By integrating Lunr.js into your Hugo website, you've added powerful, fast search capabilities without compromising on the static nature of your site. Users can now quickly find content using search queries, with results ranked by relevance. The client-side approach ensures privacy (no search data sent to servers) and works reliably even in low connectivity environments.

