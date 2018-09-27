'use strict';
const sockjs = require('../../index');
const debug = require('debug')('sockjs:test-server:app');

exports.install = function(opts, server) {
  const echoHandler = function(conn) {
    debug(`    [+] echo open    ${conn}`);
    conn.on('close', function() {
      debug(`    [-] echo close   ${conn}`);
    });
    conn.on('data', function(m) {
      const d = JSON.stringify(m);
      debug(`    [ ] echo message ${conn} ${d.slice(0, 64)}${d.length > 64 ? '...' : ''}`);
      conn.write(m);
    });
  };

  const sjs_echo = sockjs.createServer(
    Object.assign({}, opts, { prefix: '/echo', response_limit: 4096 })
  );
  sjs_echo.on('connection', echoHandler);
  sjs_echo.attach(server);

  const sjs_echo2 = sockjs.createServer(
    Object.assign({}, opts, {
      prefix: '/disabled_websocket_echo',
      websocket: false
    })
  );
  sjs_echo2.on('connection', echoHandler);
  sjs_echo2.attach(server);

  const sjs_echo3 = sockjs.createServer(
    Object.assign({}, opts, { prefix: '/cookie_needed_echo', jsessionid: true })
  );
  sjs_echo3.on('connection', echoHandler);
  sjs_echo3.attach(server);

  const sjs_close = sockjs.createServer(Object.assign({}, opts, { prefix: '/close' }));
  sjs_close.on('connection', function(conn) {
    debug(`    [+] close open    ${conn}`);
    conn.close(3000, 'Go away!');
    conn.on('close', function() {
      debug(`    [-] close close   ${conn}`);
    });
  });
  sjs_close.attach(server);

  const sjs_ticker = sockjs.createServer(Object.assign({}, opts, { prefix: '/ticker' }));
  sjs_ticker.on('connection', function(conn) {
    debug(`    [+] ticker open   ${conn}`);
    let tref;
    const schedule = function() {
      conn.write('tick!');
      tref = setTimeout(schedule, 1000);
    };
    tref = setTimeout(schedule, 1000);
    conn.on('close', function() {
      clearTimeout(tref);
      debug(`    [-] ticker close   ${conn}`);
    });
  });
  sjs_ticker.attach(server);

  const broadcast = {};
  const sjs_broadcast = sockjs.createServer(Object.assign({}, opts, { prefix: '/broadcast' }));
  sjs_broadcast.on('connection', function(conn) {
    debug(`    [+] broadcast open ${conn}`);
    broadcast[conn.id] = conn;
    conn.on('close', function() {
      delete broadcast[conn.id];
      debug(`    [-] broadcast close${conn}`);
    });
    conn.on('data', function(m) {
      debug(`    [-] broadcast message ${m}`);
      for (const id in broadcast) {
        broadcast[id].write(m);
      }
    });
  });
  sjs_broadcast.attach(server);

  const sjs_amplify = sockjs.createServer(Object.assign({}, opts, { prefix: '/amplify' }));
  sjs_amplify.on('connection', function(conn) {
    debug(`    [+] amp open    ${conn}`);
    conn.on('close', function() {
      debug(`    [-] amp close   ${conn}`);
    });
    conn.on('data', function(m) {
      let n = Math.floor(Number(m));
      n = n > 0 && n < 19 ? n : 1;
      debug(`    [ ] amp message: 2^${n}`);
      conn.write(new Array(Math.pow(2, n) + 1).join('x'));
    });
  });
  sjs_amplify.attach(server);
};
