var express = require('express')
var bodyParser = require('body-parser')
var request = require('request')
var mongodb = require('mongodb')
const crypto = require('crypto');
var app = express()
var promise = require('promise')
var Imap = require('imap'),
    inspect = require('util').inspect;

app.set('port', (process.env.PORT || 5000))

var URI = "mongodb://heroku_4lzr58pg:ltfaumlgu4lrnmnu8r8rmqkf3m@ds151697.mlab.com:51697/heroku_4lzr58pg"
var FB_TOKEN = "EAAPUW3ZAR8yoBALLNeTBMu3cYMFwOE2IL1KNHjwtsZCwqtgUZColj73n7Wbgfx9eiZBKKQusFxkA5FOHm37750ezSa2TZCQZB0lDL6QQs3UZCsMjuUUfNCnmNDyXPSZB6VRZAsRdYZAHdSenyaOlZC2PTrWfKof0vfnkn0xwQfDCMAHDQZDZD"

var MongoClient = require('mongodb').MongoClient, assert = require('assert');

// Process application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended: false}))

// Process application/json
app.use(bodyParser.json())

// Index route
app.get('/', function (req, res) {
    res.send('Hello world, I am a chat bot')
})

// Spin up the server
app.listen(app.get('port'), function() {
    console.log('running on port', app.get('port'))
})

app.post('/webhook/', function (req, res) {

    // Use connect method to connect to the server
    MongoClient.connect(URI, function(err, db) {

        messaging_events = req.body.entry[0].messaging
        for (i = 0; i < messaging_events.length; i++) {
            event = req.body.entry[0].messaging[i]
            sender = event.sender.id

            // Check if message is valid
            if (event.message && event.message.text) {

            	// Check user's sessionid
            	var sessionid;

                getOrCreateSessionId(db, sender).then( function(result) {
                    sessionid = result;

                    console.log('The sessionid is: %d', sessionid);
		    var hash = crypto.createHash('sha256').update(sender).digest('base64');
			
                    // Case 1: First time speaking to Emaily
                    if (sessionid == 0) {
                        sendTextMessage(sender, "Hi, I'm Emaily! Your personal email assistant. I can help you check your email, create templates to respond to emails, and set reminders to respond to mail. What's would you like me to call you?");

                    	console.log("i just finished sending a message");

                        db.collection('users').update({userId: hash}, {$set:{sessionId: 1}}, function(err, result) {
                            if (err) {
                                console.log(err);
                            } else {
                                console.log("FINALLY");
                            }
                        });

                        console.log("i finished updating");

                    } else if(sessionid == 1) {
                    	db.collection('users').update(
						   { userId: hash },
						   {
						   		userId: hash,
						   		name: event.message.text,
						   		sessionId: 2
						   }
						)
                    	sendTextMessage(sender, "It's nice to meet you " + event.message.text + "! To get started, please follow the link and sign up.")
                    	sendBubbleMessage(sender);
                    	db.close();
					} else if(sessionid == 2) {
						checkEmailForUnread(db, sender);
					} else {
                        console.log("I'm sorry I didn't understand that.")
                    }
                }, function(error) {
                    console.log(error)
                }) 
	        }

            // if (event.message && event.message.text) {
            //     text = event.message.text
            //     sendTextMessage(sender, "Text received, echo: " + text.substring(0, 200))
            // }
        }
        res.sendStatus(200)
    });
})

function sendBubbleMessage(sender) {
     var messageData = {
        'attachment': {
            'type': 'template',
            'payload': {
                'template_type': 'generic',
                'elements': [{
                    'title': 'Log In',
                    'subtitle': 'Enter your credentials',
                    'buttons': [{
                        'type': 'web_url',
                        'url': 'www.hiemaily.com/#' + sender,
                        'title': 'Log In Page'
                    }, {
                        'type': 'postback',
                        'title': 'Log In',
                        'payload': 'Log in'
                    }]
                }]
            }
        }
    }
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token:FB_TOKEN},
        method: 'POST',
        json: {
            recipient: {id:sender},
            message: messageData,
        }
    }, function(error, response, body) {
        if (error) {
            console.log('Error sending messages: ', error)
        } else if (response.body.error) {
            console.log('Error: ', response.body.error)
        }
    })
}

function sendTextMessage(sender, text) {
    messageData = {
        text:text
    }
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token:FB_TOKEN},
        method: 'POST',
        json: {
            recipient: {id:sender},
            message: messageData,
        }
    }, function(error, response, body) {
        if (error) {
            console.log('Error sending messages: ', error)
        } else if (response.body.error) {
            console.log('Error: ', response.body.error)
        }
    })
}

function getOrCreateSessionId(db, sender) {
    return new Promise(
        function (resolve, reject) {
            console.log('I am in get or create session id');

            // Gets collection of users from main database
            var users = db.collection('users');

	    var hash = crypto.createHash('sha256').update(sender).digest('base64');
            users.find( { userId: hash } ).toArray(function (err, result) {
                if (err) {
                    console.log(err);
                    return reject(err);
                } else if (result.length) {
                    console.log('User already exists in database');
                    console.log(result);
                    return resolve(result[0].sessionId);
                } else {
                    console.log('No user found! Creating a new user in the database');

                    users.insert({ userId: hash, sessionId: 0 }, function (err, result) {
                      if (err) {
                        console.log(err);
                      } else {
                        console.log('User created');
                      }
                    });

                    return resolve(0);
                 }
            })
        }
    );
}

// This method should
function checkEmailForUnread(db, sender) {
	return new Promise(
		MongoClient.connect(URI, function(err, db) {
		var hash = crypto.createHash('sha256').update(sender).digest('base64');
		function (resolve, reject) {
			var users = db.collection('users');
            console.log('I am in promise');
			users.find( { userId: hash } ).toArray(function (err, usrdata) {
                console.log('I found the userdata');
                console.log(usrdata);
				if(err) {
					console.log(err);
					return reject(err);
				} else if (usrdata.length) {
                    console.log('I found the userdata')

					var imap = new Imap({
						user: usrdata[0].email,
						password: usrdata[0].password,
						host: 'imap.gmail.com',
						port: 993,
						tls: true
					});

                    console.log('I made an imap');

					function openInbox(cb) {
                      imap.openBox('INBOX', true, cb);
                    }

                    imap.once('ready', function() {
                        openInbox(function(err, box) {
                            if (err) throw err;
                            var f = imap.seq.fetch('1:3', {
                            bodies: 'HEADER.FIELDS (FROM TO SUBJECT DATE)',
                            struct: true
                        });
                        f.on('message', function(msg, seqno) {
                          console.log('Message #%d', seqno);
                          var prefix = '(#' + seqno + ') ';
                          msg.on('body', function(stream, info) {
                            var buffer = '';
                            stream.on('data', function(chunk) {
                              buffer += chunk.toString('utf8');
                            });
                            stream.once('end', function() {
                              console.log(prefix + 'Parsed header: %s', inspect(Imap.parseHeader(buffer)));
                            });
                          });
                          msg.once('attributes', function(attrs) {
                            console.log(prefix + 'Attributes: %s', inspect(attrs, false, 8));
                          });
                          msg.once('end', function() {
                            console.log(prefix + 'Finished');
                          });
                        });
                        f.once('error', function(err) {
                          console.log('Fetch error: ' + err);
                        });
                        f.once('end', function() {
                          console.log('Done fetching all messages!');
                          imap.end();
                        });
                      });
                    });

                    imap.once('error', function(err) {
                      console.log(err);
                    });

                    imap.once('end', function() {
                      console.log('Connection ended');
                    });

                    imap.connect();
				}
			});
			db.close();
		}}
	);
}

function createDate(num) {
	return new Promise(
		function(resolve, reject) {
			var monthNames = ["January ", "February ", "March ", "April ", "May ", "June ",
			  "July ", "August ", "September ", "October ", "November ", "December "];
			
			var date = new Date();
			
			date.setDate(date.getDate() - num);
			
			var cdate = monthNames[date.getMonth()];
				
			cdate += date.getDate().toString() + ", ";
			cdate += date.getFullYear().toString();
			return resolve(cdate);
		}
	);
}

