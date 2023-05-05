// endpoint: /route
// 
// function: check user state, which will either be completely unregistered in database,
//           tutorial mode, or pro mode. route to /home if either of the first two,
//           and route to /home-pro if user is in pro-mode. does not say text.

// endpoint: /home
// 
// function: read a rather long introductory string to the netless net. allow users to
//           navigate via button presses:
//            "1" - go to /query
//            "2" - go to /help
//            "3" - go to /try-pro


// endpoint: /query
//
// function: listen for voice query from user, then redirect to /respond endpoint for processing


// endpoint: /respond
//
// function: process query and read response to user. Then allow for the following actions:
//           "1" - go to /respond
//           "2" - send response over text, then self-refer to /respond
//           "0" -  go to /home

// endpoint: /help
// 
// function: read helpful string to user. Then allow for the following actions:
//           "1" - go to /query
//           "2" - send help string over text, then go to /query

// endpoint: /try-pro
// 
// function: explain how pro mode works, then allow for the following actions:
//           "9" - switch to pro mode and go to /home-pro
//           "0" - return to home
//           return home automatically if no response?

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