// crafted requests used by the server in providing reference info
const axios = require('axios');

// return list of wiki page search objects given a search term
async function getWikiResults(searchTerm) {
  try {
    // look for pages with titles similar to the search term
    const searchResponse = await axios.get('https://en.wikipedia.org/w/api.php', {
      params: {
        action: 'query',
        list: 'search',
        srsearch: searchTerm,
        format: 'json'
      }
    });
    return searchResponse.data.query.search;
  }
  catch (e) {
    console.error("Encountered an error in getting Wikipedia results: " + e)
  }
}

// return the content of an article
async function getWikiArticleContent(pageId) {
  try {
    const contentResponse = await axios.get('https://en.wikipedia.org/w/api.php', {
        params: {
          action: 'query',
          prop: 'extracts',
          exintro: '',
          explaintext: '',
          format: 'json',
          pageids: pageId
        }
      });
      const pageContent = contentResponse.data.query.pages[pageId].extract;
      const pageTitle   = contentResponse.data.query.pages[pageId].title;
      return {title: pageTitle, content: pageContent}
  }
  catch(e) {
    console.error("Encountered an errror in getting Wikipedia article content:" + e);
  }
}

  module.exports = { getWikiResults, getWikiArticleContent };