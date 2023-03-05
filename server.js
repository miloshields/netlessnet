require('dotenv').config();
const http = require('http');
const express = require('express');
const twilio = require('twilio');

// custom modules
const { getWikiResults, getWikiArticleContent } = require('./customrequests.js');
const { start } = require('repl');

const accountSid   = process.env.TWILIO_ACCOUNT_SID;
const authToken    = process.env.TWILIO_AUTH_TOKEN;
const twilioPhone  = process.env.TWILIO_PHONE_NUMBER;
const testPhone    = process.env.TEST_PHONE_NUMBER;
// const binUrl       = process.env.TWILIO_BIN_URL;
// const googleApiKey = process.env.GOOGLE_API_KEY;
// const wikisearchCx = process.env.WIKISEARCH_CX_KEY;
const ngrok_url    = process.env.NGROK_TUNNEL_URL;

// Initialize Twilio client
const client = twilio(accountSid, authToken);

// Initialize Express web server
const app = express();

// Set express urlencoded mode
app.use(
  express.urlencoded({
    extended: true,
  })
);

// Twilio webhook endpoint to initiate the call
app.post('/make-call', (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  twiml.say('Hello! What would you like to make a Wikipedia search for?');
  twiml.gather({
    input: 'speech',
    action: '/repeat',
    speechTimeout: 'auto',
    language: 'en-US'
  });
  res.set('Content-Type', 'text/xml');
  res.send(twiml.toString());
});

// Twilio webhook endpoint to make wikipedia search and read results back to user
app.post('/repeat', async (req, res) => {
  console.log(req.body);
  const twiml = new twilio.twiml.VoiceResponse();
  const userSpeech = req.body.SpeechResult;
  console.log("userSpeech" + userSpeech);
  //get array of all wikipedia search results for search term
  const searchResults  = await getWikiResults(userSpeech);
  // console.log("search results is " + searchResults); 
  //grab content including title of first wiki result 
  const articleContent = await getWikiArticleContent(searchResults[0].pageid);
  // console.log("article content is " + articleContent); 
  // console.log("article content title is " + articleContent.title)
  // console.log("article content is " + articleContent.content)

  var stringToSay = `Article Title: ${articleContent.title}. Article Summary: ${articleContent.content}
  . Thanks for using the Netless Net!`

  stringsToSay = []


  for(i = 0; i < Math.ceil(stringToSay.length / 300); i++) {
    var startIndex = 300 * i
    var endIndex   = (300 * i) + 300
    stringsToSay.push(stringToSay.substring(startIndex, endIndex));
  }
  
  stringsToSay.forEach(string => twiml.say(string));


  twiml.hangup();
  res.set('Content-Type', 'text/xml');
  res.send(twiml.toString());
});

// start the server
http.createServer(app).listen(3000, () => {
    console.log('Express server listening on port 3000');
});

// Make the initial outgoing call
client.calls.create({
  url: ngrok_url+'/make-call',
  to: testPhone,
  from: twilioPhone
})
.then(call => console.log(call.sid))
.catch(error => console.log(error));