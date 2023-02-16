require('dotenv').config();

const accountSid  = process.env.TWILIO_ACCOUNT_SID;
const authToken   = process.env.TWILIO_AUTH_TOKEN;
const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
const testPhone   = process.env.TEST_PHONE_NUMBER;
const binUrl      = process.env.TWILIO_BIN_URL;

const client = require('twilio')(accountSid, authToken);

client.calls
  .create({
    from: twilioPhone,
    to: testPhone,     
    url: binUrl
  })
  .then(call => console.log(call.sid));
