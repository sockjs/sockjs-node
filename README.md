SockJS family:

  * [SockJS-client](https://github.com/sockjs/sockjs-client) JavaScript client library
  * [SockJS-node](https://github.com/sockjs/sockjs-node) Node.js server
  * [SockJS-erlang](https://github.com/sockjs/sockjs-erlang) Erlang server


SockJS-node server
==================

SockJS-node is a Node.js server side counterpart of
[SockJS-client browser library](https://github.com/sockjs/sockjs-client)
written in CoffeeScript.

To install `sockjs-node` run:

    npm install sockjs


An simplified echo SockJS server could look more or less like:

```javascript
var http = require('http');
var sockjs = require('sockjs');

var echo = sockjs.createServer(sockjs_opts);
echo.on('connection', function(conn) {
    conn.on('data', function(message) {
        conn.write(message);
    });
    conn.on('close', function() {});
});

var server = http.createServer();
echo.installHandlers(server, {prefix:'[/]echo'});
server.listen(9999, '0.0.0.0');
```

(Take look at
[examples](https://github.com/sockjs/sockjs-node/tree/master/examples/echo)
directory for a complete version.)

Subscribe to
[SockJS mailing list](https://groups.google.com/forum/#!forum/sockjs) for
discussions and support.


Live QUnit tests and smoke tests
--------------------------------

[SockJS-client](https://github.com/sockjs/sockjs-client) comes with
some QUnit tests and a few smoke tests that are using SockJS-node. At
the moment they are deployed in few places:

 * http://sockjs.popcnt.org/ (hosted in Europe)
 * http://sockjs.cloudfoundry.com/ (CloudFoundry, websockets disabled, loadbalanced)
 * https://sockjs.cloudfoundry.com/ (CloudFoundry SSL, websockets disabled, loadbalanced)
 * http://sockjs.herokuapp.com/ (Heroku, websockets disabled)


SockJS-node API
---------------

The API design is based on the common Node API's like
[Streams API](http://nodejs.org/docs/v0.5.8/api/streams.html) or
[Http.Server API](http://nodejs.org/docs/v0.5.8/api/http.html#http.Server).

### Server class

SockJS module is generating a `Server` class, similar to
[Node.js http.createServer](http://nodejs.org/docs/v0.5.8/api/http.html#http.createServer)
module.

```javascript
var sockjs_server = sockjs.createServer(options);
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
   load SockJS javascript client library, and this option lets you specify
   its url (if you're unsure, point it to
   <a href="http://cdn.sockjs.org/sockjs-0.1.min.js">
   the latest minified SockJS client release</a>, this is the default).
   You must explicitly specify this url on the server side for security
   reasons - we don't want the possibility of running any foreign
   javascript within the SockJS domain (aka cross site scripting attack).
   Also, sockjs javascript library is probably already cached by the
   browser - it makes sense to reuse the sockjs url you're using in
   normally.</dd>

<dt>prefix (string)</dt>
<dd>A url prefix for the server. All http requests which paths begins
   with selected prefix will be handled by SockJS. All other requests
   will be passed through, to previously registered handlers.</dd>

<dt>disabled_transports (list of strings)</dt>
<dd>A list of streaming transports that should not be handled by the
   server. This may be useful when it's known that the server stands
   behind a load balancer which doesn't like some streaming transports, for
   example websockets. The only valid transport currently is: 'websocket'.</dd>

<dt>response_limit (integer)</dt>
<dd>Most streaming transports save responses on the client side and
   don't free memory used by delivered messages. Such transports need
   to be garbage-collected once in a while. `response_limit` sets
   a minimum number of bytes that can be send over a single http streaming
   request before it will be closed. After that client needs to open
   new request. Setting this value to one effectively disables
   streaming and will make streaming transports to behave like polling
   transports. The default value is 128K.</dd>

<dt>jsessionid (boolean or function)</dt>
<dd>Some hosting providers enable sticky sessions only to requests that
  have JSESSIONID cookie set. This setting controls if the server should
  set this cookie to a dummy value. By default setting JSESSIONID cookie
  is enabled. More sophisticated beaviour can be achieved by supplying
  a function.</dd>

<dt>log (function(severity, message))</dt>
<dd>It's quite useful, especially for debugging, to see some messages
  printed by a SockJS-node library. This is done using this `log`
  function, which is by default set to `console.log`. If this
  behaviour annoys you for some reason, override `log` setting with a
  custom handler.  The following `severities` are used: `debug`
  (miscellaneous logs), `info` (requests logs), `error` (serious
  errors, consider filing an issue).</dd>

<dt>heartbeat_delay (milliseconds)</dt>
<dd>In order to keep proxies and load balancers from closing long
  running http requests we need to pretend that the connecion is
  active and send a heartbeat packet once in a while. This setting
  controlls how often this is done. By default a heartbeat packet is
  sent every 25 seconds.  </dd>

<dt>disconnect_delay (milliseconds)</dt>
<dd>The server sends a `close` event when a client receiving
  connection have not been seen for a while. This delay is configured
  by this setting. By default the `close` event will be emitted when a
  receiving connection wasn't seen for 5 seconds.  </dd>
</dl>


### Server instance

Once you have create `Server` instance you can hook it to the
[http.Server instance](http://nodejs.org/docs/v0.5.8/api/http.html#http.createServer).

```javascript
var http_server = http.createServer();
sockjs_server.installHandlers(http_server, options);
http_server.listen(...);
```

Where `options` can overshadow options given when creating `Server`
instance.

`Server` instance is an
[EventEmitter](http://nodejs.org/docs/v0.4.10/api/events.html#events.EventEmitter),
and emits following event:

<dl>
<dt>Event: connection (connection)</dt>
<dd>A new connection has been successfully opened.</dd>
</dl>

All http requests that don't go under the path selected by `prefix`
will remain unanswered and will be passed to previously registered
handlers. You must install your custom http handlers before calling
`installHandlers`.

### Connection instance

A `Connection` instance supports
[Node Stream API](http://nodejs.org/docs/v0.5.8/api/streams.html) and
has following methods and properties:

<dl>
<dt>Property: readable (boolean)</dt>
<dd>Is the stream readable?</dd>

<dt>Property: writable (boolean)</dt>
<dd>Is the stream writable?</dd>

<dt>Property: remoteAddress (string)</dt>
<dd>Last known IP address of the client.</dd>

<dt>Property: remotePort (number)</dt>
<dd>Last known port number of the client.</dd>

<dt>Property: address (object)</dt>
<dd>Hash with 'address' and 'port' fields.</dd>

<dt>Property: headers (object)</dt>
<dd>Hash containing various headers copied from last receiving request
    on that connection. Exposed headers include: `origin`, `referer`
    and `x-forwarded-for` (and friends). We expliclty do not grant
    access to `cookie` header, as using it may easily lead to security
    issues.</dd>

<dt>Property: url (string)</dt>
<dd><a href="http://nodejs.org/docs/v0.4.10/api/http.html#request.url">Url</a>
    property copied from last request.</dd>

<dt>Property: pathname (string)</dt>
<dd>`pathname` from parsed url, for convenience.</dd>

<dt>Property: prefix (string)</dt>
<dd>Prefix of the url on which the request was handled.</dd>

<dt>write(message)</dt>
<dd>Sends a message over opened connection. A message must be a
  non-empty string. It's illegal to send a message after the connection was
  closed (either after 'close' or 'end' method or 'close' event).</dd>

<dt>close([code], [reason])</dt>
<dd>Asks the remote client to disconnect. 'code' and 'reason'
   parameters are optional and can be used to share the reason of
   disconnection.</dd>

<dt>end()</dt>
<dd>Asks the remote client to disconnect with default 'code' and
   'reason' values.</dd>

</dl>

A `Connection` instance emits the following events:

<dl>
<dt>Event: data (message)</dt>
<dd>A message arrived on the connection. Message is a unicode
  string.</dd>

<dt>Event: close ()</dt>
<dd>Connection was closed. This event is triggered exactly once for
   every connection.</dd>
</dl>

For example:

```javascript
sockjs_server.on('connection', function(conn) {
    console.log('connection' + conn);
    conn.on('close', function() {
        console.log('close ' + conn);
    });
    conn.on('data', function(message) {
        console.log('message ' + conn,
                    message);
    });
});
```

### Footnote

A fully working echo server does need a bit more boilerplate (to
handle requests unanswered by SockJS), see the
[`echo` example](https://github.com/sockjs/sockjs-node/tree/master/examples/echo)
for a complete code.

### Examples

If you want to see samples of running code, take a look at:

 * [./examples/echo](https://github.com/sockjs/sockjs-node/tree/master/examples/echo)
   directory, which contains a full example of a echo server.
 * [SockJS-client tests](https://github.com/sockjs/sockjs-client/blob/master/tests/).


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
[SockJS HAProxy configuration](https://github.com/sockjs/sockjs-node/blob/master/examples/haproxy.cfg).

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


Development
-----------

If you want to update SockJS-node source code, clone git repo and
follow this steps. First you need to install dependencies:

    cd sockjs-node
    npm install --dev

You're ready to compile CoffeeScript to js:

    make

If you want to automatically recompile when the source files are
modified, take a look at `make serve`. Make sure your changes to
SockJS-node don't break test code in SockJS-client and don't break the
SockJS-protocol test suite.
