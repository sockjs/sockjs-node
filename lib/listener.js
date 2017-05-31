'use strict';

const webjs = require('./webjs');
const App = require('./app');
const pkg = require('../package.json');

function generate_dispatcher(options) {
  const p = s => new RegExp(`^${options.prefix}${s}[/]?$`);
  const t = s => [p(`/([^/.]+)/([^/.]+)${s}`), 'server', 'session'];
  const opts_filters = (options_filter='xhr_options') => ['h_sid', 'xhr_cors', options_filter];
  const prefix_dispatcher = [
    ['GET',     p(''), ['welcome_screen']],
    ['GET',     p('/iframe[0-9-.a-z_]*.html'), ['iframe']],
    ['OPTIONS', p('/info'), opts_filters('info_options')],
    ['GET',     p('/info'), ['xhr_cors', 'h_no_cache', 'info']],
  ];
  const transport_dispatcher = [
    ['GET',     t('/jsonp'), ['h_sid', 'h_no_cache', 'jsonp']],
    ['POST',    t('/jsonp_send'), ['h_sid', 'h_no_cache', 'expect_form', 'jsonp_send']],
    ['POST',    t('/xhr'), ['h_sid', 'h_no_cache', 'xhr_cors', 'xhr_poll']],
    ['OPTIONS', t('/xhr'), opts_filters()],
    ['POST',    t('/xhr_send'), ['h_sid', 'h_no_cache', 'xhr_cors', 'expect_xhr', 'xhr_send']],
    ['OPTIONS', t('/xhr_send'), opts_filters()],
    ['POST',    t('/xhr_streaming'), ['h_sid', 'h_no_cache', 'xhr_cors', 'xhr_streaming']],
    ['OPTIONS', t('/xhr_streaming'), opts_filters()],
    ['GET',     t('/eventsource'), ['h_sid', 'h_no_cache', 'eventsource']],
    ['GET',     t('/htmlfile'),    ['h_sid', 'h_no_cache', 'htmlfile']],
  ];

  // TODO: remove this code on next major release
  if (options.websocket) {
    prefix_dispatcher.push(['GET', p('/websocket'), ['websocket_check', 'raw_websocket']]);
    transport_dispatcher.push(['GET', t('/websocket'), ['websocket_check', 'sockjs_websocket']]);
  }
  return prefix_dispatcher.concat(transport_dispatcher);
}

class Listener {
  constructor(options, emit) {
    this.handler = this.handler.bind(this);
    const app = new App(options, emit);
    app.log('debug', `SockJS v${pkg.version} bound to ${JSON.stringify(options.prefix)}`);
    this.webjs_handler = webjs.generateHandler(app, generate_dispatcher(options));
    this.path_regexp = new RegExp(`^${options.prefix}(?:[/].+|[/]?)$`);
  }

  handler(req, res, extra) {
    // All urls that match the prefix must be handled by us.
    if (!this.path_regexp.test(req.url)) {
      return false;
    }
    this.webjs_handler(req, res, extra);
    return true;
  }

  getHandler() {
    return this.handler;
  }
}

module.exports = Listener;
