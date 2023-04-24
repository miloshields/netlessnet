// takes as input a string representing a location (Boston, Massachusetts)
// for example, and returns the location key for that place based on accuweather search.

const axios = require('axios');

require('dotenv').config();

// Replace YOUR_API_KEY with your actual AccuWeather API key
const apiKey = process.env.ACCUWEATHER_API_KEY;

async function getLocationKey(location) {
  try {
    const url = `http://dataservice.accuweather.com/locations/v1/cities/search?apikey=${apiKey}&q=${encodeURIComponent(
      location
    )}`;

    const response = await axios.get(url);
    const data = response.data;

    if (data && data.length > 0) {
      console.log(`Location key for ${location}: ${data[0].Key}`);
      return data[0].Key;
    } else {
      console.log('No results found for the specified location.');
      return null;
    }
  } catch (error) {
    console.error('Error fetching location key:', error.message);
    return null;
  }
}



// takes as input the key representing a place (a six digit number)
//    for example, and returns a temperature Celsius and a descriptive string for the weather
//     "[78, rainy]"
async function getWeatherConditions(locationKey) {
    try {
      const url = `http://dataservice.accuweather.com/currentconditions/v1/${locationKey}?apikey=${apiKey}&details=true`;
  
      const response = await axios.get(url);
      const data = response.data;
  
      if (data && data.length > 0) {
        const tempFahrenheit = data[0].Temperature.Imperial.Value;
        const weatherText = data[0].WeatherText;
        const weatherInfo = [tempFahrenheit, weatherText];
        console.log(`Weather conditions: ${JSON.stringify(weatherInfo)}`);
        return weatherInfo;
      } else {
        const weatherInfo = [1000, "Looks like we couldn't find any weather for that place."];
        console.log(`Weather conditions: ${JSON.stringify(weatherInfo)}`);
        return weatherInfo;
      }
    } catch (error) {
      const weatherInfo = [1000, "Looks like we couldn't find any weather for that place."];
      console.error('Error fetching weather conditions:', error.message);
      return weatherInfo;
    }
  }
  
  // Export the functions
  module.exports = {
    getLocationKey,
    getWeatherConditions,
  };