require('dotenv').config();

const axios = require('axios');
const apiKey = process.env.NEWS_API_KEY

async function getNewsSummary(searchTerm) {
  const apiUrl = `https://newsapi.org/v2/top-headlines?q=${searchTerm}&apiKey=${apiKey}`;

  let summary = "";
  try {
    const response = await axios.get(apiUrl);

    response.data.articles.forEach((article) => {
      if (article.description && article.source) {
        summary += "From "+article.source.name+": "
        summary += article.description
      }
      else{
        console.log("Got a null article description.");
        summary += "";
      }
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