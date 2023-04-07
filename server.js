require('dotenv').config();
const http = require('http');
const express = require('express');
const twilio = require('twilio');
const session = require('express-session');

// custom modules
const { getWikiResults, getWikiArticleContent } = require('./requests/wiki-requests.js');
const { getChatGPTResponse, getGPTResourceResponse } = require('./requests/gpt-requests.js')

const runMode       = process.argv.slice(2)[0] || 'dev';
const accountSid    = process.env.TWILIO_ACCOUNT_SID;
const authToken     = process.env.TWILIO_AUTH_TOKEN;
const twilioPhone   = process.env.TWILIO_PHONE_NUMBER;
const testPhone     = process.env.TEST_PHONE_NUMBER;
const sessionSecret = process.env.EXPRESS_SESSION_SECRET;
// const binUrl       = process.env.TWILIO_BIN_URL;
// const googleApiKey = process.env.GOOGLE_API_KEY;
// const wikisearchCx = process.env.WIKISEARCH_CX_KEY;
const ngrok_url     = process.env.NGROK_TUNNEL_URL;

// Initialize Twilio client
const client = twilio(accountSid, authToken);

// Initialize Express web server
const app = express();

// Set express urlencoded mode, activate session
app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: true
  }),
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

// landing pad for all functionality
app.post('/start', (req, res) => {
  console.log("In Start.")
  const twiml = new twilio.twiml.VoiceResponse();
  twiml.say('Welcome to the Netless Net. Ask anything.');
  twiml.gather({
    input: 'speech',
    action: '/get-resource',
    speechTimeout: 'auto',
    language: 'en-US'
  });
  res.set('Content-Type', 'text/xml');
  res.send(twiml.toString());
})

// talk with ChatGPT
app.post('/get-resource', async (req, res) => {
  console.log("Getting resource...")
  const twiml = new twilio.twiml.VoiceResponse();
  const userSpeech = req.body.SpeechResult;
  const recommendedResult = await getGPTResourceResponse(userSpeech);

  console.log("Recommended result is "+recommendedResult);
  const recommendedOption = recommendedResult.match(/^([^,]*)/)[1];
  const recommendedSearch = recommendedResult.match(/, (.*)/)[1];
  console.log("Recommended Option is "+recommendedOption);
  console.log("Recommended search is "+recommendedSearch);

  switch(true){
    case recommendedOption.includes("chatgpt"):
      console.log("Using ChatGPT");
      twiml.say("Asking ChatGPT, "+recommendedSearch);
      break;
    case recommendedOption.includes("wikipedia"):
      console.log("Using Wikipedia API");
      twiml.say("Looking at Wikipedia for "+recommendedSearch);
      break;
    case recommendedOption.includes("weather"):
      console.log("Using Weather API:");
      twiml.say("Checking the weather in "+recommendedSearch);
      break;
    case recommendedOption.includes("news"):
      console.log("Using News API")
      twiml.say("Looking at news in the topic: "+recommendedSearch);
      break;
    default:
      console.log("The string contains none of those, damn.")
  }
  res.type('text/xml');
  res.send(twiml.toString());
});


// talk with ChatGPT
app.post('/search', async (req, res) => {
  console.log("In Search.")
  const twiml = new twilio.twiml.VoiceResponse();
  const userSpeech = req.body.SpeechResult;
  const chatGPTResponse = await getChatGPTResponse(userSpeech);
  req.session.currentResponse = chatGPTResponse;
  // get user input to read, text, both, or search again.
    const gather = twiml.gather({
    numDigits: 1,
    action: '/process',
    method: 'GET',
    timeout: 5,
    numAttempts: 3,
    loop: 3
    });
    gather.say(
      'Press 1 to read response aloud,' +
      'Press 2 to send response over text' +
      'Press 3 to do both,' +
      'Press 0 to search again'
    );
    res.type('text/xml');
    res.send(twiml.toString());
  });

//process input
app.get('/process', (req, res) => {
  console.log("In Process.")
  const digit = parseInt(req.query.Digits);
  const twiml = new twilio.twiml.VoiceResponse();
  req.session.stringToSay = req.session.currentResponse;
  
  if (digit === 0) {
    twiml.redirect('/start');
  } else if (digit === 1) {
    twiml.redirect('/string-voice');
  } else if (digit === 2) {
    twiml.redirect('/string-text');
  } else {
    twiml.say('Invalid input. Please try again.');
    twiml.redirect('/wiki-search');
  }
  res.type('text/xml');
  res.send(twiml.toString());
});


// (OLD) landing pad for wikipedia functionality
app.post('/wiki-start', (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  twiml.say('Welcome to the Netless Net. What would you like to make a Wikipedia search for?');
  twiml.gather({
    input: 'speech',
    action: '/wiki-search',
    speechTimeout: 'auto',
    language: 'en-US'
  });
  res.set('Content-Type', 'text/xml');
  res.send(twiml.toString());
});


// (OLD) search functionality for wikipedia
app.post('/wiki-search', async (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  const userSpeech = req.body.SpeechResult || req.session.currentQuery;
  req.session.currentQuery = userSpeech;
  const searchResults  = await getWikiResults(userSpeech);
  const articleContent = await getWikiArticleContent(searchResults[0].pageid);
  req.session.articleContent = articleContent;
  // get user input to read, text, both, or search again.
    const gather = twiml.gather({
    numDigits: 1,
    action: '/wiki-process',
    method: 'GET',
    timeout: 5,
    numAttempts: 3,
    loop: 3
    });
    gather.say(
      `Article Title: ${articleContent.title},` +
      'Press 1 to read article aloud,' +
      'Press 2 to receive the article via text,' +
      'Press 3 to do both,' +
      'Press 0 to search again'
    );
    res.type('text/xml');
    res.send(twiml.toString());

  });

//process input
app.get('/wiki-process', (req, res) => {
  const digit = parseInt(req.query.Digits);
  console.log(digit)
  const twiml = new twilio.twiml.VoiceResponse();
  
  if (digit === 0) {
    twiml.redirect('/wiki-start');
  } else if (digit === 1) {
    // todo ugly to put these in all cases, find a better way.
    req.session.stringToSay = req.session.articleContent;
    
    twiml.redirect('/string-voice');
  } else if (digit === 2) {
    req.session.stringToSay = req.session.articleContent;
    twiml.redirect('/string-text');
  } else if (digit === 3) {
    req.session.stringToSay = req.session.articleContent;
    twiml.redirect('/string-voice');
  } else {
    twiml.say('Invalid input. Please try again.');
    twiml.redirect('/wiki-search');
  }
  res.type('text/xml');
  res.send(twiml.toString());
});


// read string to user
app.post('/string-voice', (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  const stringToSay = req.session.stringToSay;

  //break up long content into size deliverable through twilio 
  if(runMode === 'dev') {
    twiml.say("Development message for reading a big string.")
  }
  else{
    var stringsToSay = []
    var max_sbstr = 300
    for (let i = 0; i < stringToSay.length; i += max_sbstr) {
      const currentString = stringToSay.substring(i, i + max_sbstr);
      stringsToSay.push(currentString);
    }
    stringsToSay.forEach(string => twiml.say(string));
  }
  twiml.redirect('/start');
  res.set('Content-Type', 'text/xml');
  res.send(twiml.toString());
});

//text string to user
app.post('/string-text', (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  const stringToSay = req.session.stringToSay;

  //break up long content into size deliverable through twilio 
  if(runMode === 'dev') {
    twiml.say("Development message for texting a big string.")
  }
  else{
    var stringsToSay = []
    var max_sbstr = 300
    for (let i = 0; i < stringToSay.length; i += max_sbstr) {
      const currentString = stringToSay.substring(i, i + max_sbstr);
      stringsToSay.push(currentString);
      const messageNumber = Math.floor(i / max_sbstr) + 1;
      const totalNumber = Math.ceil(stringToSay.length / max_sbstr);
      sendMessageWithDelay(`Message ${messageNumber}/${totalNumber}: ${currentString}`, twilioPhone, testPhone, i * 5000 / max_sbstr);
    }
  }
  res.set('Content-Type', 'text/xml');
  res.send(twiml.toString());
});

// start the server
http.createServer(app).listen(3000, () => {
    console.log('Express server listening on port 3000');
});

// Make the initial outgoing call
client.calls.create({
  url: ngrok_url+'/start',
  to: testPhone,
  from: twilioPhone
})
.then(call => console.log(call.sid))
.catch(error => console.log(error));