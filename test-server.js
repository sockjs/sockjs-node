var http = require('http');
var url = require('url');

var sockjs = require('./lib/sockjs');

var sockjs_opts = {
    sockjs_url: "http://172.16.173.128:8000/sockjs.js"
};

var sjs_echo = new sockjs.Server(sockjs_opts);
sjs_echo.on('open', function(conn){
    console.log('    [+] echo open', conn.session);
    conn.on('close', function(e) {
        console.log('    [-] echo close', conn.session, e);
    });
    conn.on('message', function(e) {
        console.log('    [ ] echo message', conn.session, JSON.stringify(e.data.slice(0,128)));
        conn.send(e.data);
    });
});

var sjs_close = new sockjs.Server(sockjs_opts);
sjs_close.on('open', function(conn){
                 console.log('    [+] clos open', conn.session);
                 conn.close(3000, "Server request");
                 conn.on('close', function(e) {
                             console.log('    [-] clos close', conn.session, e);
                         });
            });

var sjs_ticker = new sockjs.Server(sockjs_opts);
sjs_ticker.on('open', function(conn){
    console.log('    [+] ticker open', conn.session);
    var tref;
    var schedule = function() {
        conn.send('tick!');
        tref = setTimeout(schedule, 1000);
    };
    tref = setTimeout(schedule, 1000);
    conn.on('close', function(e) {
        clearTimeout(tref);
        console.log('    [-] ticker close', conn.session, e);
    });
});


var default_handler = function(req, res) {
    res.statusCode = 404;
    if (url.parse(req.url).pathname === '/500_error') {
        res.statusCode = 500;
    }
    console.log(res.statusCode, req.url);
    if (res.writeHead) {
        res.writeHead(res.statusCode);
        res.end("Error");
    } else{
        res.end();
    }
};

var port = 9999;
var host = "0.0.0.0";

console.log(" [*] Listening on", host +':'+port);
var server = http.createServer();
server.addListener('request', default_handler);
server.addListener('upgrade', default_handler);


sjs_echo.installHandlers(server, {prefix:'[/]echo'});
sjs_close.installHandlers(server, {prefix:'[/]close'});
sjs_ticker.installHandlers(server, {prefix:'[/]ticker'});

server.listen(port, host);
