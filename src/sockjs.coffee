events = require('events')
webjs = require('./webjs')
$ = require('jquery')

trans_websocket = require('./trans-websocket')
trans_jsonp = require('./trans-jsonp')
trans_xhr = require('./trans-xhr')
iframe = require('./iframe')
trans_eventsource = require('./trans-eventsource')


app =
    welcome_screen: (req, res) ->
        res.writeHead(200, {})
        res.end("Welcome to SockJS!")
        return true

$.extend(app, webjs.generic_app)
$.extend(app, iframe.app)

$.extend(app, trans_websocket.app)
$.extend(app, trans_jsonp.app)
$.extend(app, trans_xhr.app)
$.extend(app, trans_eventsource.app)


class Server extends events.EventEmitter
    constructor: (user_options) ->
        @options =
            prefix: ''
            origins: ['*:*']
        if @options.sockjs_url
            throw "options.sockjs_url is required!"
        if user_options
            $.extend(@options, user_options)

    installHandlers: (http_server, user_options) ->
        options = {}
        $.extend(options, @options)
        if user_options
            $.extend(options, user_options)

        p = (s) => new RegExp('^' + options.prefix + s + '[/]?$')
        t = (s) => [p('/([^/.]+)/([^/.]+)' + s), 'server', 'session']
        dispatcher = [
            ['GET', p(''), ['welcome_screen']],
            ['GET', t('/websocket'), ['websocket']],
            ['GET', t('/jsonp'), ['h_no_cache','jsonp']],
            ['POST',t('/jsonp_send'), ['expect_form', 'jsonp_send']],
            ['GET', p('/iframe[0-9-.a-z_]*.html'), ['iframe', 'cache_for', 'expose']],
            ['GET', t('/eventsource'), ['h_no_cache', 'eventsource']],
            ['POST',    t('/xhr'), ['xhr_cors', 'xhr_poll']],
            ['OPTIONS', t('/xhr'), ['xhr_cors', 'xhr_options', 'cache_for', 'expose']],
            ['POST',    t('/xhr_streaming'), ['xhr_cors', 'xhr_streaming']],
            ['OPTIONS', t('/xhr_streaming'), ['xhr_cors', 'xhr_options', 'cache_for', 'expose']],
            ['POST',    t('/xhr_send'), ['xhr_cors', 'expect_xhr', 'xhr_send']],
            ['OPTIONS', t('/xhr_send'), ['xhr_cors', 'xhr_options', 'cache_for', 'expose']],
        ]
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
