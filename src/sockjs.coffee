events = require('events')
webjs = require('./webjs')
utils = require('./utils')

trans_websocket = require('./trans-websocket')
trans_jsonp = require('./trans-jsonp')
trans_xhr = require('./trans-xhr')
iframe = require('./iframe')
trans_eventsource = require('./trans-eventsource')
trans_htmlfile = require('./trans-htmlfile')
chunking_test = require('./chunking-test')


app =
    welcome_screen: (req, res) ->
        res.setHeader('content-type', 'text/plain')
        res.writeHead(200)
        res.end("Welcome to SockJS!\n")
        return true

    disabled_transport: (req, res) ->
        res.writeHead(404)
        res.end("Transport disabled.")
        return true

utils.objectExtend(app, webjs.generic_app)
utils.objectExtend(app, iframe.app)
utils.objectExtend(app, chunking_test.app)

utils.objectExtend(app, trans_websocket.app)
utils.objectExtend(app, trans_jsonp.app)
utils.objectExtend(app, trans_xhr.app)
utils.objectExtend(app, trans_eventsource.app)
utils.objectExtend(app, trans_htmlfile.app)


class Server extends events.EventEmitter
    constructor: (user_options) ->
        @options =
            prefix: ''
            origins: ['*:*']
            disabled_transports: []
        if @options.sockjs_url
            throw new Error("options.sockjs_url is required!")
        if user_options
            utils.objectExtend(@options, user_options)

    installHandlers: (http_server, user_options) ->
        options = {}
        utils.objectExtend(options, @options)
        if user_options
            utils.objectExtend(options, user_options)

        p = (s) => new RegExp('^' + options.prefix + s + '[/]?$')
        t = (s) => [p('/([^/.]+)/([^/.]+)' + s), 'server', 'session']
        opts_filters = ['h_sid', 'xhr_cors', 'cache_for', 'xhr_options', 'expose']
        dispatcher = [
            ['GET', p(''), ['welcome_screen']],
            ['GET', p('/iframe[0-9-.a-z_]*.html'), ['iframe', 'cache_for', 'expose']],
            ['OPTIONS', p('/chunking_test'), opts_filters],
            ['POST',    p('/chunking_test'), ['h_sid', 'xhr_cors', 'expect_xhr', 'chunking_test']],
            ['GET',     t('/jsonp'), ['h_sid', 'h_no_cache', 'jsonp']],
            ['POST',    t('/jsonp_send'), ['h_sid', 'expect_form', 'jsonp_send']],
            ['POST',    t('/xhr'), ['h_sid', 'xhr_cors', 'xhr_poll']],
            ['OPTIONS', t('/xhr'), opts_filters],
            ['POST',    t('/xhr_send'), ['h_sid', 'xhr_cors', 'expect_xhr', 'xhr_send']],
            ['OPTIONS', t('/xhr_send'), opts_filters],
            ['POST',    t('/xhr_streaming'), ['h_sid', 'xhr_cors', 'xhr_streaming']],
            ['OPTIONS', t('/xhr_streaming'), opts_filters],
            ['GET',     t('/eventsource'), ['h_sid', 'h_no_cache', 'eventsource']],
            ['GET',     t('/htmlfile'),    ['h_sid', 'h_no_cache', 'htmlfile']],
        ]
        maybe_add_transport = (name, urls) ->
            if options.disabled_transports.indexOf(name) isnt -1
                # modify urls to return 404
                urls = for url in urls
                    [method, url, filters] = url
                    [method, url, ['cache_for', 'disabled_transport']]
            dispatcher = dispatcher.concat(urls)
        maybe_add_transport('websocket',[
                ['GET', t('/websocket'), ['websocket']]])
        webjs_handler = new webjs.WebJS(app, dispatcher)

        install_handler = (ee, event, handler) ->
            old_listeners = ee.listeners(event)
            ee.removeAllListeners(event)
            new_handler = (a,b,c) ->
                if handler(a,b,c) isnt true
                    for listener in old_listeners
                        listener.call(this, a, b, c)
                return false
            ee.addListener(event, new_handler)
        handler = (req,res,extra) =>
            req.sockjs_server = @
            return webjs_handler.handler(req, res, extra)
        install_handler(http_server, 'request', handler)
        install_handler(http_server, 'upgrade', handler)
        return true

exports.Server = Server
