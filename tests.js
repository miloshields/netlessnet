const assert     = require('assert');
const ChatGPTAPI = require('./requests/gpt-requests');

assert.doesNotThrow(() => {
    ChatGPTAPI.getChatGPTResponse("testing");
  }, Error);
