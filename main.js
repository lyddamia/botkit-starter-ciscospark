
var env = require('node-env-file');
env(__dirname + '/.env');

// **** BOTKIT START ****

if (!process.env.access_token) {
    console.log('Error: Specify a Cisco Spark access_token in environment.');
    usage_tip();
    process.exit(1);
}

if (!process.env.public_address) {
    console.log('Error: Specify an SSL-enabled URL as this bot\'s public_address in environment.');
    usage_tip();
    process.exit(1);
}

var Botkit = require('botkit');
var debug = require('debug')('botkit:main');

// Create the Botkit controller, which controls all instances of the bot.
var controller = Botkit.sparkbot({
    // debug: true,
    // limit_to_domain: ['mycompany.com'],
    // limit_to_org: 'my_cisco_org_id',
    public_address: process.env.public_address,
    ciscospark_access_token: process.env.access_token,
    studio_token: process.env.studio_token, // get one from studio.botkit.ai to enable content management, stats, message console and more
    secret: process.env.secret, // this is an RECOMMENDED but optional setting that enables validation of incoming webhooks
    webhook_name: 'Cisco Spark bot created with Botkit, override me before going to production',
    studio_command_uri: process.env.studio_command_uri,
});

// Set up an Express-powered webserver to expose oauth and webhook endpoints
var webserver = require(__dirname + '/components/express_webserver.js')(controller);

// Tell Cisco Spark to start sending events to this application
require(__dirname + '/components/subscribe_events.js')(controller);


// **** BOTKIT END ****

// **** GREETINGS START *****

controller.hears(['hi','hello'], 'direct_message,direct_mention', function (bot, message) {
    bot.reply(message, 'Hi, <@personEmail:' + message.user + '>! ' + intro_msg);
});

controller.hears('help', 'direct_message,direct_mention', function (bot, message) {
    bot.reply(message, 'Hi, <@personEmail:' + message.user + '>! ' + help_msg);
});

controller.on('user_space_join', function (bot, message) {
    bot.reply(message, 'Welcome <@personEmail:' + message.user + '>! ' + intro_msg);
});

var intro_msg = 'I am **Teddy**, your To-Do List Assistant. Say `help` to learn more about how I work.'

var help_msg = '\n\nTo add a task, type `add _task_`. \n\n To show to-do list, type `todo`.' +
                '\n\n To mark a task complete, type `done _number_`. \n\nDon\'t forget to mention me! Enjoy!'
              

// **** GREETINGS END ****


// **** TO DO LIST START ****

// show to do list
    controller.hears(['task','todo'], 'direct_message,direct_mention', function(bot, message) {
        controller.storage.users.get(message.user, function(err, user) {
            if (!user || !user.tasks || user.tasks.length == 0) {
                bot.reply(message, empty_msg);
                } else {
                bot.reply(message, 'Here is your To-Do List, <@personEmail:' + message.user + '>: \n' + generateTaskList(user) + '\n\nReply with `done _number_` to mark a task completed.');
            }
            });
        });

      
// add task
    controller.hears(['add (.*)'],'direct_message,direct_mention', function(bot, message) {

        var newtask = message.match[1];

        controller.storage.users.get(message.user, function(err, user) {
            if (!user) {
                user = {};
                user.id = message.user;
                user.tasks = [];
            }

            user.tasks.push(newtask);

            controller.storage.users.save(user, function(err,saved) {

                if (err) {
                    bot.reply(message, 'I experienced an error adding your task: ' + err);
                } else {
                    bot.reply(message,'Got it, <@personEmail:' + message.user + '>.' + ' \n\nTo-Do List:\n\n' + generateTaskList(user));
                }
            });
        });
    });

// mark task done
    controller.hears(['done (.*)'],'direct_message,direct_mention', function(bot, message) {

        var number = message.match[1];

        if (isNaN(number)) {
            bot.reply(message, 'Please specify a number.');
        } else {

            number = parseInt(number) - 1;

            controller.storage.users.get(message.user, function(err, user) {
                if (!user) {
                    user = {};
                    user.id = message.user;
                    user.tasks = [];
                }

                if (number < 0 || number >= user.tasks.length) {
                    bot.reply(message, 'Sorry, your input is out of range. Right now there are ' 
                    + user.tasks.length + ' items on your list.');
                } else {
                    var item = user.tasks.splice(number,1);
                    bot.reply(message, 'Good job, <@personEmail:' + message.user + '>! ~' + item + '~ task complete.');
                    if (user.tasks.length > 0) {
                        bot.reply(message, 'Here is your current To-Do List: \n\n' + generateTaskList(user) + '\n\nReply with `done _number_` to mark a task completed.');
                    } else {
                        bot.reply(message, empty_msg);
                    }
                }
            });
        }
    });

// remove task 
controller.hears(['remove (.*)'],'direct_message,direct_mention', function(bot, message) {

    var number = message.match[1];

    if (isNaN(number)) {
        bot.reply(message, 'Please specify a number.');
    } else {

        number = parseInt(number) - 1;

        controller.storage.users.get(message.user, function(err, user) {
            if (!user) {
                user = {};
                user.id = message.user;
                user.tasks = [];
            }

            if (number < 0 || number >= user.tasks.length) {
                bot.reply(message, 'Sorry, your input is out of range. Right now there are ' 
                + user.tasks.length + ' items on your list.');
            } else {
                var item = user.tasks.splice(number,1);
                bot.reply(message, 'Task ~' + item + '~ has been removed, <@personEmail:' + message.user + '>.');
                if (user.tasks.length > 0) {
                    bot.reply(message, 'Here is your current To-Do List: \n\n' + generateTaskList(user) + '\n\nReply with `done _number_` to mark a task completed.');
                } else {
                    bot.reply(message, empty_msg);
                }
            }
        });
    }
});

// assign task to different user
controller.hears(['assign (.*)'], 'direct_message,direct_mention', function(bot, message) {

    var assigntask = message.match[1];

    bot.startConversation(message, function(err, convo) {
        convo.say('This is an example of using convo.ask with a single callback.');

        convo.ask('Who do you want to assign to task ~' + assigntask + '~? Type `receipient _user_`', function(response, convo) {
            
            controller.storage.users.get(response.user, function(err, user) {
                if (!user) {
                    user = {};
                    user.id = response.user;
                    user.tasks = [];
                }
    
                user.tasks.push(assigntask);
    
                controller.storage.users.save(user, function(err,saved) {
    
                    if (err) {
                        convo.say(message, 'I experienced an error assigning task: ' + err);
                    } else {
                        convo.say(message,'Got it, <@personEmail:' + message.user + '>. Task ~' + assigntask + 'has been assigned to ' + response.user 
                        + '. \n\nTo-Do List:\n\n' + generateTaskList(response.user));
                    }
                });
            });
            //convo.say('Cool, I like ' + response.text + ' too!');
            convo.next();

        });
    });

});

// to do list generator
    function generateTaskList(user) {

        var text = '';

        for (var t = 0; t < user.tasks.length; t++) {
            text = text + '> `' +  (t + 1) + '`) ' +  user.tasks[t] + ' \n\n ';
        }
        return text;
    }

var empty_msg = 'Your to-do list is empty.'


// **** TO DO LIST END ****

// This captures and evaluates any message sent to the bot as a DM
// or sent to the bot in the form "@bot message" and passes it to
// Botkit Studio to evaluate for trigger words and patterns.
// If a trigger is matched, the conversation will automatically fire!
// You can tie into the execution of the script using the functions
// controller.studio.before, controller.studio.after and controller.studio.validate
if (process.env.studio_token) {
    controller.on('direct_message,direct_mention', function(bot, message) {
        if (message.text) {
            controller.studio.runTrigger(bot, message.text, message.user, message.channel, message).then(function(convo) {
                if (!convo) {
                    // no trigger was matched
                    // If you want your bot to respond to every message,
                    // define a 'fallback' script in Botkit Studio
                    // and uncomment the line below.
                    controller.studio.run(bot, 'fallback', message.user, message.channel, message);
                } else {
                    // set variables here that are needed for EVERY script
                    // use controller.studio.before('script') to set variables specific to a script
                    convo.setVar('current_time', new Date());
                }
            }).catch(function(err) {
                if (err) {
                    bot.reply(message, 'I experienced an error with a request to Botkit Studio: ' + err);
                    debug('Botkit Studio: ', err);
                }
            });
        }
    });
} else {
    console.log('~~~~~~~~~~');
    console.log('NOTE: Botkit Studio functionality has not been enabled');
    console.log('To enable, pass in a studio_token parameter with a token from https://studio.botkit.ai/');
}

function usage_tip() {
    console.log('~~~~~~~~~~');
    console.log('Botkit Studio Starter Kit');
    console.log('Execute your bot application like this:');
    console.log('access_token=<MY ACCESS TOKEN> public_address=<https://mybotapp/> node bot.js');
    console.log('Get Cisco Spark token here: https://developer.ciscospark.com/apps.html')
    console.log('Get a Botkit Studio token here: https://studio.botkit.ai/')
    console.log('~~~~~~~~~~');
}
