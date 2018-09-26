SockJS test server
==================

In order to test sockjs server implementation the server needs to
provide a standarized sockjs endpoint that will can used by various
sockjs-related tests. For example by QUnit or
[Sockjs-protocol](https://github.com/sockjs/sockjs-protocol) tests.

This small code does exactly that - runs a simple server that supports
the following SockJS services:

 * `/echo`
 * `/disabled_websocket_echo`
 * `/cookie_needed_echo`
 * `/close`
 * `/ticker`
 * `/amplify`
 * `/broadcast`

If you just want to quickly run it:

    node server.js
