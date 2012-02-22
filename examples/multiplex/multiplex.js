// ****

var DumbEventTarget = function() {
    this._listeners = {};
};
DumbEventTarget.prototype._ensure = function(type) {
    if(!(type in this._listeners)) this._listeners[type] = [];
};
DumbEventTarget.prototype.addEventListener = function(type, listener) {
    this._ensure(type);
    this._listeners[type].push(listener);
};
DumbEventTarget.prototype.emit = function(type) {
    this._ensure(type);
    var args = Array.prototype.slice.call(arguments, 1);
    if(this['on' + type]) this['on' + type].apply(this, args);
    for(var i=0; i < this._listeners[type].length; i++) {
        this._listeners[type][i].apply(this, args);
    }
};


// ****

var MultiplexedWebSocket = function(ws) {
    var that = this;
    this.ws = ws;
    this.subscriptions = {};
    this.ws.addEventListener('message', function(e) {
        var t = e.data.split(',', 3);
        var type = t[0], topic = t[1],  payload = t[2];
        if(!(topic in that.subscriptions)) {
            return;
        }
        var sub = that.subscriptions[topic];

        switch(type) {
        case 'uns':
            delete that.subscriptions[topic];
            sub.emit('close', {});
            break;
        case 'msg':
            sub.emit('message', {data: payload});
            break
        }
    });
};
MultiplexedWebSocket.prototype.subscribe = function(name) {
    return this.subscriptions[escape(name)] =
        new Subscription(this.ws, escape(name), this.subscriptions);
};


var Subscription = function(ws, topic, subscriptions) {
    DumbEventTarget.call(this);
    var that = this;
    this.ws = ws;
    this.topic = topic;
    this.subscriptions = subscriptions;
    var onopen = function() {
        that.ws.send('sub,' + that.topic);
        that.emit('open');
    };
    if(ws.readyState > 0) {
        setTimeout(onopen, 0);
    } else {
        this.ws.addEventListener('open', onopen);
    }
};
Subscription.prototype = new DumbEventTarget()

Subscription.prototype.send = function(data) {
    this.ws.send('msg,' + this.topic + ',' + data);
};
Subscription.prototype.close = function() {
    var that = this;
    this.ws.send('uns,' + this.topic);
    delete this.subscriptions[this.topic];
    setTimeout(function(){that.emit('close', {})},0);
};
