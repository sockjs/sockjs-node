'use strict';

const debug = require('debug')('sockjs:listener');
const transportList = require('./transport/list');
const middleware = require('./middleware');
const handlers = require('./handlers');
const info = require('./info');
const iframe = require('./iframe');

module.exports.generateDispatcher = function generateDispatcher(options) {
  const p = (s) => new RegExp(`^${options.prefix}${s}[/]?$`);
  const t = (s) => [p(`/([^/.]+)/([^/.]+)${s}`), 'server', 'session'];
  const prefix_dispatcher = [
    ['GET', p(''), [handlers.welcome_screen]],
    ['OPTIONS', p('/info'), [middleware.h_sid, middleware.xhr_cors, info.info_options]],
    ['GET', p('/info'), [middleware.xhr_cors, middleware.h_no_cache, info.info]]
  ];
  if (!options.disable_cors) {
    prefix_dispatcher.push(['GET', p('/iframe[0-9-.a-z_]*.html'), [iframe.iframe]]);
  }

  const transport_dispatcher = [];

  for (const name of options.transports) {
    const tr = transportList[name];
    if (!tr) {
      throw new Error(`unknown transport ${name}`);
    }
    debug('enabling transport', name);

    for (const route of tr.routes) {
      const d = route.transport ? transport_dispatcher : prefix_dispatcher;
      const path = route.transport ? t(route.path) : p(route.path);
      const fullroute = [route.method, path, route.handlers];
      if (!d.some((x) => x[0] == route.method && x[1].toString() === path.toString())) {
        d.push(fullroute);
      }
    }
  }
  return prefix_dispatcher.concat(transport_dispatcher);
};
