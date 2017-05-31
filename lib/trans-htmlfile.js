'use strict';

const ResponseReceiver = require('./response-receiver');
const Session = require('./session');

// Browsers fail with "Uncaught exception: ReferenceError: Security
// error: attempted to read protected variable: _jp". Set
// document.domain in order to work around that.
let iframe_template = `
<!doctype html>
<html><head>
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
</head><body><h2>Don't panic!</h2>
  <script>
    document.domain = document.domain;
    var c = parent.{{ callback }};
    c.start();
    function p(d) {c.message(d);};
    window.onload = function() {c.stop();};
  </script>
`;
// Safari needs at least 1024 bytes to parse the website. Relevant:
//   http://code.google.com/p/browsersec/wiki/Part2#Survey_of_content_sniffing_behaviors
iframe_template += Array(1024 - iframe_template.length + 14).join(' ');
iframe_template += '\r\n\r\n';

class HtmlFileReceiver extends ResponseReceiver {
  constructor(req, res, options) {
    super(req, res, options);
    this.protocol = 'htmlfile';
  }

  sendFrame(payload) {
    return super.sendFrame(`<script>\np(${JSON.stringify(payload)});\n</script>\r\n`);
  }
}

module.exports = {
  htmlfile(req, res, data, next) {
    if (!('c' in req.query || 'callback' in req.query)) {
      return next({
        status: 500,
        message: '"callback" parameter required'
      });
    }
    const callback = 'c' in req.query ? req.query['c'] : req.query['callback'];
    if (/[^a-zA-Z0-9-_.]/.test(callback)) {
      return next({
        status: 500,
        message: 'invalid "callback" parameter'
      });
    }


    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    res.writeHead(200);
    res.write(iframe_template.replace(/{{ callback }}/g, callback));

    Session.register(req, this, new HtmlFileReceiver(req, res, this.options));
    next();
  }
};
