var o_ = require('../../utils');

exports.authenticate = function(request, callback, hub) {
    // Verify user based on request.
    // On failure, redirect user to auth form
    var username = request.from;
    if (!username) {
        username = 'username' + (++hub.uid);
    }
    callback({
        username: username,
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