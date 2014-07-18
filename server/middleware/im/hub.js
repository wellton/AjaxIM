var events = require('events'),
    sys = require('sys'),
    packages = require('../../libs/packages'),
    o_ = require('../../libs/utils'),
    User = require('./user');

var Hub = module.exports = function Hub(options) {
    this.uid = 0;
    this.events = new events.EventEmitter();
    this.auth = options.authentication;
    this.sessions = {};

    this.maxAge = options.maxAge || 4 * 60 * 60 * 1000;
    this.reapInterval = options.reapInterval || 60 * 1000;

    if(this.reapInterval !== -1) {
        setInterval(function(self) {
            self.reap(self.maxAge);
        }, this.reapInterval, this);
    }

    this.events.addListener('update', o_.bind(function(event) {
        if(event.type == 'status' && event.status == 'offline') {
            var sids = Object.keys(this.sessions), sid, sess;
            for(sid in this.sessions) {
                sess = this.sessions[sid];
                if(sess.data('username') == event.from) {
                    if(sess.listeners.length)
                        sess.send({type: 'goodbye'});
                    delete this.sessions[sid];
                    break;
                }
            }
        }
    }, this));
};

Hub.prototype.destroy = function(sid, fn) {
    this.set(sid, null, fn);
};

Hub.prototype.reap = function(ms) {
    var threshold = +new Date - ms,
        sids = Object.keys(this.sessions);
    for(var i = 0, len = sids.length; i < len; ++i) {
        var sid = sids[i], sess = this.sessions[sid];
        if(sess.lastAccess < threshold) {
            var event = {type: 'status', from: sess.data('username'), status: 'offline', message: ''};
            this.events.emit('update', event);
            delete this.sessions[sid];
            sess.close();
        }
    }
};

Hub.prototype.get = function(req, fn) {
    if(this.sessions[req.sessionID]) {
        if (!this.sessions[req.sessionID].req) {
            this.sessions[req.sessionID].req = req;
        }
        fn(null, this.sessions[req.sessionID]);
    } else {
        this.auth.authenticate(req, o_.bind(function(data) {
            if(data) {
                var session = new User(req, data);
                if (req.socketio) {
                    session.socketio = req.socketio;
                }
                this.set(req.sessionID, session);

                this.auth.friends(req, data, o_.bind(function(friends) {
                    var friends_copy = friends.slice();
                    o_.values(this.sessions).filter(function(friend) {
                        return ~friends.indexOf(friend.data('username'));
                    }).forEach(function(friend) {
                        var username = friend.data('username');
                        friends_copy[friends_copy.indexOf(username)] =
                                            [username, friend.status()];
                    }, this);

                    session._friends(friends_copy);
                    session.events.addListener('status',
                        o_.bind(function(value, message) {
                            var event = {type: 'status', from: session.data('username'), status: value, message: message};
                            this.events.emit('update', event);
                        }, this));
                    this.events.addListener('update',
                                      o_.bind(session.receivedUpdate, session));
                    this.set(req.sessionID, session);
                    fn(null, session);
                }, this), this);
                session.status(null, {status: packages.STATUSES[0], message: ''});
            } else {
                fn();
            }
        }, this), this);
    }
};

Hub.prototype.set = function(sid, sess, fn) {
    this.sessions[sid] = sess;
    fn && fn();
};

Hub.prototype.find = function(username, fn) {
    for(var sid in this.sessions) {
        var session = this.sessions[sid],
            sess_username = session.data('username');
        if(sess_username == username) {
            fn(session);
            return;
        }
    }
    fn(false);
};

Hub.prototype.message = function(res, to, event) {
    try {
        to.send(event);
        event._status = {sent: true};
        if (res) {
            res.jsonp(event);
        } else {
            this.find(event.from, function(from) {
                from.socketio.emit('client', event);
            });
        }
    } catch(e) {
        event._status = {sent: false, e: e.description};
        res.jsonp(event);
    }
};

Hub.prototype.signOff = function(sid, res, event) {
    if (sid in this.sessions) {
        event.status = 'offline';
        event.message = '';
        this.events.emit('update', event);
    }
    event._status = {sent: true};
    if (res) {
        res.jsonp(event);
    }
};
