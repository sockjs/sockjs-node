var http = require('http');

var sockjs = require('./lib/sockjs');

var sjs_echo = new sockjs.Server();
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

var default_handler = function(req, res) {
    console.log('404', req.url);
    if (res.writeHead) {
        res.writeHead(404, {});
        res.end("404 - Not Found");
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
server.listen(port, host);
