// Load search index and initialize Lunr
let searchIndex = null;
let lunrIndex = null;

function loadSearchIndex() {
  const cached = localStorage.getItem('searchIndex');
  if (cached) {
    try {
      const data = JSON.parse(cached);
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
    } catch (e) {
      console.error('Error parsing cached search index:', e);
      localStorage.removeItem('searchIndex');
      loadSearchIndex(); // Retry without cache
    }
  } else {
    fetch('/search-index.json')
      .then(response => response.json())
      .then(data => {
        searchIndex = data;
        try {
          localStorage.setItem('searchIndex', JSON.stringify(data));
        } catch (e) {
          console.log('Search index too large for localStorage, not cached');
        }
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