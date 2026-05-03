import eventsource from './eventsource.js';
import htmlfile from './htmlfile.js';
import jsonp_polling from './jsonp-polling.js';
import websocket from './websocket.js';
import websocket_raw from './websocket-raw.js';
import xhr_polling from './xhr-polling.js';
import xhr_streaming from './xhr-streaming.js';

export default {
  eventsource,
  htmlfile,
  'jsonp-polling': jsonp_polling,
  websocket,
  'websocket-raw': websocket_raw,
  'xhr-polling': xhr_polling,
  'xhr-streaming': xhr_streaming
};
