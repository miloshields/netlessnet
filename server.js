require('dotenv').config();
const http = require('http');
const express = require('express');
const twilio = require('twilio');
const session = require('express-session');

// custom modules
const { getWikiResults, getWikiArticleContent } = require('./requests/wiki-requests.js');
const { getChatGPTResponse, getGPTResourceResponse } = require('./requests/gpt-requests.js')
const { getLocationKey, getWeatherConditions } = require('./requests/weather-requests');
const { getNewsSummary } = require('./requests/news-requests.js');

const { MongoClient, ServerApiVersion } = require('mongodb');
const { checkIfUserExists, registerUser } = require('./requests/users.js');

const uri = process.env.MONGO_URI;
const mongoClient = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
// async function main () {
//   await mongoClient.connect();
//   const collections = await mongoClient.db("admin").listCollections().toArray();
//   console.log("Collections:\n"+collections);
// }
// main();


const runMode       = process.argv.slice(2)[0] || 'dev';
const accountSid    = process.env.TWILIO_ACCOUNT_SID;
const authToken     = process.env.TWILIO_AUTH_TOKEN;
const twilioPhone   = process.env.TWILIO_PHONE_NUMBER;
const sessionSecret = process.env.EXPRESS_SESSION_SECRET;

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
app.post('/start', async (req, res) => {
  console.log("In Start.")
  const twiml = new twilio.twiml.VoiceResponse();
  await mongoClient.connect();

  if( await checkIfUserExists(mongoClient, req.body.From)) {
    twiml.say("The user is in the system.");
  }
  else {
    twiml.say("The user is not yet in the system");
    await registerUser(mongoClient, req.body.From)
  }

  twiml.say('Welcome to the Netless Net. You can ask anything.');
  twiml.gather({
    input: 'speech',
    action: '/get-resource',
    speechTimeout: 'auto',
    language: 'en-US'
  });
  res.set('Content-Type', 'text/xml');
  res.send(twiml.toString());
})

// get recommended resource based on output of the text-davinci-003 model
app.post('/get-resource', async (req, res) => {
  console.log("Getting resource...")
  const twiml = new twilio.twiml.VoiceResponse();
  const userSpeech = req.body.SpeechResult;
  console.log(userSpeech);
  const recommendedResult = await getGPTResourceResponse(userSpeech);
  const recommendedOption = recommendedResult.match(/^([^,]*)/)[1];
  const recommendedSearch = recommendedResult.match(/, (.*)/)[1];
  req.session.recommendedSearch = recommendedSearch;

  // recommendedResult expected form: "chatgpt, who is barack obama"
  console.log(recommendedResult);
  switch(true){
    case recommendedOption.includes("chatgpt"):
      req.session.recommendedSearch = userSpeech;
      console.log("Using ChatGPT");
      console.log("Recommended search is "+req.session.recommendedSearch)
      twiml.say("Asking ChatGPT, "+req.session.recommendedSearch +".");
      req.session.resourceMode = "chatgpt"
      break;
    case recommendedOption.includes("wikipedia"):
      console.log("Using Wikipedia API");
      twiml.say("Looking up "+recommendedSearch+" on Wikipedia.");
      req.session.resourceMode = "wikipedia"
      break;
    case recommendedOption.includes("weather"):
      console.log("Using Weather API:");
      twiml.say("Checking the weather in "+recommendedSearch);
      req.session.resourceMode = "weather"
      break;
    case recommendedOption.includes("news"):
      console.log("Using News API")
      twiml.say("Looking at news in the topic: "+recommendedSearch);
      req.session.resourceMode = "news"
      break;
    default:
      console.log("No optimal resource identified. Try again.")
  }
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
      'Press 2 to send response over text, ' +
      'Press 0 to search again, '
    );
  res.type('text/xml');
  res.send(twiml.toString());
});

//process input
app.get('/process', async (req, res) => {
  switch(req.session.resourceMode) {
    case "chatgpt":
      console.log("Using Resource ChatGPT (in process function)")
      const result = await getChatGPTResponse(req.session.recommendedSearch);
      req.session.stringToSay = result;
      break;
    case "wikipedia":
      const searchResults  = await getWikiResults(req.session.recommendedSearch);
      const articleContent = await getWikiArticleContent(searchResults[0].pageid);
      console.log(searchResults)
      console.log(articleContent)
      req.session.stringToSay = articleContent.content;
      console.log("Using Resource Wikipedia (in process function)")
      break;
    case "weather":
      const locationKey = await getLocationKey(req.session.recommendedSearch);
      const weatherConditions = await getWeatherConditions(locationKey);
      if(weatherConditions[0] == 1000) {
        req.session.stringToSay = "Looks like we don't have weather information for that right now. Sorry!";
        console.log("Bad weather request.");
        break;
      }
      else{
        req.session.stringToSay = "Looks like the temperature in Fahrenheit is "+weatherConditions[0] + " degrees and the weather is "+weatherConditions[1]+ " in " + req.session.recommendedSearch;
        console.log("Good weather request.");
        break;
      }
    case "news":
      const newsSummary = await getNewsSummary(req.session.recommendedSearch);
      console.log("Received request from news:\n"+newsSummary);
      if ( newsSummary == ""){
        req.session.stringToSay = "Looks like that news search for "+recommendedSearch +" didn't work. Please try again with a more general search term.";
      }
      else {
        req.session.stringToSay = newsSummary;
        break;
      }
    default:
      req.session.stringToSay = "No valid resource recognized. Please try again."
  }
  const digit = parseInt(req.query.Digits);
  const twiml = new twilio.twiml.VoiceResponse();
  console.log("Digit is "+digit)
  
  if (digit === 0) {
    console.log("Digit is 0 for no reason lol")
    twiml.redirect('/start');
  } else if (digit === 1) {
    console.log("In Digit 1")
    req.session.readMode = "voice";
    twiml.redirect('/string-voice');
  } else if (digit === 2) {
    req.session.readMode = "text"
    twiml.redirect('/string-text');
  } else {
    twiml.say('Invalid input. Please try again.');
    twiml.redirect('/get-resource');
  }
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
  console.log("In string voice function")
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
  twiml.redirect('/after-answer');
  res.set('Content-Type', 'text/xml');
  res.send(twiml.toString());
});

app.post('/after-answer', (req, res) => {
  console.log("Readmode in after-answer is "+ req.session.readMode);
  const twiml = new twilio.twiml.VoiceResponse();
  const gather = twiml.gather({
    numDigits: 1,
    action: '/process-after-answer',
    method: 'GET',
    timeout: 5,
    numAttempts: 3,
    loop: 3
    });
    gather.say(
      'Press 1 to read/text response again,' +
      'Press 0 to search again'
    );
  res.type('text/xml');
  res.send(twiml.toString());
})

//process input
app.get('/process-after-answer', async (req, res) => {
  console.log("Readmode in process-after-answer is "+ req.session.readMode);
  const digit = parseInt(req.query.Digits);
  const twiml = new twilio.twiml.VoiceResponse();
  
  if (digit === 0) {
    console.log("HERE????")
    twiml.redirect('/start');
  } else if (digit === 1) {
    if(req.session.readMode === "text") {
      console.log("I think I'll text it...")
      twiml.redirect('/string-text');
    }
    else if (req.session.readMode === "voice") {
      twiml.redirect('/string-voice');
    }
  } else {
    twiml.say('Invalid input. Please try again.');
    twiml.redirect('/get-resource');
  }
  res.type('text/xml');
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
      sendMessageWithDelay(`Message ${messageNumber}/${totalNumber}: ${currentString}`, twilioPhone, req.body.From, i * 5000 / max_sbstr);
    }
  }
  twiml.say("You should be receiving your answer via text. Please hold.")
  twiml.redirect('/after-answer')
  res.set('Content-Type', 'text/xml');
  res.send(twiml.toString());
});

// start the server
http.createServer(app).listen(8000, () => {
    console.log('Express server listening on port 8000');
});