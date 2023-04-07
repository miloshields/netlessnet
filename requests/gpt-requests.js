// Suite of request functions to interact with chatGPT

require('dotenv').config();

const { Configuration, OpenAIApi, complete } = require('openai');

const resource_prompt = "You have to decide whether the user's question is best answered by searching wikipedia, chatgpt, a newsapi, or a weather api. You can only answer one word from the following list [wikipedia, chatgpt (a general-purpose basic information resource on everything), news, weather], followed by the most relevant search term for that resource. You can use chatgpt as a catch-all if you're not sure where to find information - simply include the prompt itself as the search term. \n Prompt: What's the weather like in New York City?\nOutput: weather, new york city\nPrompt: Where am I?\nOutput: chatgpt, where am I\nPrompt: ";

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

async function getChatGPTResponse(prompt) {
  const response = await openai.createChatCompletion({
    model: "gpt-3.5-turbo",
    messages: [{role: "user", content: prompt}],
  });
  return response.data.choices[0].message.content;
}

async function getGPTResourceResponse(prompt) {
  const response = await openai.createCompletion({
    model: "text-davinci-003",
    prompt: resource_prompt + prompt + "\nOutput: ",
    temperature: 0,
    max_tokens: 64,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
  });
  return response.data.choices[0].text;
}

module.exports = { getChatGPTResponse, getGPTResourceResponse };