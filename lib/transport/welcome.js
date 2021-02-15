'use strict';

function welcome_screen(req, res) {
  res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
  res.writeHead(200);
  res.end('Welcome to SockJS!\n');
}

module.exports = {
  welcome_screen,
  routes: [
    {
      method: 'GET',
      path: '',
      handlers: [welcome_screen],
      transport: false
    }
  ]
};
