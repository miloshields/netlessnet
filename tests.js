// tests that all 3rd party APIs are returning data as expected

const assert     = require('assert');
const GPTAPI = require('./requests/gpt-requests');

async function main() {
  assert.doesNotThrow(() => {
    GPTAPI.getChatGPTResponse("testing");
  }, Error);

  assert.doesNotThrow(() => {
      GPTAPI.getGPTResourceResponse("Testing")
    }, Error);

    const prompts = [
      "What's the weather like in Amsterdam right now?",
      "What's the latest in Ukrainian politics?",
      "I want to know about Barack Obama.",
      "I don't know how to make friends.",
      "What is my Mom's Name"
    ];
    const categories = [
      "Weather",
      "News",
      "Wikipedia",
      "ChatGPT",
      "ChatGPT"
    ];
    
    console.log("Starting GPT Resource Request Test Suite...");
    
    for (let i = 0; i < prompts.length; i++) {
      let startTime = Date.now();
      console.log(`Test ${i + 1}: ${categories[i]}\nInput: ${prompts[i]}`);
      let resourceResponse = await GPTAPI.getGPTResourceResponse(prompts[i]);
      let elapsedTime = (Date.now() - startTime) / 1000;
      console.log(`Output: ${resourceResponse}`);
      console.log(`Time Elapsed: ${elapsedTime.toFixed(2)}s\n`);
    }
}

main();

