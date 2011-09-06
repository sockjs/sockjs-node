SockJS-node server
==================

To install `sockjs-node` run:

    npm install sockjs


An simplified echo SockJS server could look more or less like:

```javascript
var http = require('http');
var sockjs = require('sockjs');

var echo = new sockjs.Server(sockjs_opts);
echo.on('open', function(conn) {
    conn.on('message', function(e) {
        conn.send(e.data);
    });
});

var server = http.createServer();
echo.installHandlers(server, {prefix:'[/]echo'});
server.listen(9999, '0.0.0.0');
```

Subscribe to
[SockJS mailing list](http://groups.google.com/group/sockjs) for
discussions and support.


Live QUnit tests and smoke tests
--------------------------------

[SockJS-client](https://github.com/majek/sockjs-client) comes with
some QUnit tests and a few smoke tests that are using SockJS-node. At
the moment they are deployed in few places:

 * http://sockjs.popcnt.org/ (hosted in Europe)
 * http://sockjs.cloudfoundry.com/ (CloudFoundry, websockets not working)
 * https://sockjs.cloudfoundry.com/ (CloudFoundry SSL, websockets not working)
 * http://sockjs.herokuapp.com/ (Heroku, websockets not working)


SockJS-node API
---------------

The API is highly influenced by the
[HTML5 Websockets API](http://dev.w3.org/html5/websockets/). The goal
is to follow it as closely as possible, but we're not there yet.


### Server class

Server class on one side is generating an http handler, compatible
with the common
[Node.js http](http://nodejs.org/docs/v0.4.10/api/http.html#http.createServer)
module.

```javascript
var sjs = new sockjs.Server(options);
```

Where `options` is a hash which can contain:

<dl>
<dt>sockjs_url (string, required)</dt>
<dd>Transports which don't support cross-domain communication natively
   ('eventsource' to name one) use an iframe trick. A simple page is
   served from the SockJS server (using its foreign domain) and is
   placed in an invisible iframe. Code run from this iframe doesn't
   need to worry about cross-domain issues, as it's being run from
   domain local to the SockJS server. This iframe also does need to
   load SockJS javascript client library, and this option specifies
   its url (if you're unsure, point it to
   <a href="http://majek.github.com/sockjs-client/sockjs-latest.min.js">
   the latest minified SockJS client release</a>).</dd>

<dt>prefix (string)</dt>
<dd>A url prefix for the server. All http requests which paths begins
   with selected prefix will be handled by SockJS. All other requests
   will be passed through, to previously registered handlers.</dd>

<dt>disabled_transports (list of strings)</dt>
<dd>A list of streaming transports that should not be handled by the
   server. This may be useful, when it's known that the server stands
   behind a proxy which doesn't like some streaming transports, for
   example websockets. Valid values are: 'websockets', 'eventsource'.</dd>
</dl>


### Server instance

Once you have instantiated `Server` class you can hook it to the
[http server instance](http://nodejs.org/docs/v0.4.10/api/http.html#http.createServer).

```javascript
var http_server = http.createServer();
sjs.installHandlers(http_server, options);
http_server.listen(...);
```

Where `options` can overwrite options set by `Server` class
constructor.

`Server` instance is an
[EventEmitter](http://nodejs.org/docs/v0.4.10/api/events.html#events.EventEmitter),
and emits following event:

<dl>
<dt>open(connection)</dt>
<dd>A new connection has been successfully opened.</dd>
</dl>

All http requests that don't go under the path selected by `prefix`
will remain unanswered and will be passed to previously registered
handlers.

### Connection instance

A `Connection` instance has following methods and properties:

<dl>
<dt>readyState</dt>
<dd>A property describing a state of the connecion.</dd>

<dt>send(message)</dt>
<dd>Sends a message over opened connection. It's illegal to send a
   message after the connection was closed (either by 'close' method
   or 'close' event).</dd>

<dt>close([status], [reason])</dt>
<dd>Asks the remote client to disconnect. 'status' and 'reason'
   parameters are optional and can be used to share the reason of
   disconnection.</dd>
</dl>

A `Connection` instance is also an
[EventEmitter](http://nodejs.org/docs/v0.4.10/api/events.html#events.EventEmitter),
and emits following events:

<dl>
<dt>message(event)</dt>
<dd>A message arrived on the connection. Data is available at 'event.data'.</dd>

<dt>close(event)</dt>
<dd>Connection was closed. This event is triggered exactly once for
   every connection.</dd>
</dl>

For example:

```javascript
sjs.on('open', function(conn) {
    console.log('open' + conn);
    conn.on('close', function(e) {
        console.log('close ' + conn, e);
    });
    conn.on('message', function(e) {
        console.log('message ' + conn,
                    e.data);
    });
});
```

### Footnote

A fully working echo server does need a bit more boilerplate (to
handle unanswered requests), here it is:

```javascript
var http = require('http');
var sockjs = require('sockjs');

var sockjs_opts = {sockjs_url:
    "http://majek.github.com/sockjs-client/sockjs-latest.min.js"};

var sjs = new sockjs.Server(sockjs_opts);
sjs.on('open', function(conn) {
    conn.on('message', function(e) {
        conn.send(e.data);
    });
});

var server = http.createServer();
server.addListener('request', function(req, res) {
    res.writeHead(404);
    res.end('404 not found');
});
server.addListener('upgrade', function(req, con) {
    con.end();
});

sjs.installHandlers(server, {prefix:'[/]echo'});

server.listen(9999, '0.0.0.0');
```

### Examples

If you want to see samples of running code, take a look at:

 * [./examples/echo](https://github.com/majek/sockjs-node/tree/master/examples/echo)
   directory, which contains a full example of a echo server.
 * [SockJS-client tests](https://github.com/majek/sockjs-client/blob/master/tests/sockjs_test_server.js).


Deployment and load balancing
-----------------------------

There are two issues that needs to be considered when planning a
non-trivial SockJS-node deployment: WebSocket-compatible load balancer
and sticky sessions (aka session affinity).

### WebSocket compatible load balancer

Often WebSockets don't play nicely with proxies and loadbalancers.
Deploying a SockJS server behind Nginx or Apache could be painful.

Fortunetely recent versions of an excellent loadbalancer
[HAProxy](http://haproxy.1wt.eu/) are able to proxy WebSocket
connections. We propose to put HAProxy as a front line load balancer
and use it to split SockJS traffic from normal HTTP data. Take a look
at the sample
[SockJS HAProxy configuration](https://github.com/majek/sockjs-node/blob/master/examples/haproxy.cfg).

The config also shows how to use HAproxy balancing to split traffic
between multiple Node.js servers. You can also do balancing using dns
names.

### Sticky sessions

If you plan depling more than one SockJS server, you must make sure
that all HTTP requests for a single session will hit the same server.
SockJS has two mechanisms that can be usefull to achieve that:

 * Urls are prefixed with server and session id numbers, like:
   `/resource/<server_number>/<session_id>/transport`.  This is
   usefull for load balancers that support prefix-based affinity
   (HAProxy does).
 * `JSESSIONID` cookie is being set by SockJS-node. Many load
   balancers turn on sticky sessions if that cookie is set. This
   technique is derived from Java applications, where sticky sessions
   are often neccesary. HAProxy does support this method, as well as
   some hosting providers, for example CloudFoundry.  In order to
   enable this method on the client side, please supply a
   `cookie:true` option to SockJS constructor.

