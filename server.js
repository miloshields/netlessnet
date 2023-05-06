require('dotenv').config();
const http = require('http');
const express = require('express');
const twilio = require('twilio');
const session = require('express-session');

// custom modules
const { getWikiResults, getWikiArticleContent } = require('./requests/wiki-requests.js');
const { getChatGPTResponse, getGPTResourceResponse } = require('./requests/gpt-requests.js')
const { getLocationKey, getWeatherConditions } = require('./requests/weather-requests.js');
const { getNewsSummary } = require('./requests/news-requests.js');
const { MongoClient, ServerApiVersion } = require('mongodb');
const { setUserMode, getUserMode } = require('./helpers/users.js');

const helpString   = "This is the help string before we've actually implemented it.";
const tryProString = "This is the string about pro mode before we've actually implemented it.";

const uri = process.env.MONGO_URI;
const mongoClient = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const testString = ( number ) => {
    return "This is test string number" + number;
}

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

// split into chunks
function chunkString(str, chunkSize) {
    const chunks = [];
    let i = 0;
    while (i < str.length) {
      chunks.push(str.slice(i, i + chunkSize));
      i += chunkSize;
    }
    return chunks;
  }
  

// split message into readable chunks and test them to the user.
function sendLongMessage(message, twilioPhone, testPhone) {
    const CHUNK_SIZE = 160; // maximum chunk size
    const DELAY = 400; // delay between each chunk
    const chunks = chunkString(message, CHUNK_SIZE); // split message into chunks

    let i = 0;
    const sendChunk = () => {
        if (i < chunks.length) {
        const chunk = chunks[i];
        i++;

        sendMessageWithDelay(chunk, twilioPhone, testPhone, DELAY);
        sendChunk(); // schedule next chunk to be sent
        }
    };

    sendChunk(); // start sending chunks
}
  

// endpoint: /route
// 
// function: check user state, which will either be completely unregistered in database,
//           tutorial mode, or pro mode. route to /home if either of the first two,
//           and route to /home-pro if user is in pro-mode. does not say text.
app.post('/route', async (req, res) => {
  console.log("In /route");
  const twiml = new twilio.twiml.VoiceResponse();

  await mongoClient.connect();
  const userMode = await getUserMode(mongoClient, req.body.From);
  let redirectTarget = ""

  switch ( userMode ) {
    case null:
        await setUserMode(mongoClient, req.body.From, 'tutorial');
        req.session.userMode = 'tutorial';
        redirectTarget = '/home';
        break;
    case 'tutorial':
        req.session.userMode = 'tutorial';
        redirectTarget = '/home';
        break;
    case 'pro':
        req.session.userMode = 'pro';
        redirectTarget = '/home-pro';
        break;
    default:
        // you should never really get here
        req.session.userMode = 'tutorial';
        redirectTarget = '/home';
        break;
  }

  // Redirect to the redirectTarget url
  twiml.redirect(redirectTarget);

  res.type('text/xml');
  res.send(twiml.toString());
})

// endpoint: /home
// 
// function: read a rather long introductory string to the netless net. allow users to
//           navigate via button presses:
//            "1" - go to /query
//            "2" - go to /help
//            "3" - go to /try-pro

app.post('/home', (req, res) => {
    console.log("In /home");

    const twiml = new twilio.twiml.VoiceResponse();
  
    twiml.say(testString("Home Endpoint"));
  
    const gather = twiml.gather({
      input: 'dtmf',
      timeout: 10,
      numDigits: 1,
      action: '/process-home'
    });
  
    gather.say('Please make a selection.');

    res.type('text/xml');
    res.send(twiml.toString());
  });

// endpoint: /process-home
// 
// function: route based on user input from /home
//            "1" - go to /query
//            "2" - go to /help
//            "3" - go to /try-pro

app.post('/process-home', (req, res) => {
    console.log("In /process-home");

    const twiml = new twilio.twiml.VoiceResponse();
    const userSelection = req.body.Digits;
    switch (userSelection) {
      case '1':
        twiml.redirect('/query');
        break;
      case '2':
        twiml.redirect('/help');
        break;
      case '3':
        twiml.redirect('/try-pro');
        break;
      default:
        twiml.say('Invalid selection. Please try again.');
        twiml.redirect('/home');
        break;
    }
    res.type('text/xml');
    res.send(twiml.toString());
  });

// endpoint: /query
//
// function: listen for voice query from user, then redirect to /process-query for processing

app.post('/query', (req, res) => {
    console.log("In /query")
    const twiml = new twilio.twiml.VoiceResponse();
    const gather = twiml.gather({
      input: 'speech',
      action: '/respond',
      speechTimeout: 'auto'
    });
    
    gather.say('Please say your query.');
    
    res.type('text/xml');
    res.send(twiml.toString());
  });


// helper function: parseResourceResponse
//
// function: given a query, returns an object with the recommended search resource and the recommended response

async function parseResourceResponse(userSpeech) {
    const recommendedResult = await getGPTResourceResponse(userSpeech);
    const recommendedOption = recommendedResult.match(/^([^,]*)/)[1];
    const recommendedSearch = recommendedResult.match(/, (.*)/)[1];
  
    return { recommendedOption, recommendedSearch };
  }

// helper function: getResponseTutorial
//
// function: given a recommended search mode and search term, use the corresponding api-powered
//           functionality to get the answer and return it as a string

async function getResponseTutorial(recommendedOption, recommendedSearch) {
    let answer = "";
  
    switch (true) {
      case recommendedOption.includes("chatgpt"):
        answer = await getChatGPTResponse(recommendedSearch);
        break;
      case recommendedOption.includes("wikipedia"):
        const searchResults = await getWikiResults(recommendedSearch);
        const articleContent = await getWikiArticleContent(searchResults[0].pageid);
        answer = articleContent.content;
        break;
      case recommendedOption.includes("weather"):
        const locationKey = await getLocationKey(recommendedSearch);
        const weatherConditions = await getWeatherConditions(locationKey);
        if (weatherConditions[0] == 1000) {
          answer = "Looks like we don't have weather information for that right now. Sorry!";
        } else {
          answer = "Looks like the temperature in Fahrenheit is " + weatherConditions[0] + " degrees and the weather is " + weatherConditions[1] + " in " + recommendedSearch;
        }
        break;
      case recommendedOption.includes("news"):
        const newsSummary = await getNewsSummary(recommendedSearch);
        if (newsSummary == "") {
          answer = "Looks like that news search for " + recommendedSearch + " didn't work. Please try again with a more general search term.";
        } else {
          answer = newsSummary;
        }
        break;
      default:
        answer = "No optimal resource identified. Try again.";
    }
  
    return answer;
  }

// endpoint: /respond
//
// function: process query and read response to user. 
//           then gather input for next step and go to /process-respond
//
app.post('/respond', async (req, res) => {
    console.log("In /respond");
    const twiml = new twilio.twiml.VoiceResponse();
    const userSpeech = req.body.SpeechResult;
    console.log("Responding to input: "+userSpeech);
  
    const { recommendedOption, recommendedSearch } = await parseResourceResponse(userSpeech);
    req.session.recommendedSearch = recommendedSearch;
  
    const answer = await getResponseTutorial(recommendedOption, recommendedSearch);
    req.session.lastAnswer = answer;

    const gather = twiml.gather({
      numDigits: 1,
      action: '/process-respond',
      method: 'POST',
      timeout: 5,
      numAttempts: 3,
      loop: 3
    });
    gather.say( answer + 
      'Press 1 to ask another question, ' +
      'Press 2 to send the answer over text.' + 
      'Press anything else to go home.'
    );
    res.type('text/xml');
    res.send(twiml.toString());
  });
  

// endpoint: /process-respond
//
// function: process query and read response to user. Then allow for the following actions:
//           "1" - go to /query
//           "2" - go to /text
//           "0" -  go to /home
app.post('/process-respond', async (req, res) => {
    console.log("In /process-respond")
    const digit = parseInt(req.body.Digits);
    const twiml = new twilio.twiml.VoiceResponse();

    if (digit == 1) {
        twiml.redirect('/query');
    } else if (digit == 2) {
        twiml.redirect('/text');
    } else {
        twiml.say('Returning to the home menu.');
        twiml.redirect('/home');
    }
    res.type('text/xml');
    res.send(twiml.toString());
});

// endpoint: /text
//
// function: texts the last answer to the user in chunks
app.post('/text', (req, res) => {
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say("Texting you that answer - it might take a couple of seconds.")
    const userNumber = req.body.From;
    const message = req.session.lastAnswer;
  
    if (message) {
      sendLongMessage(message, process.env.TWILIO_PHONE_NUMBER, userNumber);
    } 

    twiml.redirect('/home');
    res.type('text/xml');
    res.send(twiml.toString());
  });

// endpoint: /help
// 
// function: read helpful string to user. Then gather digit input and redirect to process-help
app.post('/help', (req, res) => {
    const twiml = new twilio.twiml.VoiceResponse();
  
    const gather = twiml.gather({
      numDigits: 1,
      action: '/process-help',
      method: 'POST',
      timeout: 5,
      numAttempts: 3,
      loop: 3
    });

    //TODO figure out right way to get this string
    gather.say(helpString);
  
    res.type('text/xml');
    res.send(twiml.toString());
  });

// endpoint: /process-help
//           redirects according to last digit entered:
//           "1" - go to /query
//           "2" - send help string over text, then go to /query

app.post('/process-help', async (req, res) => {
  const digit = parseInt(req.query.Digits);
  const twiml = new twilio.twiml.VoiceResponse();

  if (digit === 1) {
    twiml.redirect('/query');
  } else if (digit === 2) {
    // TODO figure out the right way to get this string
    sendLongMessage(helpString, process.env.TWILIO_PHONE_NUMBER, req.body.From);
    twiml.redirect('/home');
  } else {
    twiml.say('Invalid input. Please try again.');
    twiml.redirect('/help');
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

// endpoint: /try-pro
// 
// function: explain how pro mode works, then allow for the following actions:
//           "9" - switch to pro mode and go to /home-pro
//           "0" - return to home
//           return home automatically if no response?
app.post('/try-pro', (req, res) => {
    console.log("In /try-pro")
    const twiml = new twilio.twiml.VoiceResponse();
  
    const gather = twiml.gather({
      numDigits: 1,
      action: '/process-try-pro',
      method: 'POST',
      timeout: 5,
      numAttempts: 3,
      loop: 3
    });

    //TODO figure out right way to get this string
    gather.say(tryProString);
  
    res.type('text/xml');
    res.send(twiml.toString());
  });

// endpoint: /process-try-pro
app.post('/process-try-pro', async (req, res) => {
    const digit = req.body.Digits;
    const twiml = new twilio.twiml.VoiceResponse();
    console.log("Digit is "+ digit)
  
    if (digit == 9) {
      console.log("Changing user mode to pro.")
      req.session.userMode = "pro"
      twiml.redirect('/home-pro');
    } else {
      // Replace with string from object.
      twiml.say('Going Home. Feel free to try Pro again anytime.');
      twiml.redirect('/home');
    }
    res.type('text/xml');
    res.send(twiml.toString());
  });

// endpoint: /home-pro
//
// function: text pro capabilities, say very short string on welcome to pro mode. Should be much more conversational, nothing spelled out.
//          listen for speech, then pass to /parse-pro

// endpoint: /parse-pro
//
// function: use GPT to determine if speech can be categorized into a special phrase, listed below, or if it is an actual query
//           phrase categories:
//              "text me"  - go to /text-pro
//              "tutorial" - switch to tutorial mode, go to /home
//              "help"     - go to /help-pro
//              <actual question> - go to respond-pro

// endpoint: /respond-pro
//
// function: use GPT to respond to the active query, then read it out to the user
//           pass any speech input to parse-pro (allow it to interrupt)

// endpoint: /text-pro
//
// function: text the most recent response, pass any speech input to /parse-pro

// start the server
http.createServer(app).listen(8000, () => {
    console.log('Express server listening on port 8000');
});