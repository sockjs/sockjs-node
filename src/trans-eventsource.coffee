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
        res.setHeader('Content-Type', 'text/event-stream; charset=UTF-8')
        res.writeHead(200)
        # Opera needs one more new line at the start.
        res.write('\r\n')

        req.origin = if @isTrustedOrigin(req.headers.origin or \
                                         'any://' + req.headers.host) then \
                         req.query.origin

        transport.register(req, @, new EventSourceReceiver(res, @options))
        return true
