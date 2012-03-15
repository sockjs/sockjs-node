var connect = require('connect');
var sockjs = require('sockjs');

// 1. Create the Connect server
var app = connect();

// 2. Echo sockjs middleware
var sockjs_opts = {sockjs_url: "http://cdn.sockjs.org/sockjs-0.2.min.js"};
var sockjs_echo = sockjs.createServer(sockjs_opts);
sockjs_echo.on('connection', function(conn) {
    conn.on('data', function(message) {
        conn.write(message);
    });
});
app.use('/echo', sockjs_echo.middleware());

// 3. Static files middleware
app.use(connect.middleware.static(__dirname));

// 4. Listen
console.log(' [*] Listening on 0.0.0.0:9999' );
app.listen(9999, '0.0.0.0');
