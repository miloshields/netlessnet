// crafted requests used by the server in providing reference info
const axios = require('axios');

async function getWikiArticle(searchTerm) {
    try {
      const searchResponse = await axios.get('https://en.wikipedia.org/w/api.php', {
        params: {
          action: 'query',
          list: 'search',
          srsearch: searchTerm,
          format: 'json'
        }
      });
      const pageId = searchResponse.data.query.search[0].pageid;
      const title = searchResponse.data.query.search[0].title;
  
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
      return({
        'Title': title,
        'Content': pageContent
      });
    } catch (error) {
      console.error(error);
    }
  }

  module.exports = { getWikiArticle };