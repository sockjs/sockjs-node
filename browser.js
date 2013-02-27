var Stream = require('stream');
var sockjs = require('sockjs-client');

module.exports = function (uri, cb) {
    if (/^\/\/[^\/]+\//.test(uri)) {
        uri = window.location.protocol + uri;
    }
    else if (!/^https?:\/\//.test(uri)) {
        uri = window.location.protocol + '//'
            + window.location.host
            + (/^\//.test(uri) ? uri : '/' + uri)
        ;
    }
    
    var stream = new Stream;
    stream.readable = true;
    stream.writable = true;
    
    var ready = false;
    var buffer = [];
    
    var sock = sockjs(uri);
    stream.sock = sock;
    
    stream.write = function (msg) {
        if (!ready) buffer.push(msg)
        else sock.send(msg)
    };
    
    sock.onopen = function () {
        if (typeof cb === 'function') cb();
        ready = true;
        buffer.forEach(function (msg) {
            sock.send(msg);
        });
        buffer = [];
    };
    sock.onmessage = function (e) {
        stream.emit('data', e.data);
    };
    sock.onclose = function () {
        stream.emit('end');
        stream.writable = false;
        stream.readable = false;
    };
    
    return stream;
};
