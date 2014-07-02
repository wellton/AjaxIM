var o_ = require('../../utils');

// Cookie that stores the session ID
// Will be set as request.sessionID in `authenticate` and `friends` functions
exports.cookie = 'sessionid';

exports.authenticate = function(request, callback, hub) {
    // Verify user based on request.
    // On failure, redirect user to auth form

    callback({
        username: 'username' + (++hub.uid),
        displayname: 'John Smith',
        otherinfo: 'any other relevant key/values'
    });
};

exports.friends = function(request, data, callback, hub) {
    // Create a friends list based on given user data
    callback(o_.values(hub.sessions).map(function(friend) {
        return friend.data('username');
    }));
};