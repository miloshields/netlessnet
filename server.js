require('dotenv').config();
const twilio = require('twilio');

const accountSid  = process.env.TWILIO_ACCOUNT_SID;
const authToken   = process.env.TWILIO_AUTH_TOKEN;
const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
const testPhone   = process.env.TEST_PHONE_NUMBER;
const binUrl      = process.env.TWILIO_BIN_URL;

// Initialize Twilio client
const client = require('twilio')(accountSid, authToken);

// Generate a random number between 1 and 100
const randomNumber = Math.floor(Math.random() * 100) + 1;

// Create a TwiML response with a <Say> verb that speaks the random number
const twiml = new twilio.twiml.VoiceResponse();
twiml.say(`Your random number is ${randomNumber}`);

// Make an outgoing call with Twilio and pass the TwiML response as a parameter
client.calls.create({
    twiml: twiml.toString(),
    to: testPhone,
    from: twilioPhone
  })
  .then(call => console.log(`Started call: ${call.sid}`));
