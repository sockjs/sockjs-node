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
            [0, => write(Array(2048).join(' ')) + 'h'],
            [1, => write('h')],
            [10, => write('h')],
            [50, => write('h')],
            [100, => write('h')],
            [239, => write('h'); res.end()],
        ])
        return true
