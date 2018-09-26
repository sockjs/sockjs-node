'use strict';

module.exports = {
  'eventsource': require('./eventsource'),
  'htmlfile': require('./htmlfile'),
  'jsonp-polling': require('./jsonp-polling'),
  'websocket': require('./websocket'),
  'websocket-raw': require('./websocket-raw'),
  'xhr-polling': require('./xhr-polling'),
  'xhr-streaming': require('./xhr-streaming'),
};
