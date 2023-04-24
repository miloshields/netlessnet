// tests that all 3rd party APIs are returning data as expected

const assert     = require('assert');
const GPTAPI = require('./requests/gpt-requests');
const { getLocationKey, getWeatherConditions } = require('./requests/weather-requests.js');
const NewsAPI = require('./requests/news-requests');

async function main() {
  assert.doesNotThrow(() => {
    GPTAPI.getChatGPTResponse("testing");
  }, Error);

  assert.doesNotThrow(() => {
      NewsAPI.getNewsSummary("Ukraine")
    }, Error);

  const newsPrompts = [
    "War in Ukraine",
    "Middle East",
    "US Educational System",
    "2024 Presidential Race"
  ]

  console.log("Starting News Request Testing Suite...");
    
    for (let i = 0; i < newsPrompts.length; i++) {
      let startTime = Date.now();
      console.log(`Test ${i + 1}}\nInput: ${newsPrompts[i]}`);
      let newsResponse = await NewsAPI.getNewsSummary(newsPrompts[i]);
      let elapsedTime = (Date.now() - startTime) / 1000;
      console.log(`Output: ${newsResponse}`);
      console.log(`Time Elapsed: ${elapsedTime.toFixed(2)}s\n`);
    }

    const resourcePrompts = [
      "Who is Barack Obama?",
      "What's the weather like in Amsterdam right now?",
      "What's the latest in Ukrainian politics?",
      "I want to know about Barack Obama.",
      "I don't know how to make friends.",
      "What is my Mom's Name"
    ];
    const resourceCategories = [
      "Person",
      "Weather",
      "News",
      "Wikipedia",
      "ChatGPT",
      "ChatGPT"
    ];
    
    console.log("Starting GPT Resource Request Test Suite...");
    
    for (let i = 0; i < resourcePrompts.length; i++) {
      let startTime = Date.now();
      console.log(`Test ${i + 1}: ${resourceCategories[i]}\nInput: ${resourcePrompts[i]}`);
      let resourceResponse = await GPTAPI.getGPTResourceResponse(resourcePrompts[i]);
      let elapsedTime = (Date.now() - startTime) / 1000;
      console.log(`Output: ${resourceResponse}`);
      console.log(`Time Elapsed: ${elapsedTime.toFixed(2)}s\n`);
    }

    const chatPrompts = [
      "What's the square root of nine?",
      "What are the biggest countries for videogames?",
      "Why am I so sad all the time?"
    ]
    const chatCategories = [
      "Math",
      "Data",
      "Behavioral"
    ]

    console.log("Starting ChatGPT Request Test Suite");

    for (let i = 0; i < chatPrompts.length; i++) {
      let startTime = Date.now();
      console.log(`Test ${i + 1}: ${chatCategories[i]}\nInput: ${chatPrompts[i]}`);
      let resourceResponse = await GPTAPI.getChatGPTResponse(chatPrompts[i]);
      let elapsedTime = (Date.now() - startTime) / 1000;
      console.log(`Output: ${resourceResponse}`);
      console.log(`Time Elapsed: ${elapsedTime.toFixed(2)}s\n`);
    }

  console.log("Starting weather api test suite.")
    // Test 1: getLocationKey returns a valid key for a known location
  const bostonKey = await getLocationKey('Boston, Massachusetts');
  assert.strictEqual(typeof bostonKey, 'string', 'Location key should be a string');
  assert.ok(bostonKey.length > 0, 'Location key should not be empty');

  // Test 2: getLocationKey returns null for an invalid location
  const invalidLocationKey = await getLocationKey('Invalid location');
  assert.strictEqual(invalidLocationKey, null, 'Location key should be null for invalid location');

  // Test 3: getWeatherConditions returns valid data for a known location key
  const bostonWeather = await getWeatherConditions(bostonKey);
  assert.ok(Array.isArray(bostonWeather), 'Weather data should be an array');
  assert.strictEqual(bostonWeather.length, 2, 'Weather data array should have 2 elements');
  assert.strictEqual(typeof bostonWeather[0], 'number', 'Temperature should be a number');
  assert.strictEqual(typeof bostonWeather[1], 'string', 'Weather text should be a string');

  // Test 4: getWeatherConditions returns [1000, "Looks like we couldn't find any weather for that place."] for an invalid location key
  const invalidWeather = await getWeatherConditions('9459028354098253409');
  assert.deepStrictEqual(
    invalidWeather,
    [1000, "Looks like we couldn't find any weather for that place."],
    'Weather data should be [1000, "Looks like we couldn\'t find any weather for that place."] for invalid location key'
  );

  console.log('All tests passed.');
    
}

main();

