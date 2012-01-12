utils = require('./utils')

exports.app =
    chunking_test: (req, res, _, next_filter) ->
        res.setHeader('Content-Type', 'application/javascript; charset=UTF-8')
        res.writeHead(200)

        write = (payload) =>
            try
                res.write(payload + '\n')
            catch x
                return

        utils.timeout_chain([
            # IE requires 2KB prelude
            [0, => write('h')],
            [1, => write(Array(2049).join(' ') + 'h')],
            [5, => write('h')],
            [25, => write('h')],
            [125, => write('h')],
            [625, => write('h')],
            [3125, => write('h'); res.end()],
        ])
        return true

    info: (req, res, _) ->
        info = {
            websocket: @options.disabled_transports.indexOf('websocket') is -1,
            origins: @options.origins,
        }
        res.setHeader('Content-Type', 'application/json; charset=UTF-8')
        res.writeHead(200)
        res.end(JSON.stringify(info))
