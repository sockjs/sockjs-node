'use strict';

module.exports = {
  handle_404(req, res) {
    res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
    res.writeHead(404);
    res.end('404 Error: Page not found\n');
  },

  handle_405(req, res, methods) {
    res.writeHead(405, { Allow: methods.join(', ') });
    res.end();
  },

  handle_error(err, req, res) {
    if (res.finished) {
      return;
    }
    if (typeof err === 'object' && 'status' in err) {
      res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
      res.writeHead(err.status);
      res.end(err.message || '');
    } else {
      try {
        res.writeHead(500);
        res.end('500 - Internal Server Error');
      } catch (ex) {
        this.options.log(
          'error',
          `Exception on "${req.method} ${req.url}" in filter "${req.last_fun}":\n${ex.stack || ex}`
        );
      }
    }
  }
};
