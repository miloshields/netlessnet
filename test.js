const assert     = require('assert');
const ChatGPTAPI = require('./gpt-requests');

assert.doesNotThrow(() => {
    ChatGPTAPI.getChatGPTResponse("testing");
  }, Error);
