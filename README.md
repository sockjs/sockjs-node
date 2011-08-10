SockJS-node server
==================

To install `sockjs-node` run:

    npm install sockjs


A fully working echo server would look like:

    var http = require('http');
    var sockjs = require('sockjs');

    var sockjs_opts = {sockjs_url: "http://127.0.0.1:8000/lib/sockjs.js"};

    var sjs_echo = new sockjs.Server(sockjs_opts);
    sjs_echo.on('open', function(conn) {
        conn.on('message', function(e) {
            conn.send(e.data);
        });
    });

    var normal_handler = function(req, res) {
            res.writeHead(404);
            res.end("Not found.");
    };

    var server = http.createServer();
    server.addListener('request', normal_handler);
    server.addListener('upgrade', normal_handler);

    sjs_echo.installHandlers(server, {prefix:'[/]echo'});

    server.listen(9999, '0.0.0.0');

