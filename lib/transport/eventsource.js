import * as utils from '../utils.js';
import ResponseReceiver from './response-receiver.js';
import Session from '../session.js';
import middleware from '../middleware.js';

class EventSourceReceiver extends ResponseReceiver {
  constructor(req, res, options) {
    super(req, res, options);
    this.protocol = 'eventsource';
  }

  sendFrame(payload) {
    // Beware of leading whitespace
    const data = `data: ${utils.escape_selected(payload, '\r\n\x00')}\r\n\r\n`;
    return super.sendFrame(data);
  }
}

function eventsource(req, res, _head, next) {
  let origin;
  if (!req.headers['origin'] || req.headers['origin'] === 'null') {
    origin = '*';
  } else {
    origin = req.headers['origin'];
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  const headers = req.headers['access-control-request-headers'];
  if (headers) {
    res.setHeader('Access-Control-Allow-Headers', headers);
  }

  res.writeHead(200);
  // Opera needs one more new line at the start.
  res.write('\r\n');

  Session.register(req, this, new EventSourceReceiver(req, res, this.options));
  next();
}

export default {
  routes: [
    {
      method: 'GET',
      path: '/eventsource',
      handlers: [middleware.h_sid, middleware.h_no_cache, eventsource],
      transport: true
    }
  ]
};
