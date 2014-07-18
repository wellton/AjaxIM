var events = require('events'),
    packages = require('../../libs/packages'),
    o_ = require('../../libs/utils');

var User = module.exports = function(req, data) {
    this.req = req;
    this.id = req.sessionID;
    this.connection = null;
    this.listeners = [];
    this.message_queue = [];
    this.convos = {};
    this._data = data;

    this.events = new events.EventEmitter();
    this._status = packages.STATUSES[0];
    this._status_message = '';

    this.interval = setInterval(o_.bind(this._expireConns, this), 500);
};

User.prototype.close = function() {
   clearInterval(this.interval);
   var conn,
   noop = JSON.stringify({type: 'noop'}),
   noop_headers = {
       'Content-Type': 'application/json',
       'Content-Length': noop.length
   };
   for(var i = this.listeners.length-1; i >= 0; i--) {
       conn = this.listeners[i].connection;
       this.listeners[i].writeHead(200, noop_headers);
       this.listeners[i].end(noop);
   }
};

User.prototype.receivedUpdate = function(event) {
    event = o_.extend({}, event);
    event.to = this.data('username');
    if(this.friends.indexOf(event.from))
        this.send(event);
};

User.prototype._friends = function(friends) {
    this.friends = friends;
    this.send({
        type: 'hello',
        username: this.data('username'),
        friends: friends
    });
};

User.prototype._expireConns = function() {
    var conn,
        noop = JSON.stringify({type: 'noop'}),
        noop_headers = {
            'Content-Type': 'application/json',
            'Content-Length': noop.length
        };
    for(var i = 0; i < this.listeners.length; i++) {
        conn = this.listeners[i].connection;
        if((Date.now() - conn._idleStart) >= conn._idleTimeout - 2000) {
            this.listeners[i].writeHead(200, noop_headers);
            this.listeners[i].end(noop);
            this.listeners.splice(i, 1);
            i--;
        }
    }
};

User.prototype.listener = function(conn) {
    this.listeners.push(conn);
};

User.prototype.send = function(event) {
    this._send('listener', event);
};

User.prototype._send = function(type, event, res) {
    if (this.socketio) {
        var id = event.id;
        if (event.id) {
            delete event.id;
        }
        this.socketio.emit('client', event);
        if (id) {
            event.id = id;
        }
    } else if(type == 'connection') {
        // end a regular connection with a response
        res.jsonp(event);
    } else {
        // end a long-polling connection with an event
        if(!this.listeners.length)
            return this.message_queue.push(arguments);

        var cx = this.listeners.slice(), conn;
        this.listeners = [];
        while(conn = cx.shift()) {
            conn.jsonp(event);
        }
    }
};

User.prototype.data = function(key, def) {
    if(key == 'id') return this.id;
    return this._data[key] || this['_' + key] ||
           (typeof this[key] != 'function' && this[key]) ||
           def || false;
};

User.prototype.touch = function() {
    this.lastAccess = +new Date;
};

User.prototype.status = function(res, event) {
    if(!event)
        return this._status;
    
    this._status = event.status;
    this._status_message = event.message;
    this.events.emit('status', event.status, event.message);
    event._status = {sent: true};
    if (res) {
       res.jsonp(event);
    }
};

User.prototype.dispatch = function(hub, event) {
    if (event.type == 'message') {
        hub.find(event.to, function(to) {
            hub.message(null, to, event);
        });
    }
};

