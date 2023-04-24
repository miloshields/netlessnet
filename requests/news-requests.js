require('dotenv').config();

const axios = require('axios');
const apiKey = process.env.NEWS_API_KEY

async function getNewsSummary(searchTerm) {
  const apiUrl = `https://newsapi.org/v2/top-headlines?q=${searchTerm}&apiKey=${apiKey}`;

  try {
    const response = await axios.get(apiUrl);
    const articles = response.data.articles.slice(0, 3); // limit to top 3 articles
    let summary = '';

    articles.forEach((article, index) => {
      summary += article.description;
    });

    return summary;
  } catch (error) {
    console.error(error);
    return null;
  }
}

// Export the functions
module.exports = {
    getNewsSummary
  };