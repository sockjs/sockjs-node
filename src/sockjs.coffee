events = require('events')
fs = require('fs')
webjs = require('./webjs')
utils = require('./utils')

trans_websocket = require('./trans-websocket')
trans_jsonp = require('./trans-jsonp')
trans_xhr = require('./trans-xhr')
iframe = require('./iframe')
trans_eventsource = require('./trans-eventsource')
trans_htmlfile = require('./trans-htmlfile')
chunking_test = require('./chunking-test')

sockjsVersion = ->
    try
        package = fs.readFileSync(__dirname + '/../package.json', 'utf-8')
    catch x
    return if package then JSON.parse(package).version else null


class App extends webjs.GenericApp
    welcome_screen: (req, res) ->
        res.setHeader('content-type', 'text/plain; charset=UTF-8')
        res.writeHead(200)
        res.end("Welcome to SockJS!\n")
        return true

    disabled_transport: (req, res, data) ->
        return @handle_404(req, res, data)

    h_sid: (req, res, data) ->
        if @options.jsessionid
            # Some load balancers do sticky sessions, but only if there is
            # a JSESSIONID cookie. If this cookie isn't yet set, we shall
            # set it to a dummy value. It doesn't really matter what, as
            # session information is usually added by the load balancer.
            req.cookies = {}
            if req.headers.cookie
                for cookie in req.headers.cookie.split(';')
                    parts = cookie.split('=')
                    req.cookies[ parts[0].trim() ] = ( parts[1] || '' ).trim()
            if res.setHeader
                # We need to set it every time, to give the loadbalancer
                # opportunity to attach its own cookies.
                jsid = req.cookies['JSESSIONID'] or 'dummy'
                res.setHeader('Set-Cookie', 'JSESSIONID=' + jsid + '; path=/')
        return data

    log: (severity, line) ->
        @options.log(severity, line)


utils.objectExtend(App.prototype, iframe.app)
utils.objectExtend(App.prototype, chunking_test.app)

utils.objectExtend(App.prototype, trans_websocket.app)
utils.objectExtend(App.prototype, trans_jsonp.app)
utils.objectExtend(App.prototype, trans_xhr.app)
utils.objectExtend(App.prototype, trans_eventsource.app)
utils.objectExtend(App.prototype, trans_htmlfile.app)


generate_dispatcher = (options) ->
        p = (s) => new RegExp('^' + options.prefix + s + '[/]?$')
        t = (s) => [p('/([^/.]+)/([^/.]+)' + s), 'server', 'session']
        opts_filters = ['h_sid', 'xhr_cors', 'cache_for', 'xhr_options', 'expose']
        dispatcher = [
            ['GET', p(''), ['welcome_screen']],
            ['GET', p('/iframe[0-9-.a-z_]*.html'), ['iframe', 'cache_for', 'expose']],
            ['OPTIONS', p('/chunking_test'), opts_filters],
            ['POST',    p('/chunking_test'), ['xhr_cors', 'expect_xhr', 'chunking_test']],
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
        maybe_add_transport = (name, urls) =>
            if options.disabled_transports.indexOf(name) isnt -1
                # modify urls to return 404
                urls = for url in urls
                    [method, url, filters] = url
                    [method, url, ['cache_for', 'disabled_transport']]
            dispatcher = dispatcher.concat(urls)
        maybe_add_transport('websocket',[
                ['GET', t('/websocket'), ['websocket']]])

class Listener
    constructor: (@options, emit) ->
        @app = new App()
        @app.options = options
        @app.emit = emit
        @app.log('debug', 'SockJS v' + sockjsVersion() + ' ' +
                          'bound to ' + JSON.stringify(options.prefix))
        @dispatcher = generate_dispatcher(@options)
        @webjs_handler = webjs.generateHandler(@app, @dispatcher)
        @path_regexp = new RegExp('^' + @options.prefix  + '([/].+|[/]?)$')

    handler: (req, res, extra) =>
        # All urls that match the prefix must be handled by us.
        if not req.url.match(@path_regexp)
            return false
        @webjs_handler(req, res, extra)
        return true

    getHandler: () ->
        return (a,b,c) => @handler(a,b,c)


class Server extends events.EventEmitter
    constructor: (user_options) ->
        @options =
            prefix: ''
            response_limit: 128*1024
            origins: ['*:*']
            disabled_transports: []
            jsessionid: true
            heartbeat_delay: 25000
            disconnect_delay: 5000
            log: (severity, line) -> console.log(line)
        if user_options
            utils.objectExtend(@options, user_options)
        if not @options.sockjs_url
            throw new Error('Option "sockjs_url" is required!')

    installHandlers: (http_server, handler_options) ->
        options = utils.objectExtend({}, @options)
        if handler_options
            utils.objectExtend(options, handler_options)
        h = new Listener(options, => @emit.apply(@, arguments))
        handler = h.getHandler()
        utils.overshadowListeners(http_server, 'request', handler)
        utils.overshadowListeners(http_server, 'upgrade', handler)
        return true

exports.createServer = (options) ->
    return new Server(options)

exports.listen = (http_server, options) ->
    srv = exports.createServer(options)
    if http_server
        srv.installHandlers(http_server)
    return srv




class DeprecatedConnectionWrapper extends events.EventEmitter
    constructor: (@conn) ->
        @id = @conn.id
        @conn.on 'data', (message) =>
            @emit('message', {data:message})
        @conn.on 'close', () =>
            e =
                status: 1001
                reason: 'Session timed out'
                wasClean: false
            @emit('close', e)

    send: (m) ->
        @conn.write(m)

    close: (a, b) ->
        @conn.close(a, b)

    toString: () ->
        @conn.toString()

DeprecatedConnectionWrapper.prototype.__defineGetter__ 'readyState', ->
    if @conn.readable then 1 else 3


class DeprecatedServerWrapper extends events.EventEmitter
    constructor: (options) ->
        @srv = new Server(options)

    installHandlers: (http_server, handler_options) ->
        @srv.options.log('info', 'You\'re using deprecated API, shame on you.')
        @srv.on 'connection', (conn) =>
            wrapped_conn = new DeprecatedConnectionWrapper(conn)
            @emit('open', wrapped_conn)
        @srv.installHandlers(http_server, handler_options)

exports.Server = DeprecatedServerWrapper
