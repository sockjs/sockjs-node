'use strict';
const utils = require('./utils');

module.exports = {
  info(req, res) {
    const info = {
      websocket: this.options.websocket,
      origins: ['*:*'],
      cookie_needed: !!this.options.jsessionid,
      entropy: utils.random32(),
    };
    // Users can specify a new base URL which further requests will be made
    // against. For example, it may contain a randomized domain name to
    // avoid browser per-domain connection limits.
    if (typeof this.options.base_url === 'function') {
      info.base_url = this.options.base_url();
    } else if (this.options.base_url) {
      info.base_url = this.options.base_url;
    }
    res.setHeader('Content-Type', 'application/json; charset=UTF-8');
    res.writeHead(200);
    res.end(JSON.stringify(info));
  },

  info_options(req, res) {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET');
    res.setHeader('Access-Control-Max-Age', res.cache_for);
    return '';
  }
};
