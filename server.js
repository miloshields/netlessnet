require('dotenv').config();
const http = require('http');
const express = require('express');
const twilio = require('twilio');

// custom modules
const { getWikiResults, getWikiArticleContent } = require('./customrequests.js');

const runMode      = process.argv.slice(2)[0] || 'dev';
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
//create delay between text messages so that messages are delivered in 
//order 
function sendMessageWithDelay(message, twilioPhone, testPhone, delay) {
  return setTimeout(() => {
    const messageBody = message;
    client.messages
      .create({
        body: messageBody,
        from: twilioPhone,
        to: testPhone
      })
      .then(message => console.log(`Message sent to ${message.to}: ${message.body}`))
      .catch(error => console.error(error));
  }, delay);
}


// Twilio webhook endpoint to initiate the call
app.post('/make-call', (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  twiml.say('Hello! What would you like to make a Wikipedia search for?');
  twiml.gather({
    input: 'speech',
    action: '/read-wiki-article',
    speechTimeout: 'auto',
    language: 'en-US'
  });
  res.set('Content-Type', 'text/xml');
  res.send(twiml.toString());
});

// Twilio webhook endpoint to make wikipedia search and read results back to user
app.post('/read-wiki-article', async (req, res) => {
  console.log(req.body);
  const twiml = new twilio.twiml.VoiceResponse();
  const userSpeech = req.body.SpeechResult;
  console.log("userSpeech" + userSpeech);
  const searchResults  = await getWikiResults(userSpeech);
  const articleContent = await getWikiArticleContent(searchResults[0].pageid);

  var stringToSay = `Article Title: ${articleContent.title}. Article Summary: ${articleContent.content}
  . Thanks for using the Netless Net!`

  stringsToSay = []

//break up long content into size deliverable through twilio 
  if(runMode === 'dev') {
    sendMessageWithDelay("Development Message For Confirmation", twilioPhone, testPhone, 0);
    twiml.say("Development Message Sent.")
  }
  else{
    var max_sbstr = 300
    for (let i = 0; i < stringToSay.length; i += max_sbstr) {
      const currentString = stringToSay.substring(i, i + max_sbstr);
      stringsToSay.push(currentString);
      const messageNumber = Math.floor(i / max_sbstr) + 1;
      const totalNumber = Math.ceil(stringToSay.length / max_sbstr);
      sendMessageWithDelay(`Message ${messageNumber}/${totalNumber}: ${currentString}`, twilioPhone, testPhone, i * 5000 / max_sbstr);
    }
    stringsToSay.forEach(string => twiml.say(string));
  }
  twiml.hangup();
  res.set('Content-Type', 'text/xml');
  res.send(twiml.toString());
});

// Define a route to process the user's input
app.post('/process_input', (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  const input = req.body.Digits;

  if (input && input.length === 2) {
    twiml.say(`You entered ${input}. Thank you for your response.`);
  } else {
    twiml.say('Invalid input. Please try again.');
    twiml.redirect('/start');
  }

  res.type('text/xml');
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