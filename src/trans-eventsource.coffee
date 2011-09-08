utils = require('./utils')
transport = require('./transport')


class EventSourceReceiver extends transport.ResponseReceiver
    protocol: "eventsource"

    doSendFrame: (payload) ->
        # Beware of leading whitespace
        data = ['data: ',
                utils.escape_selected(payload, '\r\n\x00'),
                '\r\n\r\n']
        super(data.join(''))

exports.app =
    eventsource: (req, res) ->
        res.setHeader('Content-type', 'text/event-stream; charset=UTF-8')
        res.writeHead(200)
        # opera needs to hear two more initial new lines.
        res.write(['', ''].join('\r\n'))

        session = transport.Session.bySessionIdOrNew(req.session, req.sockjs_server)
        session.register( new EventSourceReceiver(res, req.sockjs_server.options) )
        return true
