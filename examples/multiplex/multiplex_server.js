var events = require('events');
var stream = require('stream');


exports.MultiplexServer = MultiplexServer = function(service) {
    var that = this;
    this.namespaces = {};
    this.service = service;
    this.service.on('connection', function(conn) {
        var subscriptions = {};

        conn.on('data', function(message) {
            var t = message.split(',', 3);
            var type = t[0], topic = t[1],  payload = t[2];
            if (!(topic in that.namespaces)) {
                return;
            }
            switch(type) {
            case 'sub':
                var sub = subscriptions[topic] = new Subscription(conn, topic,
                                                                  subscriptions);
                that.namespaces[topic].emit('connection', sub)
                break;
            case 'uns':
                if (topic in subscriptions) {
                    delete subscriptions[topic];
                    subscriptions[topic].emit('close');
                }
                break;
            case 'msg':
                if (topic in subscriptions) {
                    subscriptions[topic].emit('data', payload);
                }
                break;
            }
        });
        conn.on('close', function() {
            for (topic in subscriptions) {
                subscriptions[topic].emit('close');
            }
            subscriptions = {};
        });
    });
};

MultiplexServer.prototype.createNamespace = function(name) {
    return this.namespaces[escape(name)] = new Namespace();
};


var Namespace = function() {
    events.EventEmitter.call(this);
};
Namespace.prototype = new events.EventEmitter();


var Subscription = function(conn, topic, subscriptions) {
    this.conn = conn;
    this.topic = topic;
    this.subscriptions = subscriptions;
    stream.Stream.call(this);
};
Subscription.prototype = new stream.Stream();

Subscription.prototype.write = function(data) {
    this.conn.write('msg,' + this.topic + ',' + data);
};
Subscription.prototype.end = function(data) {
    var that = this;
    if (data) this.write(data);
    if (this.topic in this.subscriptions) {
        this.conn.write('uns,' + this.topic);
        delete this.subscriptions[this.topic];
        process.nextTick(function(){that.emit('close');});
    }
};
Subscription.prototype.destroy = Subscription.prototype.destroySoon =
    function() {
        this.removeAllListeners();
        this.end();
    };
