var url = require('url'),
    Hub = require('./im/hub'),
    o_ = require('../libs/utils');

module.exports = function setupHub(options) {
    options = options || {};

    store = new Hub(options);

    return {hub: store, session: function session(req, res, next) {
        req.sessionStore = store;

        req.sessionID = req.param('sessionid');

        if(url.parse(req.url).pathname.substring(0, 5) !== '/app/') {
            next();
            return;
        }

        if(req.sessionID) {
            store.get(req, function(err, sess) {
                if(err) {
                    next(err);
                    return;
                }

                if(!sess) {
                    next(new Error(JSON.stringify({
                                        type: 'error',
                                        error: 'not authenticated'})));
                    return;
                }

                sess.touch();
                if(url.parse(req.url).pathname === '/app/listen') {
                    req.connection.setTimeout(5 * 60 * 1000);
                    sess.listener(res);
                    store.set(req.sessionID, sess);

                    if(msg = sess.message_queue.shift())
                        sess._send.apply(sess, msg);
                } else {
                    req.event = o_.extend({}, req.query, req.body, req.params);
                    o_.deletekey(req.event, 'callback');
                    o_.deletekey(req.event, 'sessionid');
                    o_.deletekey(req.event, '_');
                    req.event.from = sess.data('username');
                }

                req.session = sess;
                res.session = sess;
                res.find = store.find.bind(store);
                res.message = function(to, event) {
                    store.message(res, to, event);
                };
                res.status = function(event) {
                    req.session.status(res, event);
                };
                res.signOff = function(event) {
                    store.signOff(req.sessionID, res, event);
                };

                if(url.parse(req.url).pathname !== '/app/listen') {
                    next();
                }
            });
        } else {
            next(new Error(JSON.stringify({
                                        type: 'error',
                                        error: 'not authenticated'})));
        }
    }};
};
